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

    results[route] = {
      latency: {
        mean: result.latency.mean,
        p50: result.latency.p50,
        p97_5: result.latency.p97_5,
        p99: result.latency.p99,
        max: result.latency.max,
      },
      requests: {
        mean: result.requests.mean,
        total: result.requests.total,
      },
      throughput: {
        mean: result.throughput.mean,
      },
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
