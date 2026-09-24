import { gzipSize } from '../utils/gzip.js';
import { checkPage, toRouteCheck, type RouteSpec } from '../utils/page-check.js';
import type { PageWeightResult } from '../types.js';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} kB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

export async function measurePageWeight(
  baseUrl: string,
  routes: readonly RouteSpec[],
): Promise<Record<string, PageWeightResult>> {
  const results: Record<string, PageWeightResult> = {};
  const broken: string[] = [];

  for (const spec of routes) {
    const check = toRouteCheck(spec);
    const route = check.path;
    const url = baseUrl + route;
    const res = await fetch(url);
    const buf = Buffer.from(await res.arrayBuffer());

    const rawBytes = buf.byteLength;
    const gzipBytes = gzipSize(buf);
    const statusCode = res.status;

    results[route] = { rawBytes, gzipBytes, statusCode };
    const problem = checkPage(check, statusCode, buf.toString('utf-8'));
    if (problem) broken.push(problem);

    console.log(
      `[page-weight] ${route} — ${statusCode} — raw: ${formatBytes(rawBytes)}, gzip: ${formatBytes(gzipBytes)}`,
    );
  }

  // The weight of an error page is not the weight of the page, and neither is
  // the weight of a directory listing. Recording one as the other is how the
  // April 2026 results came to publish a 404 body and a `serve` listing as page
  // weights, so either one stops the run instead. See utils/page-check.ts.
  if (broken.length > 0) {
    throw new Error(
      `${baseUrl} did not serve every measured route: ${broken.join(', ')}. ` +
      `No results are written. Fix the app, do not relax this check.`,
    );
  }

  return results;
}
