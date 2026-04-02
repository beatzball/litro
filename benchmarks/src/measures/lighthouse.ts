import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import type { LighthouseResult } from '../types.js';
import { LIGHTHOUSE_RUNS } from '../config.js';

interface LighthouseRunData {
  performance: number;
  fcp: number;
  lcp: number;
  cls: number;
  tbt: number;
  speedIndex: number;
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
      const runs: LighthouseRunData[] = [];

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

        runs.push({
          performance: (lhr.categories.performance?.score ?? 0) * 100,
          fcp: lhr.audits['first-contentful-paint']?.numericValue ?? 0,
          lcp: lhr.audits['largest-contentful-paint']?.numericValue ?? 0,
          cls: lhr.audits['cumulative-layout-shift']?.numericValue ?? 0,
          tbt: lhr.audits['total-blocking-time']?.numericValue ?? 0,
          speedIndex: lhr.audits['speed-index']?.numericValue ?? 0,
        });
      }

      // Sort runs by performance score to find median
      const sorted = [...runs].sort((a, b) => a.performance - b.performance);
      const medianIndex = Math.floor(sorted.length / 2);
      const medianRun = sorted[medianIndex];

      results[route] = {
        performance: medianRun.performance,
        fcp: medianRun.fcp,
        lcp: medianRun.lcp,
        cls: medianRun.cls,
        tbt: medianRun.tbt,
        speedIndex: medianRun.speedIndex,
      };

      console.log(`  ${route}: performance=${medianRun.performance.toFixed(0)}`);
    }
  } finally {
    await chrome.kill();
  }

  return results;
}
