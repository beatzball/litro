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

    req.on('error', reject);
    req.end();
  });
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

    const ttfbStats = computeStats(ttfbValues);
    const ttlbStats = computeStats(ttlbValues);
    const bytesStats = computeStats(bytesValues);

    results[route] = {
      ttfb: ttfbStats.median,
      ttlb: ttlbStats.median,
      delta: ttlbStats.median - ttfbStats.median,
      totalBytes: bytesStats.median,
    };

    console.log(
      `  ${route}: ttfb=${ttfbStats.median.toFixed(1)}ms, ttlb=${ttlbStats.median.toFixed(1)}ms`,
    );
  }

  return results;
}
