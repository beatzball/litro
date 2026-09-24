/**
 * What a measured route has to answer before its bytes count as a page weight.
 *
 * A status check alone is not enough, and the April 2026 results are the proof.
 * Two different broken responses answer 200:
 *
 *   1. `npx serve` answers a directory that holds no `index.html` with its own
 *      file listing, at 200. Litro's `/` in that run was 200 with 4456 bytes,
 *      and those bytes were the page titled "Files within static/".
 *   2. A Litro catch-all that returns its 404 body without calling
 *      `setResponseStatus` answers 404 content with a 200 status line.
 *
 * So each route also names text its own rendered page contains, and a response
 * that does not contain it fails the run. Two bodies are rejected outright, on
 * every route, whether or not a marker was set for it — a forgotten marker must
 * not be what lets a directory listing through.
 */

/** A measured route, and the text its rendered page has to contain. */
export interface RouteCheck {
  readonly path: string;
  /** Every marker has to appear in the response body. */
  readonly markers: readonly string[];
}

/** A route given either as a bare path or as a path with its markers. */
export type RouteSpec = string | RouteCheck;

export function toRouteCheck(spec: RouteSpec): RouteCheck {
  return typeof spec === 'string' ? { path: spec, markers: [] } : spec;
}

export function routePaths(specs: readonly RouteSpec[]): string[] {
  return specs.map(spec => toRouteCheck(spec).path);
}

/**
 * Bodies that are never a rendered page, whatever the status line says.
 * Checked on every route, including the ones with no markers of their own.
 */
const REJECTED_BODIES: ReadonlyArray<{ readonly marker: string; readonly what: string }> = [
  { marker: '<title>Files within ', what: "`serve`'s own directory listing" },
  { marker: '<i>Index of&nbsp;</i>', what: "`serve`'s own directory listing" },
  { marker: '404 — Page Not Found', what: "a Litro catch-all's 404 page" },
];

/**
 * Returns a description of what is wrong with this response, or `undefined`
 * when it is a real rendering of the route.
 */
export function checkPage(
  check: RouteCheck,
  statusCode: number,
  body: string,
): string | undefined {
  if (statusCode !== 200) return `${check.path} -> ${statusCode}`;

  for (const { marker, what } of REJECTED_BODIES) {
    if (body.includes(marker)) {
      return `${check.path} -> 200 but the body is ${what} (found ${JSON.stringify(marker)})`;
    }
  }

  const missing = check.markers.filter(marker => !body.includes(marker));
  if (missing.length > 0) {
    return `${check.path} -> 200 but the body is missing ${missing.map(m => JSON.stringify(m)).join(', ')}`;
  }

  return undefined;
}
