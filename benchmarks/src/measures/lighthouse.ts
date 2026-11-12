import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import { computeStats } from '../utils/stats.js';
import { assertNoLiveHnRequests } from '../utils/fixture-network.js';
import type { LighthouseMetrics, LighthouseResult } from '../types.js';
import { LIGHTHOUSE_RUNS } from '../config.js';

export function summarizeLighthouseRuns(runs: LighthouseMetrics[]): LighthouseResult {
  if (!runs.length) throw new Error('Lighthouse requires at least one run');
  const sorted = [...runs].sort((a, b) => a.performance - b.performance);
  const medianRun = sorted[Math.floor(sorted.length / 2)];
  const statistics = {} as LighthouseResult['statistics'];
  for (const key of Object.keys(medianRun) as (keyof LighthouseMetrics)[]) {
    statistics[key] = computeStats(runs.map(run => run[key]), 6);
  }
  return { ...medianRun, runCount: runs.length, statistics };
}

export async function measureLighthouse(
  baseUrl: string,
  routes: string[],
): Promise<Record<string, LighthouseResult>> {
  const chrome = await chromeLauncher.launch({
    chromeFlags: ['--headless=new', '--no-sandbox'],
  });

  const results: Record<string, LighthouseResult> = {};

  try {
    for (const route of routes) {
      const url = baseUrl + route;
      const runs: LighthouseMetrics[] = [];

      for (let i = 0; i < LIGHTHOUSE_RUNS; i++) {
        const runResult = await lighthouse(url, {
          port: chrome.port,
          output: 'json',
          onlyCategories: ['performance'],
        });

        if (!runResult?.lhr) {
          throw new Error(`Lighthouse returned no result for ${url} (run ${i + 1})`);
        }

        const { lhr } = runResult;
        if (lhr.runtimeError) {
          throw new Error(`Lighthouse failed for ${route}: ${lhr.runtimeError.code}`);
        }

        const network = lhr.audits['network-requests']?.details as { items?: { url: string }[] } | undefined;
        if (!network?.items) throw new Error('Lighthouse did not provide its network request audit');
        assertNoLiveHnRequests(network.items.map(item => item.url));

        runs.push({
          performance: (lhr.categories.performance?.score ?? 0) * 100,
          fcp: lhr.audits['first-contentful-paint']?.numericValue ?? 0,
          lcp: lhr.audits['largest-contentful-paint']?.numericValue ?? 0,
          cls: lhr.audits['cumulative-layout-shift']?.numericValue ?? 0,
          tbt: lhr.audits['total-blocking-time']?.numericValue ?? 0,
          speedIndex: lhr.audits['speed-index']?.numericValue ?? 0,
        });
      }

      results[route] = summarizeLighthouseRuns(runs);
      console.log(`  ${route}: performance=${results[route].performance.toFixed(0)}`);
    }
  } finally {
    await chrome.kill();
  }

  return results;
}
