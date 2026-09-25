/**
 * Catch-all page handler
 *
 * Every Litro app needs this file. Nitro has no page routes of its own: the
 * page scanner writes the manifest, and this handler is what turns a request
 * into a rendered page. Without it Nitro answers "Cannot find any route
 * matching /" for every route, and an SSG build prerenders nothing.
 *
 * Request flow:
 *   1. Read the page manifest from the #litro/page-manifest virtual module,
 *      written by the page scanner plugin during build:before.
 *   2. Match the request path against each entry. The scanner sorts routes
 *      static -> dynamic -> catch-all, so the first match is the most specific.
 *   3. Hand the matched route to createPageHandler() for SSR.
 *   4. Return a 404 HTML page when nothing matches.
 *
 * This is a copy of the same handler the HN benchmark apps use. The three
 * cross-framework apps have to do the same work for the numbers to compare,
 * so this app renders its pages the way a real Litro app does.
 */

import { defineEventHandler, setResponseHeader, setResponseStatus, getRequestURL } from 'h3';
import { createPageHandler } from '@beatzball/litro/runtime/create-page-handler.js';
import { normalizePathname } from '@beatzball/litro';
import type { LitroRoute } from '@beatzball/litro';
import { routes, pageModules } from '#litro/page-manifest';

/**
 * Matches a URL pathname against the sorted LitroRoute array and extracts
 * any route params. Returns undefined when no route matches.
 */
function matchRoute(
  pathname: string,
): { route: LitroRoute; params: Record<string, string> } | undefined {
  for (const route of routes) {
    if (route.isCatchAll) return { route, params: {} };

    if (!route.isDynamic) {
      if (pathname === route.path) return { route, params: {} };
      continue;
    }

    // Dynamic route: turn the h3 path pattern into a named-capture RegExp.
    //   /blog/:slug -> /^\/blog\/(?<slug>[^/]+)$/
    const regexStr = '^' + route.path
      .replace(/:([^/]+)\(\.\*\)\*/g, '(?<$1>.+)')
      .replace(/:([^/?]+)\?/g, '(?<$1>[^/]*)?')
      .replace(/:([^/]+)/g, '(?<$1>[^/]+)')
      + '$';

    try {
      const match = pathname.match(new RegExp(regexStr));
      if (match) {
        return { route, params: (match.groups ?? {}) as Record<string, string> };
      }
    } catch {
      // Malformed pattern — skip this route.
    }
  }

  return undefined;
}

export default defineEventHandler(async (event) => {
  // Canonicalize before matching: '/docs/a/' and '/docs/a' are one page.
  // The client router strips the same trailing slash, so both halves agree
  // (issue 203). A mismatch renders a blank 200 page, not an error.
  const pathname = normalizePathname(getRequestURL(event).pathname);
  const result = matchRoute(pathname);

  if (!result) {
    // The status has to say 404 too. Returning this body with the default 200
    // is how two 404 pages were written into a measured static build and
    // counted as real pages: the benchmark harness only looked at the status.
    setResponseStatus(event, 404);
    setResponseHeader(event, 'content-type', 'text/html; charset=utf-8');
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>404 Not Found — Litro</title>
</head>
<body>
  <h1>404 — Page Not Found</h1>
  <p>No page matched the path <code>${pathname}</code>.</p>
</body>
</html>`;
  }

  const { route: matched, params } = result;

  // pageData fetchers read route params from here, for example
  // event.context.params.slug on /blog/:slug.
  event.context.params = { ...event.context.params, ...params };

  const handler = createPageHandler({
    route: matched,
    pageModule: pageModules[matched.filePath],
  });
  return handler(event);
});
