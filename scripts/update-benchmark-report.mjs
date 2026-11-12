#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  if (!args[index + 1] || args[index + 1].startsWith('--')) throw new Error(`Missing value for ${name}`);
  return resolve(args[index + 1]);
};
const input = option('--input', resolve(root, 'benchmarks/results/latest.json'));
const baselinePath = option('--baseline', resolve(root, 'benchmarks/baseline.json'));
const output = option('--output', resolve(root, 'benchmarks/README.md'));
const begin = '<!-- BENCHMARK-REPORT:BEGIN -->';
const end = '<!-- BENCHMARK-REPORT:END -->';
const label = name => ({ litro: 'Litro (Lit)', 'litro-lit': 'Litro (Lit)', 'litro-fast': 'Litro (FAST)', 'litro-elena': 'Litro (Elena)', nextjs: 'Next.js', nuxt: 'Nuxt', tanstack: 'TanStack Start' })[name] ?? name;
const num = n => Number.isFinite(n) ? Number(n.toFixed(3)).toString() : 'not recorded';
const cell = value => String(value ?? 'not recorded').replaceAll('|', '\\|').replaceAll('\n', ' ');
const table = (headers, rows) => [headers, headers.map(() => '---'), ...rows].map(row => `| ${row.map(cell).join(' | ')} |`).join('\n');
const entries = obj => Object.entries(obj ?? {});
const lines = [];
const section = (heading, headers, rows) => {
  lines.push(`### ${heading}`, '', rows.length ? table(headers, rows) : 'Not measured in this run.', '');
};
function statsCells(stats) {
  return [stats?.runs?.length ?? 'not recorded', num(stats?.mean), num(stats?.median), num(stats?.p95), num(stats?.stddev), num(stats?.min), num(stats?.max)];
}
function buildTable(title, apps) {
  section(`${title}: build time`, ['App', 'Runs', 'Mean (ms)', 'Median (ms)', 'p95 (ms)', 'Std dev (ms)', 'Min (ms)', 'Max (ms)'], apps.map(app => [label(app.name), ...statsCells(app.buildTime)]));
}
function bundleTable(title, apps) {
  section(`${title}: output size`, ['App', 'Total (B)', 'Client JS (B)', 'Client CSS (B)', 'HTML (B)', 'Server (B)', 'Other (B)'], apps.map(app => {
    const b = app.bundleSize;
    return [label(app.name), num(app.outputSize), num(b?.clientJS), num(b?.clientCSS), num(b?.staticHTML), num(b?.serverBundle), b ? num(app.outputSize - b.clientJS - b.clientCSS - b.staticHTML - b.serverBundle) : 'not recorded'];
  }));
}
function pageTable(title, apps) {
  section(`${title}: HTML page weight`, ['App', 'Route', 'HTTP status', 'Raw HTML (B)', 'Gzip HTML (B)'], apps.flatMap(app => entries(app.pageWeight).map(([route, p]) => [label(app.name), route, p.statusCode, num(p.rawBytes), num(p.gzipBytes)])));
}
function httpTable(title, apps) {
  section(`${title}: HTTP load`, ['App', 'Route', 'Load runs', 'Duration (s)', 'Connections', 'Requests', 'Requests/s (mean)', 'Bytes/s (mean)', 'Latency mean (ms)', 'p50 (ms)', 'p97.5 (ms)', 'p99 (ms)', 'Max (ms)', 'Non-2xx', 'Errors', 'Timeouts'], apps.flatMap(app => entries(app.httpPerf).map(([route, h]) => [label(app.name), route, h.runCount ?? 'not recorded', h.duration, h.connections, h.requests.total, num(h.requests.mean), num(h.throughput.mean), num(h.latency.mean), num(h.latency.p50), num(h.latency.p97_5), num(h.latency.p99), num(h.latency.max), h.non2xx ?? 0, h.errors, h.timeouts])));
  section(`${title}: HTTP spread`, ['App', 'Route', 'Metric', 'Mean', 'Std dev', 'Min', 'Max'], apps.flatMap(app => entries(app.httpPerf).flatMap(([route, h]) => [['latency', 'Latency (ms)'], ['requests', 'Requests/s'], ['throughput', 'Bytes/s']].map(([key, title]) => [label(app.name), route, title, num(h[key].mean), num(h[key].stddev), num(h[key].min), num(h[key].max)]))));
}
const lhMetrics = [['performance', 'Score (0–100)'], ['fcp', 'FCP (ms)'], ['lcp', 'LCP (ms)'], ['cls', 'CLS (unitless)'], ['tbt', 'TBT (ms)'], ['speedIndex', 'Speed Index (ms)']];
function lighthouseTable(title, apps) {
  section(`${title}: Lighthouse`, ['App', 'Route', 'Runs', ...lhMetrics.map(([, title]) => title)], apps.flatMap(app => entries(app.lighthouse).map(([route, lh]) => [label(app.name), route, lh.runCount ?? lh.runs?.length ?? 'not recorded', ...lhMetrics.map(([key]) => num(lh[key]))])));
  const rows = apps.flatMap(app => entries(app.lighthouse).flatMap(([route, lh]) => entries(lh.statistics).map(([metric, stats]) => [label(app.name), route, metric, ...statsCells(stats)])));
  section(`${title}: Lighthouse spread`, ['App', 'Route', 'Metric (units above)', 'Runs', 'Mean', 'Median', 'p95', 'Std dev', 'Min', 'Max'], rows);
}
function averageWeight(app) {
  const pages = entries(app?.pageWeight).map(([, p]) => p).filter(p => p.statusCode === 200);
  return pages.length ? pages.reduce((sum, p) => sum + p.gzipBytes, 0) / pages.length : NaN;
}

