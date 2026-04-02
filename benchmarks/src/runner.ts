import { writeFile, mkdir } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import os from 'node:os';
import { join } from 'node:path';

import type { BenchmarkResults } from './types.js';
import {
  ROUTES,
  SSG_PORT,
  SSR_PORT,
  SSG_BASE_URL,
  SSR_BASE_URL,
  BUILD_RUNS,
  RESULTS_DIR,
  APPS_DIR,
  FRAMEWORK_CONFIGS,
} from './config.js';
import { startServer, waitForReady, stopServer } from './utils/server-lifecycle.js';
import { measureBuildTime } from './measures/build-time.js';
import { measureBundleSize } from './measures/bundle-size.js';
import { measurePageWeight } from './measures/page-weight.js';
import { measureHttpPerf } from './measures/http-perf.js';
import { measureLighthouse } from './measures/lighthouse.js';
import { measureStreaming } from './measures/streaming.js';
import { measureFramework } from './measures/cross-framework.js';

// --- CLI flags ---
const args = process.argv.slice(2);
const skipLighthouse = args.includes('--skip-lighthouse');
const crossFramework = args.includes('--cross-framework');
const runsFlag = args.find((_, i) => args[i - 1] === '--runs');
const buildRuns = runsFlag ? parseInt(runsFlag, 10) : BUILD_RUNS;

async function collectMeta(): Promise<BenchmarkResults['meta']> {
  const cpus = os.cpus();
  let commitSha = 'unknown';
  let commitMessage = '';
  try {
    commitSha = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
    commitMessage = execSync('git log -1 --format=%s', { encoding: 'utf-8' }).trim();
  } catch {
    // not in a git repo
  }

  return {
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    platform: os.platform(),
    arch: os.arch(),
    cpuModel: cpus[0]?.model ?? 'unknown',
    cpuCount: cpus.length,
    memoryGB: Math.round(os.totalmem() / (1024 ** 3)),
    commitSha,
    commitMessage,
  };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} kB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

function printSummary(results: BenchmarkResults): void {
  console.log('\n========================================');
  console.log('  BENCHMARK RESULTS SUMMARY');
  console.log('========================================\n');

  console.log(`Timestamp:  ${results.meta.timestamp}`);
  console.log(`Commit:     ${results.meta.commitSha} — ${results.meta.commitMessage}`);
  console.log(`Node:       ${results.meta.nodeVersion}`);
  console.log(`Platform:   ${results.meta.platform}/${results.meta.arch}`);
  console.log(`CPU:        ${results.meta.cpuModel} (${results.meta.cpuCount} cores)`);
  console.log(`Memory:     ${results.meta.memoryGB} GB\n`);

  console.log('--- Build Time ---');
  console.log(`  SSG: ${results.buildTime.ssg.mean}ms (median: ${results.buildTime.ssg.median}ms)`);
  console.log(`  SSR: ${results.buildTime.ssr.mean}ms (median: ${results.buildTime.ssr.median}ms)\n`);

  console.log('--- Bundle Size ---');
  console.log(`  SSG total: ${formatBytes(results.bundleSize.ssg.totalOutput)}`);
  console.log(`  SSR total: ${formatBytes(results.bundleSize.ssr.totalOutput)}\n`);

  console.log('--- Avg TTFB (autocannon) ---');
  const ssgTtfb = Object.values(results.httpPerf.ssg);
  const ssrTtfb = Object.values(results.httpPerf.ssr);
  const avgSsgTtfb = ssgTtfb.reduce((s, r) => s + r.latency.mean, 0) / ssgTtfb.length;
  const avgSsrTtfb = ssrTtfb.reduce((s, r) => s + r.latency.mean, 0) / ssrTtfb.length;
  console.log(`  SSG: ${avgSsgTtfb.toFixed(1)}ms`);
  console.log(`  SSR: ${avgSsrTtfb.toFixed(1)}ms\n`);

  if (!skipLighthouse) {
    console.log('--- Lighthouse Performance (SSG only) ---');
    const ssgLh = Object.values(results.lighthouse.ssg);
    const avgSsgPerf = ssgLh.reduce((s, r) => s + r.performance, 0) / ssgLh.length;
    console.log(`  SSG: ${avgSsgPerf.toFixed(0)}/100\n`);
  }

  if (results.crossFramework?.length) {
    console.log('--- Cross-Framework ---');
    for (const fw of results.crossFramework) {
      console.log(`  ${fw.name} (v${fw.version}): build=${fw.buildTime.mean}ms, output=${formatBytes(fw.outputSize)}`);
    }
    console.log('');
  }

  console.log('========================================\n');
}

