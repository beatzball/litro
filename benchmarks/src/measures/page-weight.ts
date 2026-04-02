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

  for (const route of routes) {
    const url = baseUrl + route;
    const res = await fetch(url);
    const buf = Buffer.from(await res.arrayBuffer());

    const rawBytes = buf.byteLength;
    const gzipBytes = gzipSize(buf);
    const statusCode = res.status;

    results[route] = { rawBytes, gzipBytes, statusCode };

    console.log(
      `[page-weight] ${route} — ${statusCode} — raw: ${formatBytes(rawBytes)}, gzip: ${formatBytes(gzipBytes)}`,
    );
  }

  return results;
}