const current = JSON.parse(await readFile(input, 'utf8'));
const baseline = JSON.parse(await readFile(baselinePath, 'utf8'));
for (const [suite, names] of [['crossFramework', ['litro', 'nextjs', 'nuxt', 'tanstack']], ['hnBenchmark', ['litro-lit', 'litro-fast', 'litro-elena', 'nextjs', 'nuxt', 'tanstack']]]) {
  for (const name of names) {
    const app = current[suite]?.find(app => app.name === name);
    if (!app || !entries(app.lighthouse).length || !entries(app.httpPerf).length || !app.bundleSize) {
      throw new Error(`Incomplete full run: ${suite}/${name} requires build, bundle, HTTP, page weight, and Lighthouse data. Existing docs were preserved.`);
    }
    if (!app.buildTime?.runs?.length || !entries(app.pageWeight).length || !app.version || app.version === 'unknown') throw new Error(`Incomplete result: ${suite}/${name}`);
  }
}
for (const mode of ['ssg', 'ssr']) {
  if (!current.buildTime?.[mode]?.runs?.length || !current.bundleSize?.[mode] || !entries(current.pageWeight?.[mode]).length || !entries(current.httpPerf?.[mode]).length) throw new Error(`Incomplete docs ${mode} data`);
}
if (!entries(current.lighthouse?.ssg).length || !entries(current.streaming?.ssr).length) throw new Error('Incomplete docs Lighthouse or streaming data');
const m = current.meta ?? {};
lines.push(`Measured at ${m.timestamp}; source commit \`${m.commitSha}\`. Baseline: ${baseline.meta.timestamp}, commit \`${baseline.meta.commitSha}\`.`, '');
section('Machine and run context', ['Field', 'Value'], entries(m).filter(([key]) => key !== 'commitMessage').map(([key, value]) => [key, typeof value === 'object' ? JSON.stringify(value) : value]));
lines.push('Byte counts use B (not decimal KB). Build tables show repeated-run statistics. HTTP latency is whole-response latency; its percentiles describe requests in one load test, not variation between independent load tests. Lighthouse scalars come from the run selected by median performance score; per-metric spread is listed separately when recorded. Page weight and output size are single observations after the final build. Missing historical measures are marked “not recorded.”', '');
for (const [suite, title] of [['crossFramework', 'Minimal comparison'], ['hnBenchmark', 'HN comparison']]) {
  const apps = current[suite];
  section(`${title}: exact package versions`, ['App', 'Headline version', 'Resolved stack'], apps.map(app => [label(app.name), app.version, entries(app.versions).map(([pkg, version]) => `${pkg}@${version}`).join(', ')]));
  buildTable(title, apps);
  bundleTable(title, apps);
  pageTable(title, apps);
  httpTable(title, apps);
  lighthouseTable(title, apps);
  section(`${title}: streaming`, ['App', 'Streaming'], apps.map(app => [label(app.name), 'N/A: prerendered static output; framework SSR is not measured']));
}
const docsApps = ['ssg', 'ssr'].map(mode => ({ name: `Litro docs ${mode.toUpperCase()}`, buildTime: current.buildTime[mode], outputSize: current.bundleSize[mode].totalOutput, bundleSize: current.bundleSize[mode], pageWeight: current.pageWeight[mode], httpPerf: current.httpPerf[mode], lighthouse: current.lighthouse[mode] }));
buildTable('Docs', docsApps);
bundleTable('Docs', docsApps);
pageTable('Docs', docsApps);
httpTable('Docs', docsApps);
lighthouseTable('Docs (SSG only)', docsApps.filter(app => app.name.endsWith('SSG')));
section('Docs SSR streaming', ['Route', 'Runs', 'TTFB median (ms)', 'TTLB median (ms)', 'Delta (ms)', 'Payload (B)'], entries(current.streaming.ssr).map(([route, s]) => [route, s.runCount ?? s.runs?.length ?? 'not recorded', num(s.ttfb), num(s.ttlb), num(s.delta), num(s.totalBytes)]));
section('Docs SSR streaming spread', ['Route', 'Metric (ms; totalBytes in B)', 'Runs', 'Mean', 'Median', 'p95', 'Std dev', 'Min', 'Max'], entries(current.streaming.ssr).flatMap(([route, s]) => entries(s.statistics).map(([metric, stats]) => [route, metric, ...statsCells(stats)])));
lines.push('### Next.js and Nuxt: old versus new', '', `Historical comparison across separate runs: Node ${baseline.meta.nodeVersion} → ${m.nodeVersion}. Different framework/peer versions, machine load, and run conditions can affect these values; these changes do not isolate the effect of a dependency upgrade. Static HTTP, bundle breakdown, and minimal-app Lighthouse were not recorded in the old baseline. See the full current tables for those measures.`, '');
const comparisons = [];
for (const suite of ['crossFramework', 'hnBenchmark']) {
  for (const name of ['nextjs', 'nuxt']) {
    const old = baseline[suite]?.find(app => app.name === name);
    const app = current[suite].find(app => app.name === name);
    for (const [metric, oldValue, newValue] of [['Build median (ms)', old?.buildTime.median, app.buildTime.median], ['Output (B)', old?.outputSize, app.outputSize], ['Mean HTML gzip (B)', averageWeight(old), averageWeight(app)]]) {
      comparisons.push([suite, label(name), old?.version, app.version, metric, num(oldValue), num(newValue), Number.isFinite(oldValue) && oldValue !== 0 ? `${num((newValue / oldValue - 1) * 100)}%` : 'not recorded']);
    }
  }
}
lines.push(table(['Suite', 'Framework', 'Old version', 'New version', 'Measure', 'Old', 'New', 'Change'], comparisons), '');
const block = [begin, '', ...lines, end].join('\n');
const source = await readFile(output, 'utf8');
const startIndex = source.indexOf(begin);
const endIndex = source.indexOf(end);
if (startIndex < 0 || endIndex < startIndex || source.indexOf(begin, startIndex + begin.length) !== -1 || source.indexOf(end, endIndex + end.length) !== -1) throw new Error('Expected exactly one ordered report marker pair');
const next = source.slice(0, startIndex) + block + source.slice(endIndex + end.length);
if (next !== source) await writeFile(output, next);
console.log(`Benchmark report ${next === source ? 'unchanged' : 'updated'}: ${output}`);
