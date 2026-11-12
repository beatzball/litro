import autocannon from 'autocannon';
import type { AutocannonResult } from '../types.js';
import { AUTOCANNON_CONNECTIONS, AUTOCANNON_DURATION } from '../config.js';

export async function measureHttpPerf(
  baseUrl: string,
  routes: string[],
  opts?: { connections?: number; duration?: number },
): Promise<Record<string, AutocannonResult>> {
  const connections = opts?.connections ?? AUTOCANNON_CONNECTIONS;
  const duration = opts?.duration ?? AUTOCANNON_DURATION;
  const results: Record<string, AutocannonResult> = {};

  for (const route of routes) {
    const url = baseUrl + route;
    const result = await autocannon({
      url,
      connections,
      duration,
    });

    if (result.errors || result.timeouts || result.non2xx || !result.requests.total) {
      throw new Error(`HTTP measurement failed for ${route}: errors=${result.errors}, timeouts=${result.timeouts}, non2xx=${result.non2xx}`);
    }

    results[route] = {
      latency: {
        mean: result.latency.mean,
        min: result.latency.min,
        stddev: result.latency.stddev,
        p50: result.latency.p50,
        p97_5: result.latency.p97_5,
        p99: result.latency.p99,
        max: result.latency.max,
      },
      requests: {
        mean: result.requests.mean,
        total: result.requests.total,
        min: result.requests.min,
        max: result.requests.max,
        stddev: result.requests.stddev,
      },
      throughput: {
        mean: result.throughput.mean,
        min: result.throughput.min,
        max: result.throughput.max,
        stddev: result.throughput.stddev,
      },
      runCount: 1,
      non2xx: result.non2xx,
      errors: result.errors,
      timeouts: result.timeouts,
      duration,
      connections,
    };

    console.log(
      `  ${route}: latency=${result.latency.mean.toFixed(1)}ms, req/s=${result.requests.mean.toFixed(0)}`,
    );
  }

  return results;
}
