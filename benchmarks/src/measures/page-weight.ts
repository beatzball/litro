import { gzipSize } from '../utils/gzip.js';
import type { PageWeightResult } from '../types.js';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} kB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

export async function measurePageWeight(
  baseUrl: string,
  routes: string[],
): Promise<Record<string, PageWeightResult>> {
  const results: Record<string, PageWeightResult> = {};
  const broken: string[] = [];

  for (const route of routes) {
    const url = baseUrl + route;
    const res = await fetch(url);
    const buf = Buffer.from(await res.arrayBuffer());

    const rawBytes = buf.byteLength;
    const gzipBytes = gzipSize(buf);
    const statusCode = res.status;

    results[route] = { rawBytes, gzipBytes, statusCode };
    if (statusCode !== 200) broken.push(`${route} -> ${statusCode}`);

    console.log(
      `[page-weight] ${route} — ${statusCode} — raw: ${formatBytes(rawBytes)}, gzip: ${formatBytes(gzipBytes)}`,
    );
  }

  // The weight of an error page is not the weight of the page. Recording one as
  // the other is how the April 2026 results came to publish a 404 body as a
  // page weight, so a non-200 stops the run instead.
  if (broken.length > 0) {
    throw new Error(
      `${baseUrl} did not serve every measured route: ${broken.join(', ')}. ` +
      `No results are written. Fix the app, do not relax this check.`,
    );
  }

  return results;
}
