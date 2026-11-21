import http from 'node:http';
import type { StreamingResult } from '../types.js';
import { STREAMING_RUNS } from '../config.js';
import { computeStats } from '../utils/stats.js';

interface StreamingSample {
  ttfb: number;
  ttlb: number;
  totalBytes: number;
}

function fetchStreaming(url: string): Promise<StreamingSample> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const start = performance.now();

    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + parsed.search,
        method: 'GET',
      },
      (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`Streaming request failed with status ${res.statusCode}`));
          return;
        }
        const ttfb = performance.now() - start;
        let totalBytes = 0;

        res.on('data', (chunk: Buffer) => {
          totalBytes += chunk.length;
        });

        res.on('end', () => {
          const ttlb = performance.now() - start;
          resolve({ ttfb, ttlb, totalBytes });
        });

        res.on('error', reject);
      },
    );

    req.setTimeout(30_000, () => req.destroy(new Error('Streaming request timed out')));
    req.on('error', reject);
    req.end();
  });
}

/**
 * Sub-millisecond timings keep three decimals, so a 0.486 ms TTFB is not
 * published as 0 ms. Delta is the median of the per-request differences,
 * not the difference of the two medians, so it matches its spread table.
 */
export function summarizeStreaming(
  ttfbValues: number[],
  ttlbValues: number[],
  bytesValues: number[],
): StreamingResult {
  if (ttfbValues.length !== ttlbValues.length) {
    throw new Error('Streaming TTFB and TTLB need one value per request');
  }
  const ttfb = computeStats(ttfbValues, 3);
  const ttlb = computeStats(ttlbValues, 3);
  const delta = computeStats(ttlbValues.map((value, i) => value - ttfbValues[i]), 3);
  const totalBytes = computeStats(bytesValues);
  return {
    ttfb: ttfb.median,
    ttlb: ttlb.median,
    delta: delta.median,
    totalBytes: totalBytes.median,
    runCount: ttfbValues.length,
    statistics: { ttfb, ttlb, delta, totalBytes },
  };
}

export async function measureStreaming(
  baseUrl: string,
  routes: string[],
): Promise<Record<string, StreamingResult>> {
  const results: Record<string, StreamingResult> = {};

  for (const route of routes) {
    const url = baseUrl + route;
    const ttfbValues: number[] = [];
    const ttlbValues: number[] = [];
    const bytesValues: number[] = [];

    for (let i = 0; i < STREAMING_RUNS; i++) {
      const sample = await fetchStreaming(url);
      ttfbValues.push(sample.ttfb);
      ttlbValues.push(sample.ttlb);
      bytesValues.push(sample.totalBytes);
    }

    results[route] = summarizeStreaming(ttfbValues, ttlbValues, bytesValues);
    const { ttfb, ttlb } = results[route];

    console.log(
      `  ${route}: ttfb=${ttfb.toFixed(1)}ms, ttlb=${ttlb.toFixed(1)}ms`,
    );
  }

  return results;
}
