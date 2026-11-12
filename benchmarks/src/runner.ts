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
  HN_FRAMEWORK_CONFIGS,
  HN_ROUTE_CHECKS,
  MOCK_API_PORT,
  LIGHTHOUSE_RUNS,
  STREAMING_RUNS,
  AUTOCANNON_CONNECTIONS,
  AUTOCANNON_DURATION,
} from './config.js';
import { startServer, waitForReady, stopAllServers, assertPortAvailable } from './utils/server-lifecycle.js';
import { measureBuildTime } from './measures/build-time.js';
import { measureBundleSize } from './measures/bundle-size.js';
import { measurePageWeight } from './measures/page-weight.js';
import { measureHttpPerf } from './measures/http-perf.js';
import { measureLighthouse } from './measures/lighthouse.js';
import { measureStreaming } from './measures/streaming.js';
import { measureFramework } from './measures/cross-framework.js';
import { startMockApi, stopMockApi } from './utils/mock-api.js';
import { sanitizeContext } from './utils/context.js';

// --- CLI flags ---
const args = process.argv.slice(2);
const skipLighthouse = args.includes('--skip-lighthouse');
const crossFramework = args.includes('--cross-framework');
const hnBenchmark = args.includes('--hn');
const runsIndex = args.indexOf('--runs');
const runsFlag = runsIndex === -1 ? undefined : args[runsIndex + 1];
const buildRuns = runsIndex === -1 ? BUILD_RUNS : Number(runsFlag);
if (!Number.isSafeInteger(buildRuns) || buildRuns < 1) {
  throw new Error('--runs must be a positive integer');
}