async function main(): Promise<void> {
  console.log('Litro Benchmark Suite');
  console.log(`Build runs: ${buildRuns}, Lighthouse: ${skipLighthouse ? 'skipped' : 'enabled'}, Cross-framework: ${crossFramework ? 'enabled' : 'skipped'}\n`);

  // 1. Collect metadata
  const meta = await collectMeta();

  // 2. Build phase (sequential — builds cannot overlap)
  console.log('\n=== BUILD PHASE ===\n');

  console.log('[SSG] Building...');
  const ssgBuildTime = await measureBuildTime('ssg', buildRuns);

  console.log('\n[SSR] Building...');
  const ssrBuildTime = await measureBuildTime('ssr', buildRuns);

  console.log('\n[SSG] Measuring bundle size...');
  const ssgBundleSize = await measureBundleSize('ssg');

  console.log('\n[SSR] Measuring bundle size...');
  const ssrBundleSize = await measureBundleSize('ssr');

  // 3. Start servers
  console.log('\n=== SERVER PHASE ===\n');

  console.log(`Starting SSG preview server on port ${SSG_PORT}...`);
  const ssgProc = await startServer('ssg');

  console.log(`Starting SSR preview server on port ${SSR_PORT}...`);
  const ssrProc = await startServer('ssr');

  try {
    await Promise.all([
      waitForReady(SSG_BASE_URL),
      waitForReady(SSR_BASE_URL),
    ]);
    console.log('Both servers ready.\n');

    // 4. Measurement phase
    console.log('=== MEASUREMENT PHASE ===\n');

    console.log('[page-weight] SSG');
    const ssgPageWeight = await measurePageWeight(SSG_BASE_URL, ROUTES);

    console.log('\n[page-weight] SSR');
    const ssrPageWeight = await measurePageWeight(SSR_BASE_URL, ROUTES);

    console.log('\n[http-perf] SSG');
    const ssgHttpPerf = await measureHttpPerf(SSG_BASE_URL, ROUTES);

    console.log('\n[http-perf] SSR');
    const ssrHttpPerf = await measureHttpPerf(SSR_BASE_URL, ROUTES);

    console.log('\n[streaming] SSR');
    const ssrStreaming = await measureStreaming(SSR_BASE_URL, ROUTES);

    // Lighthouse (slowest — runs last, SSG only)
    // SSR pages use Declarative Shadow DOM — Lighthouse cannot measure paint
    // events inside shadow roots, so SSR scores are always 0. Only SSG is measured.
    let ssgLighthouse: Record<string, import('./types.js').LighthouseResult> = {};

    if (!skipLighthouse) {
      console.log('\n[lighthouse] SSG');
      ssgLighthouse = await measureLighthouse(SSG_BASE_URL, ROUTES);
    }

    // 5. Assemble results
    const results: BenchmarkResults = {
      meta,
      buildTime: { ssg: ssgBuildTime, ssr: ssrBuildTime },
      bundleSize: { ssg: ssgBundleSize, ssr: ssrBundleSize },
      httpPerf: { ssg: ssgHttpPerf, ssr: ssrHttpPerf },
      pageWeight: { ssg: ssgPageWeight, ssr: ssrPageWeight },
      lighthouse: { ssg: ssgLighthouse },
      streaming: { ssr: ssrStreaming },
    };

    // 5b. Cross-framework benchmarks (optional)
    if (crossFramework) {
      console.log('\n=== CROSS-FRAMEWORK PHASE ===\n');
      const frameworkResults = [];
      for (const config of FRAMEWORK_CONFIGS) {
        const result = await measureFramework(config, APPS_DIR, buildRuns);
        frameworkResults.push(result);
      }
      results.crossFramework = frameworkResults;
    }

    // 6. Write results
    await mkdir(RESULTS_DIR, { recursive: true });
    const outputPath = join(RESULTS_DIR, 'latest.json');
    await writeFile(outputPath, JSON.stringify(results, null, 2));
    console.log(`\nResults written to ${outputPath}`);

    printSummary(results);
  } finally {
    // 5. Teardown
    console.log('Stopping servers...');
    await Promise.all([stopServer(ssgProc), stopServer(ssrProc)]);
    console.log('Done.');
  }
}

main().then(() => {
  process.exit(0);
}).catch((err) => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