async function collectMeta(): Promise<BenchmarkResults['meta']> {
  const cpus = os.cpus();
  let commitSha = 'unknown';
  let pnpmVersion = 'unknown';
  let osVersion = os.release();
  try {
    commitSha = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
  } catch { /* optional outside a checkout */ }
  try {
    const version = execSync('pnpm --version', { encoding: 'utf-8' }).trim();
    if (/^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(version)) pnpmVersion = version;
  } catch { /* record unavailable tooling */ }
  if (os.platform() === 'darwin') {
    const version = execSync('sw_vers -productVersion', { encoding: 'utf-8' }).trim();
    if (/^\d+(?:\.\d+)+$/.test(version)) osVersion = version;
  }

  return {
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    platform: os.platform(),
    osVersion,
    pnpmVersion,
    context: sanitizeContext(process.env.BENCH_CONTEXT ?? 'Local run; background activity not controlled'),
    arch: os.arch(),
    cpuModel: cpus[0]?.model ?? 'unknown',
    cpuCount: cpus.length,
    memoryGB: Math.round(os.totalmem() / (1024 ** 3)),
    loadAverage: os.loadavg() as [number, number, number],
    commitSha,
    // A free-form commit subject can contain personal data. The SHA identifies the source.
    commitMessage: '',
    settings: {
      buildRuns,
      lighthouseRuns: skipLighthouse ? 0 : LIGHTHOUSE_RUNS,
      streamingRuns: STREAMING_RUNS,
      httpConnections: AUTOCANNON_CONNECTIONS,
      httpDurationSeconds: AUTOCANNON_DURATION,
      httpRunsPerRoute: 1,
      crossFramework,
      hn: hnBenchmark,
      buildCache: 'cold',
      comparisonServing: 'static files via serve',
      lighthousePreset: 'default mobile simulated throttling',
    },
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
  console.log(`Commit:     ${results.meta.commitSha}`);
  console.log(`Node:       ${results.meta.nodeVersion}; pnpm: ${results.meta.pnpmVersion}; OS: ${results.meta.osVersion}`);
  console.log(`Context:    ${results.meta.context}`);
  console.log(`Platform:   ${results.meta.platform}/${results.meta.arch}`);
  console.log(`CPU:        ${results.meta.cpuModel} (${results.meta.cpuCount} cores)`);
  console.log(`Memory:     ${results.meta.memoryGB} GB`);
  console.log(`Load avg:   ${results.meta.loadAverage.map(n => n.toFixed(2)).join(', ')} (1m, 5m, 15m)\n`);

  console.log('--- Build Time ---');
  console.log(`  SSG: ${results.buildTime.ssg.mean}ms (median: ${results.buildTime.ssg.median}ms)`);
  console.log(`  SSR: ${results.buildTime.ssr.mean}ms (median: ${results.buildTime.ssr.median}ms)\n`);

  console.log('--- Bundle Size ---');
  console.log(`  SSG total: ${formatBytes(results.bundleSize.ssg.totalOutput)}`);
  console.log(`  SSR total: ${formatBytes(results.bundleSize.ssr.totalOutput)}\n`);

  console.log('--- Avg full response latency (autocannon) ---');
  const ssgLatency = Object.values(results.httpPerf.ssg);
  const ssrLatency = Object.values(results.httpPerf.ssr);
  const avgSsgLatency = ssgLatency.reduce((s, r) => s + r.latency.mean, 0) / ssgLatency.length;
  const avgSsrLatency = ssrLatency.reduce((s, r) => s + r.latency.mean, 0) / ssrLatency.length;
  console.log(`  SSG: ${avgSsgLatency.toFixed(1)}ms`);
  console.log(`  SSR: ${avgSsrLatency.toFixed(1)}ms\n`);

  if (!skipLighthouse) {
    console.log('--- Lighthouse Performance (SSG only) ---');
    const ssgLh = Object.values(results.lighthouse.ssg);
    const avgSsgPerf = ssgLh.reduce((s, r) => s + r.performance, 0) / ssgLh.length;
    console.log(`  SSG: ${avgSsgPerf.toFixed(0)}/100\n`);
  }

  if (results.crossFramework?.length) {
    console.log('--- Cross-Framework (minimal) ---');
    for (const fw of results.crossFramework) {
      console.log(`  ${fw.name} (v${fw.version}): build=${fw.buildTime.mean}ms, output=${formatBytes(fw.outputSize)}`);
    }
    console.log('');
  }

  if (results.hnBenchmark?.length) {
    console.log('--- HN Benchmark (realistic) ---');
    for (const fw of results.hnBenchmark) {
      console.log(`  ${fw.name} (v${fw.version}): build=${fw.buildTime.mean}ms, output=${formatBytes(fw.outputSize)}`);
    }
    console.log('');
  }

  console.log('========================================\n');
}

async function main(): Promise<void> {
  console.log('Litro Benchmark Suite');
  console.log(`Build runs: ${buildRuns}, Lighthouse: ${skipLighthouse ? 'skipped' : 'enabled'}, Cross-framework: ${crossFramework ? 'enabled' : 'skipped'}, HN: ${hnBenchmark ? 'enabled' : 'skipped'}\n`);

  // 1. Collect metadata
  const meta = await collectMeta();
  const ports = [SSG_PORT, SSR_PORT,
    ...(crossFramework ? FRAMEWORK_CONFIGS.map(config => config.previewPort) : []),
    ...(hnBenchmark ? [MOCK_API_PORT, ...HN_FRAMEWORK_CONFIGS.map(config => config.previewPort)] : []),
  ];
  for (const port of ports) await assertPortAvailable(port);

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

  try {
    console.log(`Starting SSG preview server on port ${SSG_PORT}...`);
    const ssgProc = await startServer('ssg');

    console.log(`Starting SSR preview server on port ${SSR_PORT}...`);
    const ssrProc = await startServer('ssr');

    await Promise.all([
      waitForReady(SSG_BASE_URL, undefined, ssgProc),
      waitForReady(SSR_BASE_URL, undefined, ssrProc),
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

    // Audit prerendered docs and every enabled comparison app. Streaming is
    // measured separately on per-request docs SSR; comparison apps are static.
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
        const result = await measureFramework(config, APPS_DIR, buildRuns, undefined, undefined, !skipLighthouse);
        frameworkResults.push(result);
      }
      results.crossFramework = frameworkResults;
    }

    // 5c. HN benchmark (optional — realistic app comparison, SSG only)
    // TODO: Add --hn-ssr flag for per-request SSR benchmarks using measureHttpPerf().
    // Each app needs SSR build/serve configs, and the mock API must stay running
    // during autocannon tests. Store results in hnSsrBenchmark in latest.json.
    if (hnBenchmark) {
      console.log('\n=== HN BENCHMARK PHASE ===\n');
      const mockApiProc = await startMockApi();
      const hnEnv = { HN_API_BASE: `http://localhost:${MOCK_API_PORT}/v0` };
      try {
        const hnResults = [];
        for (const config of HN_FRAMEWORK_CONFIGS) {
          const result = await measureFramework(config, APPS_DIR, buildRuns, HN_ROUTE_CHECKS, hnEnv, !skipLighthouse);
          hnResults.push(result);
        }
        results.hnBenchmark = hnResults;
      } finally {
        await stopMockApi(mockApiProc);
        console.log('Mock API stopped.');
      }
    }

    results.meta.loadAverageEnd = os.loadavg() as [number, number, number];

    // 6. Write results
    await mkdir(RESULTS_DIR, { recursive: true });
    const outputPath = join(RESULTS_DIR, 'latest.json');
    await writeFile(outputPath, JSON.stringify(results, null, 2));
    console.log(`\nResults written to ${outputPath}`);

    printSummary(results);
  } finally {
    // 5. Teardown
    console.log('Stopping servers...');
    await stopAllServers();
    console.log('Done.');
  }
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void stopAllServers().finally(() => process.exit(signal === 'SIGINT' ? 130 : 143));
  });
}

main().then(() => {
  process.exit(0);
}).catch((err) => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
