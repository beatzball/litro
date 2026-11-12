# Benchmarks

The minimal suite compares Litro (Lit), Next.js, Nuxt, and TanStack Start. The HN suite compares three Litro adapters (Lit, FAST, Elena), Next.js, Nuxt, and TanStack Start using the same local mock API fixtures. A separate suite measures the full Litro docs site in SSG and SSR modes. The [benchmark page](https://litro.dev/benchmarks) reads `results/latest.json`; the [source configuration](src/config.ts) defines apps, routes, cache directories, and run counts.

## Install and build

Use Node 24.22.3 (Nuxt requires at least 24.15 on the Node 24 line), pnpm, npm, and an installed Chrome or Chromium browser for Lighthouse. Use the package manager versions recorded in the results when reproducing a run. Saved metadata also records npm, Chrome, Lighthouse, and the benchmark tool versions. Run these commands from the repository root:

```sh
pnpm install --frozen-lockfile
pnpm --filter @beatzball/litro-router build
pnpm --filter @beatzball/litro build
pnpm install --frozen-lockfile
npm ci --prefix benchmarks/apps/nextjs
npm ci --prefix benchmarks/apps/nuxt
npm ci --prefix benchmarks/apps/tanstack
npm ci --prefix benchmarks/apps/hn-nextjs
npm ci --prefix benchmarks/apps/hn-nuxt
npm ci --prefix benchmarks/apps/hn-tanstack
```

The second workspace install links the newly built framework CLI executables. The root workspace install covers Litro apps, the mock API, the docs sites, and benchmark tooling. Competing apps have isolated npm lockfiles and must be installed separately. Explicit installs prevent the runner from reusing an outdated `node_modules` directory. If Chrome is not detected, set `CHROME_PATH` to its executable.

The runner builds each app automatically. To build just one app, run the following command in its directory:

| App directories under `benchmarks/apps/` | Build | Static output |
| --- | --- | --- |
| `litro`, `hn-litro`, `hn-litro-fast`, `hn-litro-elena` | `pnpm exec litro build --mode static` | `dist/static` |
| `nextjs`, `hn-nextjs` | `npm run build` | `out` |
| `nuxt` | `npm run generate` | `.output/public` |
| `hn-nuxt` | `npm run build` | `.output/public` |
| `tanstack`, `hn-tanstack` | `npm run build` | `dist/client` |

For an HN build outside the runner, start `pnpm --filter @beatzball/hn-mock-api start` in another terminal and set `HN_API_BASE=http://localhost:4100/v0` in the app's build environment. The mock API serves checked-in fixtures, not the live Hacker News API. Build the full docs sites with `pnpm build:docs` and `pnpm build:docs-ssr` from the root.

## Run the suites

All commands below run from the repository root. Each includes the docs-site suite; flags add comparison phases.

| Command | Comparison phases | Lighthouse |
| --- | --- | --- |
| `pnpm bench:quick` | Docs only | Skipped |
| `pnpm bench` | Docs only | Included |
| `pnpm bench:cross` | Minimal | Skipped |
| `pnpm bench:full` | Minimal | Included |
| `pnpm bench:hn` | HN | Skipped |
| `pnpm bench:hn:full` | HN | Included |
| `pnpm bench:all` | Minimal and HN | Skipped |
| `pnpm bench:all:full` | Minimal and HN | Included |

Use `pnpm bench:all:full` for publishable results. After the full measurement succeeds, this command automatically regenerates the root README and the detailed report. Each invocation replaces all of `results/latest.json`; consecutive partial runs do not merge. To override the default three build repetitions while keeping all phases, use `pnpm --filter @beatzball/litro-benchmarks exec tsx src/runner.ts --cross-framework --hn --runs 5`. Lighthouse uses three audits per route; docs SSR streaming uses five requests per route. HTTP uses one 10-second autocannon run per route with ten connections. The saved metadata and per-route settings are authoritative if defaults change.

Keep the machine free of other build, test, browser, and benchmark workloads during measurement. Record other active workloads in run context. The runner manages preview servers and the HN mock API; ensure their configured ports are free before starting. Minimal previews use ports 4001–4004, HN previews 4010–4015, the mock API 4100, and docs previews 3033–3034.

To regenerate both reports explicitly after a successful full run:

```sh
pnpm bench:update-readme
pnpm bench:update-report
```

The detailed updater (`node scripts/update-benchmark-report.mjs`, also available as `pnpm bench:update-report`) updates only the report markers below and refuses an incomplete comparison run. It reads the preserved Next.js/Nuxt source snapshot in `benchmarks/baseline.json` for the old-versus-new table. To compare a different baseline, pass `--baseline path/to/old-latest.json`. `--input` and `--output` accept alternate JSON and Markdown paths; an alternate Markdown file must contain the report markers. Root `README.md` is updated only through `scripts/update-readme-bench.mjs`.

## Method and fairness

- Minimal apps prerender `/` and `/blog/hello` with the same visible content. HN apps prerender the fixture-derived page set; the measured routes are `/`, `/ask`, `/show`, `/story/47760529`, and `/user/divan`. The runner rejects measured routes without the expected rendered content, even if they return status 200.
- Comparison builds remove each app's output and configured framework caches before every timed build. Dependency installation is outside the timer. Timing includes each production CLI and prerender step; package-manager wrappers differ across the established app commands. Cold refers to framework build caches; operating-system file caches are not flushed, and apps run sequentially in configured order. Next.js skips type checking; all comparison apps transpile without a separate type-check pass. Docs builds clear `dist`, `.nitro`, `.litro`, and `node_modules/.vite` before each timed build.
- Every comparison preview serves prerendered files with the same `serve` tool. HTTP results measure static-file serving and payload differences. They do not measure Next.js, Nuxt, or TanStack Start request-time SSR. Autocannon reports whole-response latency, not TTFB. Only the docs SSR streaming test measures time to first byte (TTFB) and time to last byte (TTLB).
- Bundle totals are bytes on disk in the static output directory, including extra payloads and assets. JS/CSS/HTML categories do not necessarily sum to total output; other files include JSON, RSC payloads, fonts, maps, and images. TanStack Start's separate `dist/server` SSR bundle is unused and excluded from this static comparison, like other apps' nonstatic server output.
- HN Nuxt stores shared fixture data through `useAsyncData`, so initial hydration and navigation between prerendered pages use generated payloads. The old app awaited fetchers directly and re-fetched the live API during hydration; historical Nuxt numbers therefore include a different data-loading path. Nuxt keeps default link and payload prefetching, so browser audits can include adjacent route payloads; native link defaults differ across frameworks. FAST retains its app-level raw-HTML post-build fill; Elena does not hydrate.
- HTML page weight is the response body alone, measured raw and locally gzip-compressed once per route. It excludes separately fetched JavaScript, CSS, images, JSON, and payload files. Smaller HTML does not imply a smaller full page download. Hydration serialization differs across React, Vue, Lit, FAST, and Elena; Elena has no hydration step.
- Lighthouse audits prerendered output in headless Chrome using the runner's Lighthouse defaults. Scores reflect script loading, hydration, DOM structure, content, and browser conditions; they are not a direct runtime-speed ranking. The scalar metrics come from the audit selected by median performance score, while per-metric statistics summarize all audits. SSR docs Lighthouse is not collected. A full run is rejected if a Lighthouse network audit records live Hacker News API requests.
- Build spread describes repeated builds. HTTP percentiles describe requests within one load run, not repeated-run spread. Output sizes and page weights are single observations. Streaming timing deltas follow the runner's definition; consult its source before interpreting them as flush counts or progressive rendering milestones.
- Framework versions are resolved from each app's installed packages, not inferred from manifest ranges. The old snapshot used Node 24.7.0; this refresh uses Node 24.22.3 because current Nuxt needs a newer runtime. Historical changes include runtime, dependency, and system-load differences and do not isolate upgrade effects.

## Add a framework

1. Create isolated apps in `apps/<name>` and `apps/hn-<name>`. Pin framework and peer versions exactly, check in npm lockfiles for isolated apps, and keep rendered content, fixture fetches, route count, and navigation behavior equivalent. Use a production SSR-capable setup with static prerendering for these suites.
2. Add entries to `FRAMEWORK_CONFIGS` and `HN_FRAMEWORK_CONFIGS` in `src/config.ts`, with unique ports, install/build/preview commands, output and cache directories, and the headline and peer packages whose exact versions must be recorded. Serve static output using the same preview tool. HN builds must honor `HN_API_BASE`.
3. Implement every shared route marker in `CROSS_FRAMEWORK_ROUTE_CHECKS` and `HN_ROUTE_CHECKS`; do not weaken those checks for one framework. Ensure the complete fixture page set is prerendered.
4. Extend result labels and the full-run completeness list in `scripts/update-benchmark-report.mjs`, and labels/order in `scripts/update-readme-bench.mjs`. Update the benchmark pages in both `docs/pages/benchmarks.ts` and `docs-ssr/pages/benchmarks.ts`, preserving SSR-only navigation.
5. Run the full suite, inspect raw route checks and results, regenerate reports, and describe differences in hydration, payloads, build work, and static output boundaries. Preserve historical blog posts as dated reports.

## Detailed results

<!-- BENCHMARK-REPORT:BEGIN -->

Measured at 2026-11-12T20:13:48.811Z; source commit `8fa3cf1`. Baseline: 2026-10-14T14:30:59.957Z, commit `95b6336`.

### Machine and run context

| Field | Value |
| --- | --- |
| timestamp | 2026-11-12T20:13:48.811Z |
| nodeVersion | v24.22.3 |
| platform | darwin |
| osVersion | 26.3 |
| pnpmVersion | 10.28.0 |
| toolVersions | {"lighthouse":"12.8.2","chrome-launcher":"1.2.1","serve":"14.2.6","autocannon":"8.0.0","tsx":"4.21.0","npm":"11.5.1","chrome":"154.0.8037.93"} |
| context | Browser, terminal, editor, sync services, local model servers, and other coding sessions remained open. Task-owned helpers and preview servers were stopped before timed work. Shared workstation; no claim of an idle or isolated run. |
| arch | arm64 |
| cpuModel | Apple M4 Max |
| cpuCount | 16 |
| memoryGB | 128 |
| loadAverage | [4.0263671875,5.44921875,6.3544921875] |
| commitSha | 8fa3cf1 |
| settings | {"buildRuns":3,"lighthouseRuns":3,"streamingRuns":5,"httpConnections":10,"httpDurationSeconds":10,"httpRunsPerRoute":1,"crossFramework":true,"hn":true,"buildCache":"cold","comparisonServing":"static files via serve","lighthousePreset":"default mobile simulated throttling"} |
| loadAverageEnd | [5.14013671875,6.21533203125,6.52099609375] |

Byte counts use B (not decimal KB). Build tables show repeated-run statistics. HTTP latency is whole-response latency; its percentiles describe requests in one load test, not variation between independent load tests. Lighthouse scalars come from the run selected by median performance score; per-metric spread is listed separately when recorded. Page weight and output size are single observations after the final build. Missing historical measures are marked “not recorded.”

### Minimal comparison: exact package versions

| App | Headline version | Resolved stack |
| --- | --- | --- |
| Litro (Lit) | 0.18.0 | @beatzball/litro@0.18.0, @beatzball/litro-router@0.3.2, lit@3.3.2, @lit-labs/ssr@3.3.1, @lit-labs/ssr-client@1.1.8, nitropack@2.13.4, vite@8.3.5 |
| Nuxt | 4.6.4 | nuxt@4.6.4, vue@3.5.45, nitropack@2.13.6, vite@8.3.5 |
| Next.js | 16.4.6 | next@16.4.6, react@19.3.1, react-dom@19.3.1 |
| TanStack Start | 1.169.5 | @tanstack/react-start@1.169.5, @tanstack/react-router@1.170.46, react@19.3.1, react-dom@19.3.1, vite@8.3.8 |

### Minimal comparison: build time

| App | Runs | Mean (ms) | Median (ms) | p95 (ms) | Std dev (ms) | Min (ms) | Max (ms) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Litro (Lit) | 3 | 1057 | 961 | 1271 | 152 | 939 | 1271 |
| Nuxt | 3 | 2559 | 2362 | 3413 | 632 | 1903 | 3413 |
| Next.js | 3 | 2109 | 2020 | 2303 | 138 | 2003 | 2303 |
| TanStack Start | 3 | 672 | 581 | 862 | 134 | 574 | 862 |

### Minimal comparison: output size

| App | Total (B) | Client JS (B) | Client CSS (B) | HTML (B) | Server (B) | Other (B) |
| --- | --- | --- | --- | --- | --- | --- |
| Litro (Lit) | 39687 | 33001 | 0 | 6454 | 0 | 232 |
| Nuxt | 214130 | 203892 | 4652 | 5272 | 0 | 314 |
| Next.js | 637904 | 578555 | 0 | 25566 | 0 | 33783 |
| TanStack Start | 345956 | 341679 | 0 | 4277 | 0 | 0 |

### Minimal comparison: HTML page weight

| App | Route | HTTP status | Raw HTML (B) | Gzip HTML (B) |
| --- | --- | --- | --- | --- |
| Litro (Lit) | / | 200 | 3247 | 1549 |
| Litro (Lit) | /blog/hello | 200 | 3207 | 1533 |
| Nuxt | / | 200 | 1582 | 758 |
| Nuxt | /blog/hello | 200 | 1588 | 755 |
| Next.js | / | 200 | 5195 | 1786 |
| Next.js | /blog/hello | 200 | 6189 | 1878 |
| TanStack Start | / | 200 | 2135 | 1135 |
| TanStack Start | /blog/hello | 200 | 2142 | 1144 |

### Minimal comparison: HTTP load

| App | Route | Load runs | Duration (s) | Connections | Requests | Requests/s (mean) | Bytes/s (mean) | Latency mean (ms) | p50 (ms) | p97.5 (ms) | p99 (ms) | Max (ms) | Non-2xx | Errors | Timeouts |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Litro (Lit) | / | 1 | 10 | 10 | 156158 | 15617.6 | 55571251.2 | 0.05 | 0 | 1 | 1 | 16 | 0 | 0 | 0 |
| Litro (Lit) | /blog/hello | 1 | 10 | 10 | 171886 | 15626.55 | 54989172.37 | 0.05 | 0 | 1 | 1 | 5 | 0 | 0 | 0 |
| Nuxt | / | 1 | 10 | 10 | 133328 | 13333.6 | 25253068.8 | 0.15 | 0 | 1 | 2 | 80 | 0 | 0 | 0 |
| Nuxt | /blog/hello | 1 | 10 | 10 | 153912 | 15392 | 29243801.6 | 0.05 | 0 | 1 | 1 | 3 | 0 | 0 | 0 |
| Next.js | / | 1 | 10 | 10 | 173550 | 15777.46 | 86885841.46 | 0.05 | 0 | 1 | 1 | 9 | 0 | 0 | 0 |
| Next.js | /blog/hello | 1 | 10 | 10 | 159798 | 14528.37 | 94452270.55 | 0.05 | 0 | 1 | 1 | 9 | 0 | 0 | 0 |
| TanStack Start | / | 1 | 10 | 10 | 154782 | 15480 | 37869977.6 | 0.05 | 0 | 1 | 1 | 13 | 0 | 0 | 0 |
| TanStack Start | /blog/hello | 1 | 10 | 10 | 159232 | 15924 | 39079116.8 | 0.05 | 0 | 1 | 1 | 8 | 0 | 0 | 0 |

### Minimal comparison: HTTP spread

| App | Route | Metric | Mean | Std dev | Min | Max |
| --- | --- | --- | --- | --- | --- | --- |
| Litro (Lit) | / | Latency (ms) | 0.05 | 0.33 | 1 | 16 |
| Litro (Lit) | / | Requests/s | 15617.6 | 780.5 | 13680 | 16320 |
| Litro (Lit) | / | Bytes/s | 55571251.2 | 2776909.66 | 48687120 | 58082880 |
| Litro (Lit) | /blog/hello | Latency (ms) | 0.05 | 0.23 | 1 | 5 |
| Litro (Lit) | /blog/hello | Requests/s | 15626.55 | 429.37 | 14444 | 16109 |
| Litro (Lit) | /blog/hello | Bytes/s | 54989172.37 | 1506244.38 | 50828436 | 56687571 |
| Nuxt | / | Latency (ms) | 0.15 | 0.96 | 1 | 80 |
| Nuxt | / | Requests/s | 13333.6 | 1868.54 | 8595 | 15187 |
| Nuxt | / | Bytes/s | 25253068.8 | 3535497.73 | 16278930 | 28764178 |
| Nuxt | /blog/hello | Latency (ms) | 0.05 | 0.22 | 1 | 3 |
| Nuxt | /blog/hello | Requests/s | 15392 | 326.05 | 14833 | 15787 |
| Nuxt | /blog/hello | Bytes/s | 29243801.6 | 619358.55 | 28182700 | 29995300 |
| Next.js | / | Latency (ms) | 0.05 | 0.23 | 1 | 9 |
| Next.js | / | Requests/s | 15777.46 | 580.22 | 14434 | 16403 |
| Next.js | / | Bytes/s | 86885841.46 | 3201472.29 | 79488038 | 90331321 |
| Next.js | /blog/hello | Latency (ms) | 0.05 | 0.22 | 1 | 9 |
| Next.js | /blog/hello | Requests/s | 14528.37 | 236.2 | 13946 | 14873 |
| Next.js | /blog/hello | Bytes/s | 94452270.55 | 1534690.49 | 90662946 | 96689373 |
| TanStack Start | / | Latency (ms) | 0.05 | 0.26 | 1 | 13 |
| TanStack Start | / | Requests/s | 15480 | 605.77 | 14281 | 16090 |
| TanStack Start | / | Bytes/s | 37869977.6 | 1482316.54 | 34945607 | 39372230 |
| TanStack Start | /blog/hello | Latency (ms) | 0.05 | 0.22 | 1 | 8 |
| TanStack Start | /blog/hello | Requests/s | 15924 | 360.61 | 15159 | 16347 |
| TanStack Start | /blog/hello | Bytes/s | 39079116.8 | 885154.61 | 37200186 | 40115538 |

### Minimal comparison: Lighthouse

| App | Route | Runs | Score (0–100) | FCP (ms) | LCP (ms) | CLS (unitless) | TBT (ms) | Speed Index (ms) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Litro (Lit) | / | 3 | 100 | 837.536 | 1368.072 | 0 | 0 | 837.536 |
| Litro (Lit) | /blog/hello | 3 | 100 | 837.65 | 1368.3 | 0 | 0 | 837.65 |
| Nuxt | / | 3 | 100 | 1351.281 | 1651.281 | 0 | 0 | 1351.281 |
| Nuxt | /blog/hello | 3 | 100 | 1351.767 | 1651.767 | 0 | 0 | 1351.767 |
| Next.js | / | 3 | 100 | 610.884 | 1857.768 | 0 | 6 | 610.884 |
| Next.js | /blog/hello | 3 | 100 | 614.066 | 1859.132 | 0 | 7 | 614.066 |
| TanStack Start | / | 3 | 100 | 616.817 | 1501.635 | 0 | 0 | 616.817 |
| TanStack Start | /blog/hello | 3 | 100 | 614.877 | 1501.753 | 0 | 0 | 614.877 |

### Minimal comparison: Lighthouse spread

| App | Route | Metric (units above) | Runs | Mean | Median | p95 | Std dev | Min | Max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Litro (Lit) | / | performance | 3 | 100 | 100 | 100 | 0 | 100 | 100 |
| Litro (Lit) | / | fcp | 3 | 917.2 | 848.844 | 1065.219 | 104.767 | 837.536 | 1065.219 |
| Litro (Lit) | / | lcp | 3 | 1220.552 | 1368.072 | 1368.17 | 208.695 | 925.413 | 1368.17 |
| Litro (Lit) | / | cls | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| Litro (Lit) | / | tbt | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| Litro (Lit) | / | speedIndex | 3 | 917.2 | 848.844 | 1065.219 | 104.767 | 837.536 | 1065.219 |
| Litro (Lit) | /blog/hello | performance | 3 | 100 | 100 | 100 | 0 | 100 | 100 |
| Litro (Lit) | /blog/hello | fcp | 3 | 883.731 | 837.65 | 1062.11 | 130.952 | 751.432 | 1062.11 |
| Litro (Lit) | /blog/hello | lcp | 3 | 1363.631 | 1365.014 | 1368.3 | 4.485 | 1357.579 | 1368.3 |
| Litro (Lit) | /blog/hello | cls | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| Litro (Lit) | /blog/hello | tbt | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| Litro (Lit) | /blog/hello | speedIndex | 3 | 883.731 | 837.65 | 1062.11 | 130.952 | 751.432 | 1062.11 |
| Nuxt | / | performance | 3 | 100 | 100 | 100 | 0 | 100 | 100 |
| Nuxt | / | fcp | 3 | 1351.619 | 1351.281 | 1352.404 | 0.557 | 1351.173 | 1352.404 |
| Nuxt | / | lcp | 3 | 1651.619 | 1651.281 | 1652.404 | 0.557 | 1651.173 | 1652.404 |
| Nuxt | / | cls | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| Nuxt | / | tbt | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| Nuxt | / | speedIndex | 3 | 1351.619 | 1351.281 | 1352.404 | 0.557 | 1351.173 | 1352.404 |
| Nuxt | /blog/hello | performance | 3 | 100 | 100 | 100 | 0 | 100 | 100 |
| Nuxt | /blog/hello | fcp | 3 | 1301.453 | 1351.127 | 1351.767 | 70.702 | 1201.466 | 1351.767 |
| Nuxt | /blog/hello | lcp | 3 | 1651.453 | 1651.466 | 1651.767 | 0.261 | 1651.127 | 1651.767 |
| Nuxt | /blog/hello | cls | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| Nuxt | /blog/hello | tbt | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| Nuxt | /blog/hello | speedIndex | 3 | 1301.453 | 1351.127 | 1351.767 | 70.702 | 1201.466 | 1351.767 |
| Next.js | / | performance | 3 | 100 | 100 | 100 | 0 | 100 | 100 |
| Next.js | / | fcp | 3 | 612.885 | 610.982 | 616.79 | 2.761 | 610.884 | 616.79 |
| Next.js | / | lcp | 3 | 1858.437 | 1857.965 | 1859.579 | 0.811 | 1857.768 | 1859.579 |
| Next.js | / | cls | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| Next.js | / | tbt | 3 | 6 | 6 | 6 | 0 | 6 | 6 |
| Next.js | / | speedIndex | 3 | 612.885 | 610.982 | 616.79 | 2.761 | 610.884 | 616.79 |
| Next.js | /blog/hello | performance | 3 | 100 | 100 | 100 | 0 | 100 | 100 |
| Next.js | /blog/hello | fcp | 3 | 614.02 | 614.036 | 614.066 | 0.046 | 613.958 | 614.066 |
| Next.js | /blog/hello | lcp | 3 | 1740.373 | 1859.132 | 1860.072 | 168.616 | 1501.915 | 1860.072 |
| Next.js | /blog/hello | cls | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| Next.js | /blog/hello | tbt | 3 | 6.333 | 7 | 8 | 1.7 | 4 | 8 |
| Next.js | /blog/hello | speedIndex | 3 | 614.02 | 614.036 | 614.066 | 0.046 | 613.958 | 614.066 |
| TanStack Start | / | performance | 3 | 100 | 100 | 100 | 0 | 100 | 100 |
| TanStack Start | / | fcp | 3 | 616.479 | 616.817 | 617.165 | 0.738 | 615.456 | 617.165 |
| TanStack Start | / | lcp | 3 | 1502.292 | 1502.329 | 1502.911 | 0.522 | 1501.635 | 1502.911 |
| TanStack Start | / | cls | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| TanStack Start | / | tbt | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| TanStack Start | / | speedIndex | 3 | 616.479 | 616.817 | 617.165 | 0.738 | 615.456 | 617.165 |
| TanStack Start | /blog/hello | performance | 3 | 100 | 100 | 100 | 0 | 100 | 100 |
| TanStack Start | /blog/hello | fcp | 3 | 615.86 | 616.23 | 616.474 | 0.703 | 614.877 | 616.474 |
| TanStack Start | /blog/hello | lcp | 3 | 1502.387 | 1502.46 | 1502.949 | 0.491 | 1501.753 | 1502.949 |
| TanStack Start | /blog/hello | cls | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| TanStack Start | /blog/hello | tbt | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| TanStack Start | /blog/hello | speedIndex | 3 | 615.86 | 616.23 | 616.474 | 0.703 | 614.877 | 616.474 |

### Minimal comparison: streaming

| App | Streaming |
| --- | --- |
| Litro (Lit) | N/A: prerendered static output; framework SSR is not measured |
| Nuxt | N/A: prerendered static output; framework SSR is not measured |
| Next.js | N/A: prerendered static output; framework SSR is not measured |
| TanStack Start | N/A: prerendered static output; framework SSR is not measured |

### HN comparison: exact package versions

| App | Headline version | Resolved stack |
| --- | --- | --- |
| Litro (Lit) | 0.18.0 | @beatzball/litro@0.18.0, @beatzball/litro-router@0.3.2, lit@3.3.2, @lit-labs/ssr@3.3.1, @lit-labs/ssr-client@1.1.8, nitropack@2.13.4, vite@8.3.5 |
| Litro (FAST) | 0.18.0 | @beatzball/litro@0.18.0, @beatzball/litro-router@0.3.2, @microsoft/fast-element@2.10.3, @microsoft/fast-ssr@1.0.0-beta.39, nitropack@2.13.4, vite@8.3.5 |
| Litro (Elena) | 0.18.0 | @beatzball/litro@0.18.0, @beatzball/litro-router@0.3.2, @elenajs/core@1.0.0, @elenajs/ssr@1.0.0-alpha.10, nitropack@2.13.4, vite@8.3.5 |
| Next.js | 16.4.6 | next@16.4.6, react@19.3.1, react-dom@19.3.1 |
| Nuxt | 4.6.4 | nuxt@4.6.4, vue@3.5.45, nitropack@2.13.6, vite@8.3.5 |
| TanStack Start | 1.169.5 | @tanstack/react-start@1.169.5, @tanstack/react-router@1.170.46, react@19.3.1, react-dom@19.3.1, vite@8.3.8 |

### HN comparison: build time

| App | Runs | Mean (ms) | Median (ms) | p95 (ms) | Std dev (ms) | Min (ms) | Max (ms) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Litro (Lit) | 3 | 1366 | 1330 | 1467 | 72 | 1302 | 1467 |
| Litro (FAST) | 3 | 1387 | 1383 | 1449 | 49 | 1330 | 1449 |
| Litro (Elena) | 3 | 1141 | 1137 | 1156 | 11 | 1129 | 1156 |
| Next.js | 3 | 2255 | 2162 | 2446 | 135 | 2157 | 2446 |
| Nuxt | 3 | 2337 | 2094 | 2851 | 364 | 2065 | 2851 |
| TanStack Start | 3 | 970 | 885 | 1168 | 140 | 857 | 1168 |

### HN comparison: output size

| App | Total (B) | Client JS (B) | Client CSS (B) | HTML (B) | Server (B) | Other (B) |
| --- | --- | --- | --- | --- | --- | --- |
| Litro (Lit) | 2439507 | 44041 | 8070 | 2387164 | 0 | 232 |
| Litro (FAST) | 2134561 | 79386 | 8070 | 2046873 | 0 | 232 |
| Litro (Elena) | 1892627 | 28611 | 8070 | 1855714 | 0 | 232 |
| Next.js | 7506647 | 570615 | 4035 | 2620633 | 0 | 4311364 |
| Nuxt | 2161365 | 222668 | 7581 | 992929 | 0 | 938187 |
| TanStack Start | 2254296 | 351878 | 4035 | 1898383 | 0 | 0 |

### HN comparison: HTML page weight

| App | Route | HTTP status | Raw HTML (B) | Gzip HTML (B) |
| --- | --- | --- | --- | --- |
| Litro (Lit) | / | 200 | 45252 | 8794 |
| Litro (Lit) | /ask | 200 | 55281 | 15189 |
| Litro (Lit) | /show | 200 | 68745 | 18653 |
| Litro (Lit) | /story/47760529 | 200 | 62162 | 14876 |
| Litro (Lit) | /user/divan | 200 | 11711 | 5399 |
| Litro (FAST) | / | 200 | 37974 | 8389 |
| Litro (FAST) | /ask | 200 | 48294 | 14907 |
| Litro (FAST) | /show | 200 | 58917 | 17605 |
| Litro (FAST) | /story/47760529 | 200 | 52221 | 11300 |
| Litro (FAST) | /user/divan | 200 | 11450 | 5287 |
| Litro (Elena) | / | 200 | 29393 | 8022 |
| Litro (Elena) | /ask | 200 | 40997 | 14503 |
| Litro (Elena) | /show | 200 | 50336 | 17068 |
| Litro (Elena) | /story/47760529 | 200 | 48797 | 10959 |
| Litro (Elena) | /user/divan | 200 | 10543 | 4928 |
| Next.js | / | 200 | 45951 | 6804 |
| Next.js | /ask | 200 | 35649 | 5169 |
| Next.js | /show | 200 | 44858 | 6084 |
| Next.js | /story/47760529 | 200 | 65628 | 16972 |
| Next.js | /user/divan | 200 | 7555 | 2145 |
| Nuxt | / | 200 | 15808 | 3952 |
| Nuxt | /ask | 200 | 12238 | 2713 |
| Nuxt | /show | 200 | 15039 | 3307 |
| Nuxt | /story/47760529 | 200 | 26748 | 9098 |
| Nuxt | /user/divan | 200 | 2183 | 930 |
| TanStack Start | / | 200 | 31458 | 8287 |
| TanStack Start | /ask | 200 | 42707 | 14814 |
| TanStack Start | /show | 200 | 52818 | 17259 |
| TanStack Start | /story/47760529 | 200 | 49833 | 11645 |
| TanStack Start | /user/divan | 200 | 10565 | 4954 |

### HN comparison: HTTP load

| App | Route | Load runs | Duration (s) | Connections | Requests | Requests/s (mean) | Bytes/s (mean) | Latency mean (ms) | p50 (ms) | p97.5 (ms) | p99 (ms) | Max (ms) | Non-2xx | Errors | Timeouts |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Litro (Lit) | / | 1 | 10 | 10 | 133212 | 13321.8 | 606955110.4 | 0.12 | 0 | 1 | 1 | 211 | 0 | 0 | 0 |
| Litro (Lit) | /ask | 1 | 10 | 10 | 129661 | 12966.4 | 720896000 | 0.13 | 0 | 1 | 2 | 29 | 0 | 0 | 0 |
| Litro (Lit) | /show | 1 | 10 | 10 | 129150 | 11741.46 | 810859054.55 | 0.13 | 0 | 1 | 1 | 4 | 0 | 0 | 0 |
| Litro (Lit) | /story/47760529 | 1 | 10 | 10 | 133322 | 13332 | 832988774.4 | 0.08 | 0 | 1 | 1 | 14 | 0 | 0 | 0 |
| Litro (Lit) | /user/divan | 1 | 10 | 10 | 155055 | 15506.8 | 186423705.6 | 0.06 | 0 | 1 | 1 | 111 | 0 | 0 | 0 |
| Litro (FAST) | / | 1 | 10 | 10 | 157690 | 14337.1 | 548786548.37 | 0.07 | 0 | 1 | 1 | 12 | 0 | 0 | 0 |
| Litro (FAST) | /ask | 1 | 10 | 10 | 155816 | 14165.46 | 688509300.37 | 0.06 | 0 | 1 | 1 | 11 | 0 | 0 | 0 |
| Litro (FAST) | /show | 1 | 10 | 10 | 140471 | 14048 | 831992627.2 | 0.06 | 0 | 1 | 1 | 12 | 0 | 0 | 0 |
| Litro (FAST) | /story/47760529 | 1 | 10 | 10 | 154287 | 14026.55 | 736839121.46 | 0.07 | 0 | 1 | 1 | 17 | 0 | 0 | 0 |
| Litro (FAST) | /user/divan | 1 | 10 | 10 | 172428 | 15675.28 | 184376599.28 | 0.05 | 0 | 1 | 1 | 14 | 0 | 0 | 0 |
| Litro (Elena) | / | 1 | 10 | 10 | 149337 | 14932.8 | 443626291.2 | 0.06 | 0 | 1 | 1 | 6 | 0 | 0 | 0 |
| Litro (Elena) | /ask | 1 | 10 | 10 | 161610 | 14692.73 | 606911022.55 | 0.05 | 0 | 1 | 1 | 14 | 0 | 0 | 0 |
| Litro (Elena) | /show | 1 | 10 | 10 | 141136 | 14112.8 | 714866688 | 0.07 | 0 | 1 | 1 | 9 | 0 | 0 | 0 |
| Litro (Elena) | /story/47760529 | 1 | 10 | 10 | 143306 | 14332 | 703856640 | 0.06 | 0 | 1 | 1 | 12 | 0 | 0 | 0 |
| Litro (Elena) | /user/divan | 1 | 10 | 10 | 158972 | 15897.6 | 172569395.2 | 0.04 | 0 | 1 | 1 | 5 | 0 | 0 | 0 |
| Next.js | / | 1 | 10 | 10 | 144809 | 14482.4 | 669830348.8 | 0.07 | 0 | 1 | 1 | 13 | 0 | 0 | 0 |
| Next.js | /ask | 1 | 10 | 10 | 149700 | 13609.1 | 489339438.55 | 0.06 | 0 | 1 | 1 | 10 | 0 | 0 | 0 |
| Next.js | /show | 1 | 10 | 10 | 146973 | 13363.28 | 603574644.37 | 0.07 | 0 | 1 | 1 | 7 | 0 | 0 | 0 |
| Next.js | /story/47760529 | 1 | 10 | 10 | 128638 | 11695.64 | 771251479.28 | 0.12 | 0 | 1 | 1 | 13 | 0 | 0 | 0 |
| Next.js | /user/divan | 1 | 10 | 10 | 160172 | 14562.55 | 114553949.1 | 0.05 | 0 | 1 | 1 | 11 | 0 | 0 | 0 |
| Nuxt | / | 1 | 10 | 10 | 171730 | 15612 | 251688029.1 | 0.05 | 0 | 1 | 1 | 16 | 0 | 0 | 0 |
| Nuxt | /ask | 1 | 10 | 10 | 171527 | 15593.82 | 195696453.82 | 0.05 | 0 | 1 | 1 | 10 | 0 | 0 | 0 |
| Nuxt | /show | 1 | 10 | 10 | 156765 | 15676 | 240661299.2 | 0.05 | 0 | 1 | 1 | 11 | 0 | 0 | 0 |
| Nuxt | /story/47760529 | 1 | 10 | 10 | 165391 | 15036 | 406883234.91 | 0.05 | 0 | 1 | 1 | 13 | 0 | 0 | 0 |
| Nuxt | /user/divan | 1 | 10 | 10 | 151886 | 15188.4 | 37899468.8 | 0.07 | 0 | 1 | 1 | 45 | 0 | 0 | 0 |
| TanStack Start | / | 1 | 10 | 10 | 151332 | 15132.8 | 480798310.4 | 0.06 | 0 | 1 | 1 | 14 | 0 | 0 | 0 |
| TanStack Start | /ask | 1 | 10 | 10 | 146782 | 14679.2 | 631400038.4 | 0.06 | 0 | 1 | 1 | 9 | 0 | 0 | 0 |
| TanStack Start | /show | 1 | 10 | 10 | 155622 | 14148 | 751757498.19 | 0.06 | 0 | 1 | 1 | 12 | 0 | 0 | 0 |
| TanStack Start | /story/47760529 | 1 | 10 | 10 | 140832 | 14084 | 706215936 | 0.07 | 0 | 1 | 1 | 8 | 0 | 0 | 0 |
| TanStack Start | /user/divan | 1 | 10 | 10 | 157250 | 15724.8 | 171062067.2 | 0.05 | 0 | 1 | 1 | 10 | 0 | 0 | 0 |

### HN comparison: HTTP spread

| App | Route | Metric | Mean | Std dev | Min | Max |
| --- | --- | --- | --- | --- | --- | --- |
| Litro (Lit) | / | Latency (ms) | 0.12 | 1.77 | 1 | 211 |
| Litro (Lit) | / | Requests/s | 13321.8 | 2550.96 | 5918 | 15055 |
| Litro (Lit) | / | Bytes/s | 606955110.4 | 116239421.34 | 269653670 | 685981075 |
| Litro (Lit) | /ask | Latency (ms) | 0.13 | 0.57 | 1 | 29 |
| Litro (Lit) | /ask | Requests/s | 12966.4 | 833.48 | 11460 | 14054 |
| Litro (Lit) | /ask | Bytes/s | 720896000 | 46334869.69 | 637107240 | 781318076 |
| Litro (Lit) | /show | Latency (ms) | 0.13 | 0.37 | 1 | 4 |
| Litro (Lit) | /show | Requests/s | 11741.46 | 432.24 | 10766 | 12274 |
| Litro (Lit) | /show | Bytes/s | 810859054.55 | 29760365.15 | 743478428 | 847617892 |
| Litro (Lit) | /story/47760529 | Latency (ms) | 0.08 | 0.3 | 1 | 14 |
| Litro (Lit) | /story/47760529 | Requests/s | 13332 | 293.75 | 12626 | 13667 |
| Litro (Lit) | /story/47760529 | Bytes/s | 832988774.4 | 18377098.4 | 788809350 | 853845825 |
| Litro (Lit) | /user/divan | Latency (ms) | 0.06 | 0.88 | 1 | 111 |
| Litro (Lit) | /user/divan | Requests/s | 15506.8 | 822.32 | 13492 | 16849 |
| Litro (Lit) | /user/divan | Bytes/s | 186423705.6 | 9870478.76 | 162227808 | 202592376 |
| Litro (FAST) | / | Latency (ms) | 0.07 | 0.29 | 1 | 12 |
| Litro (FAST) | / | Requests/s | 14337.1 | 738.16 | 12656 | 15016 |
| Litro (FAST) | / | Bytes/s | 548786548.37 | 28278900.58 | 484560272 | 574917592 |
| Litro (FAST) | /ask | Latency (ms) | 0.06 | 0.26 | 1 | 11 |
| Litro (FAST) | /ask | Requests/s | 14165.46 | 372.73 | 13329 | 14767 |
| Litro (FAST) | /ask | Bytes/s | 688509300.37 | 18236140.85 | 647882703 | 717779569 |
| Litro (FAST) | /show | Latency (ms) | 0.06 | 0.26 | 1 | 12 |
| Litro (FAST) | /show | Requests/s | 14048 | 403.07 | 13256 | 14527 |
| Litro (FAST) | /show | Bytes/s | 831992627.2 | 24028411.33 | 785152880 | 860434210 |
| Litro (FAST) | /story/47760529 | Latency (ms) | 0.07 | 0.36 | 1 | 17 |
| Litro (FAST) | /story/47760529 | Requests/s | 14026.55 | 813.21 | 11504 | 14482 |
| Litro (FAST) | /story/47760529 | Bytes/s | 736839121.46 | 42825320.93 | 604351136 | 760797388 |
| Litro (FAST) | /user/divan | Latency (ms) | 0.05 | 0.24 | 1 | 14 |
| Litro (FAST) | /user/divan | Requests/s | 15675.28 | 233.78 | 15252 | 16032 |
| Litro (FAST) | /user/divan | Bytes/s | 184376599.28 | 2739041.71 | 179409276 | 188584416 |
| Litro (Elena) | / | Latency (ms) | 0.06 | 0.23 | 1 | 6 |
| Litro (Elena) | / | Requests/s | 14932.8 | 571.1 | 13412 | 15471 |
| Litro (Elena) | / | Bytes/s | 443626291.2 | 17030000.91 | 398416872 | 459581526 |
| Litro (Elena) | /ask | Latency (ms) | 0.05 | 0.25 | 1 | 14 |
| Litro (Elena) | /ask | Requests/s | 14692.73 | 328.82 | 13935 | 15170 |
| Litro (Elena) | /ask | Bytes/s | 606911022.55 | 13560643.35 | 575654850 | 626672700 |
| Litro (Elena) | /show | Latency (ms) | 0.07 | 0.29 | 1 | 9 |
| Litro (Elena) | /show | Requests/s | 14112.8 | 561.41 | 12643 | 14567 |
| Litro (Elena) | /show | Bytes/s | 714866688 | 28507964.15 | 640355307 | 737803983 |
| Litro (Elena) | /story/47760529 | Latency (ms) | 0.06 | 0.26 | 1 | 12 |
| Litro (Elena) | /story/47760529 | Requests/s | 14332 | 275.16 | 13840 | 14822 |
| Litro (Elena) | /story/47760529 | Bytes/s | 703856640 | 13568832.75 | 679682400 | 727908420 |
| Litro (Elena) | /user/divan | Latency (ms) | 0.04 | 0.2 | 1 | 5 |
| Litro (Elena) | /user/divan | Requests/s | 15897.6 | 278.1 | 15296 | 16233 |
| Litro (Elena) | /user/divan | Bytes/s | 172569395.2 | 3027422.74 | 166053376 | 176225448 |
| Next.js | / | Latency (ms) | 0.07 | 0.28 | 1 | 13 |
| Next.js | / | Requests/s | 14482.4 | 751.3 | 12698 | 15093 |
| Next.js | / | Bytes/s | 669830348.8 | 34758712.81 | 587460272 | 698262552 |
| Next.js | /ask | Latency (ms) | 0.06 | 0.26 | 1 | 10 |
| Next.js | /ask | Requests/s | 13609.1 | 234.05 | 13069 | 13944 |
| Next.js | /ask | Bytes/s | 489339438.55 | 8400379.98 | 469961240 | 501426240 |
| Next.js | /show | Latency (ms) | 0.07 | 0.27 | 1 | 7 |
| Next.js | /show | Requests/s | 13363.28 | 167.8 | 13024 | 13660 |
| Next.js | /show | Bytes/s | 603574644.37 | 7571597.03 | 588294080 | 617022200 |
| Next.js | /story/47760529 | Latency (ms) | 0.12 | 0.38 | 1 | 13 |
| Next.js | /story/47760529 | Requests/s | 11695.64 | 487.54 | 10394 | 12368 |
| Next.js | /story/47760529 | Bytes/s | 771251479.28 | 32142017.73 | 685421936 | 815595392 |
| Next.js | /user/divan | Latency (ms) | 0.05 | 0.23 | 1 | 11 |
| Next.js | /user/divan | Requests/s | 14562.55 | 171.55 | 14283 | 14921 |
| Next.js | /user/divan | Bytes/s | 114553949.1 | 1350152.55 | 112364361 | 117383507 |
| Nuxt | / | Latency (ms) | 0.05 | 0.23 | 1 | 16 |
| Nuxt | / | Requests/s | 15612 | 487.06 | 14196 | 16135 |
| Nuxt | / | Bytes/s | 251688029.1 | 7836884.24 | 228853716 | 260112335 |
| Nuxt | /ask | Latency (ms) | 0.05 | 0.25 | 1 | 10 |
| Nuxt | /ask | Requests/s | 15593.82 | 532.33 | 14312 | 16109 |
| Nuxt | /ask | Bytes/s | 195696453.82 | 6671309.31 | 179629912 | 202184059 |
| Nuxt | /show | Latency (ms) | 0.05 | 0.22 | 1 | 11 |
| Nuxt | /show | Requests/s | 15676 | 180.35 | 15325 | 15960 |
| Nuxt | /show | Bytes/s | 240661299.2 | 2775014.34 | 235269400 | 245017920 |
| Nuxt | /story/47760529 | Latency (ms) | 0.05 | 0.23 | 1 | 13 |
| Nuxt | /story/47760529 | Requests/s | 15036 | 344.08 | 14397 | 15482 |
| Nuxt | /story/47760529 | Bytes/s | 406883234.91 | 9316107.53 | 389597217 | 418958402 |
| Nuxt | /user/divan | Latency (ms) | 0.07 | 0.55 | 1 | 45 |
| Nuxt | /user/divan | Requests/s | 15188.4 | 962.99 | 13754 | 16471 |
| Nuxt | /user/divan | Bytes/s | 37899468.8 | 2402520.18 | 34316230 | 41095145 |
| TanStack Start | / | Latency (ms) | 0.06 | 0.25 | 1 | 14 |
| TanStack Start | / | Requests/s | 15132.8 | 568.06 | 13495 | 15620 |
| TanStack Start | / | Bytes/s | 480798310.4 | 18031696.57 | 428749645 | 496263020 |
| TanStack Start | /ask | Latency (ms) | 0.06 | 0.24 | 1 | 9 |
| TanStack Start | /ask | Requests/s | 14679.2 | 286.61 | 14189 | 15135 |
| TanStack Start | /ask | Bytes/s | 631400038.4 | 12326455.77 | 610410780 | 651107700 |
| TanStack Start | /show | Latency (ms) | 0.06 | 0.26 | 1 | 12 |
| TanStack Start | /show | Requests/s | 14148 | 243.06 | 13629 | 14499 |
| TanStack Start | /show | Bytes/s | 751757498.19 | 12864296.73 | 724122399 | 770346369 |
| TanStack Start | /story/47760529 | Latency (ms) | 0.07 | 0.3 | 1 | 8 |
| TanStack Start | /story/47760529 | Requests/s | 14084 | 724.25 | 12010 | 14632 |
| TanStack Start | /story/47760529 | Bytes/s | 706215936 | 36395746.7 | 602253460 | 733736272 |
| TanStack Start | /user/divan | Latency (ms) | 0.05 | 0.22 | 1 | 10 |
| TanStack Start | /user/divan | Requests/s | 15724.8 | 194.08 | 15275 | 15959 |
| TanStack Start | /user/divan | Bytes/s | 171062067.2 | 2124983.96 | 166161450 | 173602002 |

### HN comparison: Lighthouse

| App | Route | Runs | Score (0–100) | FCP (ms) | LCP (ms) | CLS (unitless) | TBT (ms) | Speed Index (ms) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Litro (Lit) | / | 3 | 97 | 1372.779 | 1521.935 | 0.103 | 0 | 1372.779 |
| Litro (Lit) | /ask | 3 | 99 | 1367.472 | 1670.707 | 0 | 0 | 1367.472 |
| Litro (Lit) | /show | 3 | 99 | 1366.013 | 1669.52 | 0 | 0 | 1366.013 |
| Litro (Lit) | /story/47760529 | 3 | 88 | 1279.57 | 1657.855 | 0.236 | 0 | 1279.57 |
| Litro (Lit) | /user/divan | 3 | 100 | 988.49 | 1669.577 | 0 | 0 | 988.49 |
| Litro (FAST) | / | 3 | 99 | 1371.057 | 1671.743 | 0 | 0 | 1371.057 |
| Litro (FAST) | /ask | 3 | 99 | 1506.691 | 1811.921 | 0 | 0 | 1506.691 |
| Litro (FAST) | /show | 3 | 99 | 1505.663 | 1809.551 | 0 | 0 | 1505.663 |
| Litro (FAST) | /story/47760529 | 3 | 100 | 1294 | 1519.666 | 0 | 0 | 1294 |
| Litro (FAST) | /user/divan | 3 | 100 | 1281.485 | 1511.314 | 0 | 0 | 1281.485 |
| Litro (Elena) | / | 3 | 100 | 1056.668 | 1211.89 | 0 | 0 | 1056.668 |
| Litro (Elena) | /ask | 3 | 100 | 1219.166 | 1367.887 | 0 | 0 | 1219.166 |
| Litro (Elena) | /show | 3 | 99 | 1221.085 | 1367.78 | 0.067 | 0 | 1221.085 |
| Litro (Elena) | /story/47760529 | 3 | 100 | 1068.802 | 1369.882 | 0 | 0 | 1068.802 |
| Litro (Elena) | /user/divan | 3 | 100 | 1132.125 | 1362.5 | 0 | 0 | 1132.125 |
| Next.js | / | 3 | 100 | 753.396 | 1861.396 | 0 | 8 | 753.396 |
| Next.js | /ask | 3 | 100 | 752.358 | 1860.358 | 0 | 8 | 752.358 |
| Next.js | /show | 3 | 100 | 752.076 | 1859.076 | 0 | 7 | 752.076 |
| Next.js | /story/47760529 | 3 | 100 | 752.113 | 1858.113 | 0 | 6 | 752.113 |
| Next.js | /user/divan | 3 | 100 | 752.388 | 1858.388 | 0 | 6 | 752.388 |
| Nuxt | / | 3 | 99 | 1502 | 1652 | 0 | 0 | 1502 |
| Nuxt | /ask | 3 | 99 | 1501.78 | 1801.78 | 0 | 0 | 1501.78 |
| Nuxt | /show | 3 | 99 | 1501.611 | 1801.611 | 0 | 0 | 1501.611 |
| Nuxt | /story/47760529 | 3 | 99 | 1501.913 | 1651.913 | 0 | 4.5 | 1501.913 |
| Nuxt | /user/divan | 3 | 99 | 1501.798 | 1651.798 | 0 | 0 | 1501.798 |
| TanStack Start | / | 3 | 100 | 752.008 | 1652.008 | 0 | 0 | 752.008 |
| TanStack Start | /ask | 3 | 100 | 902.339 | 1802.339 | 0 | 0 | 902.339 |
| TanStack Start | /show | 3 | 100 | 902.259 | 1802.259 | 0 | 0 | 902.259 |
| TanStack Start | /story/47760529 | 3 | 100 | 752.062 | 1652.062 | 0 | 0 | 752.062 |
| TanStack Start | /user/divan | 3 | 100 | 751.823 | 1651.823 | 0 | 0 | 751.823 |

### HN comparison: Lighthouse spread

| App | Route | Metric (units above) | Runs | Mean | Median | p95 | Std dev | Min | Max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Litro (Lit) | / | performance | 3 | 98 | 97 | 100 | 1.414 | 97 | 100 |
| Litro (Lit) | / | fcp | 3 | 1265.463 | 1218.47 | 1372.78 | 76.079 | 1205.14 | 1372.78 |
| Litro (Lit) | / | lcp | 3 | 1517.45 | 1521.705 | 1521.935 | 6.181 | 1508.71 | 1521.935 |
| Litro (Lit) | / | cls | 3 | 0.068 | 0.103 | 0.103 | 0.048 | 0 | 0.103 |
| Litro (Lit) | / | tbt | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| Litro (Lit) | / | speedIndex | 3 | 1265.463 | 1218.47 | 1372.78 | 76.079 | 1205.14 | 1372.78 |
| Litro (Lit) | /ask | performance | 3 | 95.667 | 99 | 100 | 5.437 | 88 | 100 |
| Litro (Lit) | /ask | fcp | 3 | 1366.931 | 1367.472 | 1518.089 | 123.641 | 1215.233 | 1518.089 |
| Litro (Lit) | /ask | lcp | 3 | 1669.96 | 1670.707 | 1671.466 | 1.623 | 1667.707 | 1671.466 |
| Litro (Lit) | /ask | cls | 3 | 0.074 | 0 | 0.222 | 0.104 | 0 | 0.222 |
| Litro (Lit) | /ask | tbt | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| Litro (Lit) | /ask | speedIndex | 3 | 1366.931 | 1367.472 | 1518.089 | 123.641 | 1215.233 | 1518.089 |
| Litro (Lit) | /show | performance | 3 | 98.667 | 99 | 100 | 1.247 | 97 | 100 |
| Litro (Lit) | /show | fcp | 3 | 1312.427 | 1354.367 | 1366.013 | 67.715 | 1216.899 | 1366.013 |
| Litro (Lit) | /show | lcp | 3 | 1666.623 | 1669.52 | 1672.798 | 6.553 | 1657.551 | 1672.798 |
| Litro (Lit) | /show | cls | 3 | 0.033 | 0 | 0.098 | 0.046 | 0 | 0.098 |
| Litro (Lit) | /show | tbt | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| Litro (Lit) | /show | speedIndex | 3 | 1312.427 | 1354.367 | 1366.013 | 67.715 | 1216.899 | 1366.013 |
| Litro (Lit) | /story/47760529 | performance | 3 | 92 | 88 | 100 | 5.657 | 88 | 100 |
| Litro (Lit) | /story/47760529 | fcp | 3 | 1265.295 | 1279.57 | 1293.757 | 30.77 | 1222.557 | 1293.757 |
| Litro (Lit) | /story/47760529 | lcp | 3 | 1669.077 | 1672.136 | 1677.24 | 8.204 | 1657.855 | 1677.24 |
| Litro (Lit) | /story/47760529 | cls | 3 | 0.157 | 0.236 | 0.236 | 0.111 | 0 | 0.236 |
| Litro (Lit) | /story/47760529 | tbt | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| Litro (Lit) | /story/47760529 | speedIndex | 3 | 1265.295 | 1279.57 | 1293.757 | 30.77 | 1222.557 | 1293.757 |
| Litro (Lit) | /user/divan | performance | 3 | 99.667 | 100 | 100 | 0.471 | 99 | 100 |
| Litro (Lit) | /user/divan | fcp | 3 | 1140.351 | 988.709 | 1443.854 | 214.609 | 988.49 | 1443.854 |
| Litro (Lit) | /user/divan | lcp | 3 | 1670.434 | 1670.624 | 1671.101 | 0.637 | 1669.577 | 1671.101 |
| Litro (Lit) | /user/divan | cls | 3 | 0.002 | 0 | 0.006 | 0.003 | 0 | 0.006 |
| Litro (Lit) | /user/divan | tbt | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| Litro (Lit) | /user/divan | speedIndex | 3 | 1140.351 | 988.709 | 1443.854 | 214.609 | 988.49 | 1443.854 |
| Litro (FAST) | / | performance | 3 | 99.333 | 99 | 100 | 0.471 | 99 | 100 |
| Litro (FAST) | / | fcp | 3 | 1365.69 | 1370.531 | 1371.057 | 7.221 | 1355.482 | 1371.057 |
| Litro (FAST) | / | lcp | 3 | 1667.365 | 1671.375 | 1671.743 | 5.934 | 1658.976 | 1671.743 |
| Litro (FAST) | / | cls | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| Litro (FAST) | / | tbt | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| Litro (FAST) | / | speedIndex | 3 | 1365.69 | 1370.531 | 1371.057 | 7.221 | 1355.482 | 1371.057 |
| Litro (FAST) | /ask | performance | 3 | 99 | 99 | 99 | 0 | 99 | 99 |
| Litro (FAST) | /ask | fcp | 3 | 1510.144 | 1506.691 | 1518.55 | 5.976 | 1505.189 | 1518.55 |
| Litro (FAST) | /ask | lcp | 3 | 1813.303 | 1811.921 | 1819.401 | 4.522 | 1808.586 | 1819.401 |
| Litro (FAST) | /ask | cls | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| Litro (FAST) | /ask | tbt | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| Litro (FAST) | /ask | speedIndex | 3 | 1510.144 | 1506.691 | 1518.55 | 5.976 | 1505.189 | 1518.55 |
| Litro (FAST) | /show | performance | 3 | 99 | 99 | 99 | 0 | 99 | 99 |
| Litro (FAST) | /show | fcp | 3 | 1511.975 | 1507.547 | 1522.714 | 7.632 | 1505.663 | 1522.714 |
| Litro (FAST) | /show | lcp | 3 | 1815.522 | 1813.397 | 1823.618 | 5.936 | 1809.551 | 1823.618 |
| Litro (FAST) | /show | cls | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| Litro (FAST) | /show | tbt | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| Litro (FAST) | /show | speedIndex | 3 | 1511.975 | 1507.547 | 1522.714 | 7.632 | 1505.663 | 1522.714 |
| Litro (FAST) | /story/47760529 | performance | 3 | 100 | 100 | 100 | 0 | 100 | 100 |
| Litro (FAST) | /story/47760529 | fcp | 3 | 1295.999 | 1295.93 | 1298.067 | 1.661 | 1294 | 1298.067 |
| Litro (FAST) | /story/47760529 | lcp | 3 | 1520.332 | 1519.756 | 1521.574 | 0.879 | 1519.666 | 1521.574 |
| Litro (FAST) | /story/47760529 | cls | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| Litro (FAST) | /story/47760529 | tbt | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| Litro (FAST) | /story/47760529 | speedIndex | 3 | 1295.999 | 1295.93 | 1298.067 | 1.661 | 1294 | 1298.067 |
| Litro (FAST) | /user/divan | performance | 3 | 100 | 100 | 100 | 0 | 100 | 100 |
| Litro (FAST) | /user/divan | fcp | 3 | 1263.841 | 1281.485 | 1293.372 | 33.709 | 1216.665 | 1293.372 |
| Litro (FAST) | /user/divan | lcp | 3 | 1515.491 | 1517.496 | 1517.664 | 2.955 | 1511.314 | 1517.664 |
| Litro (FAST) | /user/divan | cls | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| Litro (FAST) | /user/divan | tbt | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| Litro (FAST) | /user/divan | speedIndex | 3 | 1263.841 | 1281.485 | 1293.372 | 33.709 | 1216.665 | 1293.372 |
| Litro (Elena) | / | performance | 3 | 100 | 100 | 100 | 0 | 100 | 100 |
| Litro (Elena) | / | fcp | 3 | 1061.338 | 1057.642 | 1069.706 | 5.93 | 1056.668 | 1069.706 |
| Litro (Elena) | / | lcp | 3 | 1264.562 | 1217.941 | 1363.856 | 70.255 | 1211.89 | 1363.856 |
| Litro (Elena) | / | cls | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| Litro (Elena) | / | tbt | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| Litro (Elena) | / | speedIndex | 3 | 1061.338 | 1057.642 | 1069.706 | 5.93 | 1056.668 | 1069.706 |
| Litro (Elena) | /ask | performance | 3 | 100 | 100 | 100 | 0 | 100 | 100 |
| Litro (Elena) | /ask | fcp | 3 | 1219.314 | 1219.166 | 1219.871 | 0.408 | 1218.906 | 1219.871 |
| Litro (Elena) | /ask | lcp | 3 | 1368.641 | 1368.162 | 1369.875 | 0.879 | 1367.887 | 1369.875 |
| Litro (Elena) | /ask | cls | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| Litro (Elena) | /ask | tbt | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| Litro (Elena) | /ask | speedIndex | 3 | 1219.314 | 1219.166 | 1219.871 | 0.408 | 1218.906 | 1219.871 |
| Litro (Elena) | /show | performance | 3 | 99.333 | 99 | 100 | 0.471 | 99 | 100 |
| Litro (Elena) | /show | fcp | 3 | 1219.936 | 1221.085 | 1221.356 | 1.821 | 1217.366 | 1221.356 |
| Litro (Elena) | /show | lcp | 3 | 1368.025 | 1368.142 | 1368.154 | 0.174 | 1367.78 | 1368.154 |
| Litro (Elena) | /show | cls | 3 | 0.045 | 0.067 | 0.067 | 0.032 | 0 | 0.067 |
| Litro (Elena) | /show | tbt | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| Litro (Elena) | /show | speedIndex | 3 | 1219.936 | 1221.085 | 1221.356 | 1.821 | 1217.366 | 1221.356 |
| Litro (Elena) | /story/47760529 | performance | 3 | 100 | 100 | 100 | 0 | 100 | 100 |
| Litro (Elena) | /story/47760529 | fcp | 3 | 1118.925 | 1143.619 | 1144.356 | 35.444 | 1068.802 | 1144.356 |
| Litro (Elena) | /story/47760529 | lcp | 3 | 1368.839 | 1369.491 | 1369.882 | 1.21 | 1367.142 | 1369.882 |
| Litro (Elena) | /story/47760529 | cls | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| Litro (Elena) | /story/47760529 | tbt | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| Litro (Elena) | /story/47760529 | speedIndex | 3 | 1118.925 | 1143.619 | 1144.356 | 35.444 | 1068.802 | 1144.356 |
| Litro (Elena) | /user/divan | performance | 3 | 100 | 100 | 100 | 0 | 100 | 100 |
| Litro (Elena) | /user/divan | fcp | 3 | 1113.215 | 1132.125 | 1141.851 | 33.853 | 1065.67 | 1141.851 |
| Litro (Elena) | /user/divan | lcp | 3 | 1365.213 | 1366.468 | 1366.671 | 1.92 | 1362.5 | 1366.671 |
| Litro (Elena) | /user/divan | cls | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| Litro (Elena) | /user/divan | tbt | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| Litro (Elena) | /user/divan | speedIndex | 3 | 1113.215 | 1132.125 | 1141.851 | 33.853 | 1065.67 | 1141.851 |
| Next.js | / | performance | 3 | 100 | 100 | 100 | 0 | 100 | 100 |
| Next.js | / | fcp | 3 | 753.041 | 752.936 | 753.396 | 0.258 | 752.791 | 753.396 |
| Next.js | / | lcp | 3 | 1860.374 | 1859.936 | 1861.396 | 0.725 | 1859.791 | 1861.396 |
| Next.js | / | cls | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| Next.js | / | tbt | 3 | 7.333 | 7 | 8 | 0.471 | 7 | 8 |
| Next.js | / | speedIndex | 3 | 753.041 | 752.936 | 753.396 | 0.258 | 752.791 | 753.396 |
| Next.js | /ask | performance | 3 | 100 | 100 | 100 | 0 | 100 | 100 |
| Next.js | /ask | fcp | 3 | 752.548 | 752.584 | 752.702 | 0.143 | 752.358 | 752.702 |
| Next.js | /ask | lcp | 3 | 1859.548 | 1859.702 | 1860.358 | 0.732 | 1858.584 | 1860.358 |
| Next.js | /ask | cls | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| Next.js | /ask | tbt | 3 | 7 | 7 | 8 | 0.816 | 6 | 8 |
| Next.js | /ask | speedIndex | 3 | 752.548 | 752.584 | 752.702 | 0.143 | 752.358 | 752.702 |
| Next.js | /show | performance | 3 | 100 | 100 | 100 | 0 | 100 | 100 |
| Next.js | /show | fcp | 3 | 751.915 | 751.838 | 752.077 | 0.114 | 751.832 | 752.077 |
| Next.js | /show | lcp | 3 | 1858.915 | 1858.838 | 1859.076 | 0.114 | 1858.832 | 1859.076 |
| Next.js | /show | cls | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| Next.js | /show | tbt | 3 | 7 | 7 | 7 | 0 | 7 | 7 |
| Next.js | /show | speedIndex | 3 | 751.915 | 751.838 | 752.077 | 0.114 | 751.832 | 752.077 |
| Next.js | /story/47760529 | performance | 3 | 100 | 100 | 100 | 0 | 100 | 100 |
| Next.js | /story/47760529 | fcp | 3 | 752.284 | 752.262 | 752.478 | 0.15 | 752.113 | 752.478 |
| Next.js | /story/47760529 | lcp | 3 | 1858.951 | 1859.262 | 1859.478 | 0.599 | 1858.113 | 1859.478 |
| Next.js | /story/47760529 | cls | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| Next.js | /story/47760529 | tbt | 3 | 6.667 | 7 | 7 | 0.471 | 6 | 7 |
| Next.js | /story/47760529 | speedIndex | 3 | 752.284 | 752.262 | 752.478 | 0.15 | 752.113 | 752.478 |
| Next.js | /user/divan | performance | 3 | 100 | 100 | 100 | 0 | 100 | 100 |
| Next.js | /user/divan | fcp | 3 | 752.311 | 752.388 | 752.631 | 0.298 | 751.913 | 752.631 |
| Next.js | /user/divan | lcp | 3 | 1689.644 | 1857.913 | 1858.388 | 238.304 | 1352.631 | 1858.388 |
| Next.js | /user/divan | cls | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| Next.js | /user/divan | tbt | 3 | 5.5 | 6 | 6 | 0.707 | 4.5 | 6 |
| Next.js | /user/divan | speedIndex | 3 | 752.311 | 752.388 | 752.631 | 0.298 | 751.913 | 752.631 |
| Nuxt | / | performance | 3 | 99 | 99 | 99 | 0 | 99 | 99 |
| Nuxt | / | fcp | 3 | 1502.096 | 1502 | 1502.354 | 0.184 | 1501.934 | 1502.354 |
| Nuxt | / | lcp | 3 | 1702.096 | 1652 | 1802.354 | 70.893 | 1651.934 | 1802.354 |
| Nuxt | / | cls | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| Nuxt | / | tbt | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| Nuxt | / | speedIndex | 3 | 1502.096 | 1502 | 1502.354 | 0.184 | 1501.934 | 1502.354 |
| Nuxt | /ask | performance | 3 | 99 | 99 | 99 | 0 | 99 | 99 |
| Nuxt | /ask | fcp | 3 | 1501.844 | 1501.78 | 1501.989 | 0.103 | 1501.761 | 1501.989 |
| Nuxt | /ask | lcp | 3 | 1801.844 | 1801.78 | 1801.989 | 0.103 | 1801.761 | 1801.989 |
| Nuxt | /ask | cls | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| Nuxt | /ask | tbt | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| Nuxt | /ask | speedIndex | 3 | 1501.844 | 1501.78 | 1501.989 | 0.103 | 1501.761 | 1501.989 |
| Nuxt | /show | performance | 3 | 99 | 99 | 99 | 0 | 99 | 99 |
| Nuxt | /show | fcp | 3 | 1501.544 | 1501.611 | 1501.685 | 0.15 | 1501.337 | 1501.685 |
| Nuxt | /show | lcp | 3 | 1751.544 | 1801.611 | 1801.685 | 70.858 | 1651.337 | 1801.685 |
| Nuxt | /show | cls | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| Nuxt | /show | tbt | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| Nuxt | /show | speedIndex | 3 | 1501.544 | 1501.611 | 1501.685 | 0.15 | 1501.337 | 1501.685 |
| Nuxt | /story/47760529 | performance | 3 | 99 | 99 | 99 | 0 | 99 | 99 |
| Nuxt | /story/47760529 | fcp | 3 | 1501.739 | 1501.729 | 1501.913 | 0.137 | 1501.577 | 1501.913 |
| Nuxt | /story/47760529 | lcp | 3 | 1651.739 | 1651.729 | 1651.913 | 0.137 | 1651.577 | 1651.913 |
| Nuxt | /story/47760529 | cls | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| Nuxt | /story/47760529 | tbt | 3 | 3.333 | 3 | 4.5 | 0.85 | 2.5 | 4.5 |
| Nuxt | /story/47760529 | speedIndex | 3 | 1501.739 | 1501.729 | 1501.913 | 0.137 | 1501.577 | 1501.913 |
| Nuxt | /user/divan | performance | 3 | 99 | 99 | 99 | 0 | 99 | 99 |
| Nuxt | /user/divan | fcp | 3 | 1502.014 | 1502.046 | 1502.198 | 0.165 | 1501.798 | 1502.198 |
| Nuxt | /user/divan | lcp | 3 | 1652.014 | 1652.046 | 1652.198 | 0.165 | 1651.798 | 1652.198 |
| Nuxt | /user/divan | cls | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| Nuxt | /user/divan | tbt | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| Nuxt | /user/divan | speedIndex | 3 | 1502.014 | 1502.046 | 1502.198 | 0.165 | 1501.798 | 1502.198 |
| TanStack Start | / | performance | 3 | 100 | 100 | 100 | 0 | 100 | 100 |
| TanStack Start | / | fcp | 3 | 752.797 | 752.008 | 754.642 | 1.309 | 751.741 | 754.642 |
| TanStack Start | / | lcp | 3 | 1652.797 | 1652.008 | 1654.642 | 1.309 | 1651.741 | 1654.642 |
| TanStack Start | / | cls | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| TanStack Start | / | tbt | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| TanStack Start | / | speedIndex | 3 | 752.797 | 752.008 | 754.642 | 1.309 | 751.741 | 754.642 |
| TanStack Start | /ask | performance | 3 | 100 | 100 | 100 | 0 | 100 | 100 |
| TanStack Start | /ask | fcp | 3 | 902.069 | 901.942 | 902.339 | 0.191 | 901.926 | 902.339 |
| TanStack Start | /ask | lcp | 3 | 1802.069 | 1801.943 | 1802.339 | 0.191 | 1801.926 | 1802.339 |
| TanStack Start | /ask | cls | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| TanStack Start | /ask | tbt | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| TanStack Start | /ask | speedIndex | 3 | 902.069 | 901.942 | 902.339 | 0.191 | 901.926 | 902.339 |
| TanStack Start | /show | performance | 3 | 100 | 100 | 100 | 0 | 100 | 100 |
| TanStack Start | /show | fcp | 3 | 902.366 | 902.382 | 902.457 | 0.081 | 902.26 | 902.457 |
| TanStack Start | /show | lcp | 3 | 1802.366 | 1802.382 | 1802.457 | 0.081 | 1802.259 | 1802.457 |
| TanStack Start | /show | cls | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| TanStack Start | /show | tbt | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| TanStack Start | /show | speedIndex | 3 | 902.366 | 902.382 | 902.457 | 0.081 | 902.26 | 902.457 |
| TanStack Start | /story/47760529 | performance | 3 | 100 | 100 | 100 | 0 | 100 | 100 |
| TanStack Start | /story/47760529 | fcp | 3 | 752.091 | 752.068 | 752.144 | 0.037 | 752.062 | 752.144 |
| TanStack Start | /story/47760529 | lcp | 3 | 1652.091 | 1652.068 | 1652.144 | 0.037 | 1652.062 | 1652.144 |
| TanStack Start | /story/47760529 | cls | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| TanStack Start | /story/47760529 | tbt | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| TanStack Start | /story/47760529 | speedIndex | 3 | 752.091 | 752.068 | 752.144 | 0.037 | 752.062 | 752.144 |
| TanStack Start | /user/divan | performance | 3 | 99.667 | 100 | 100 | 0.471 | 99 | 100 |
| TanStack Start | /user/divan | fcp | 3 | 1004.977 | 751.823 | 1511.6 | 358.237 | 751.508 | 1511.6 |
| TanStack Start | /user/divan | lcp | 3 | 1654.977 | 1651.823 | 1661.6 | 4.685 | 1651.507 | 1661.6 |
| TanStack Start | /user/divan | cls | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| TanStack Start | /user/divan | tbt | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| TanStack Start | /user/divan | speedIndex | 3 | 1004.977 | 751.823 | 1511.6 | 358.237 | 751.508 | 1511.6 |

### HN comparison: streaming

| App | Streaming |
| --- | --- |
| Litro (Lit) | N/A: prerendered static output; framework SSR is not measured |
| Litro (FAST) | N/A: prerendered static output; framework SSR is not measured |
| Litro (Elena) | N/A: prerendered static output; framework SSR is not measured |
| Next.js | N/A: prerendered static output; framework SSR is not measured |
| Nuxt | N/A: prerendered static output; framework SSR is not measured |
| TanStack Start | N/A: prerendered static output; framework SSR is not measured |

### Docs: build time

| App | Runs | Mean (ms) | Median (ms) | p95 (ms) | Std dev (ms) | Min (ms) | Max (ms) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Litro docs SSG | 3 | 9758 | 9892 | 10070 | 323 | 9313 | 10070 |
| Litro docs SSR | 3 | 3841 | 3841 | 3864 | 18 | 3819 | 3864 |

### Docs: output size

| App | Total (B) | Client JS (B) | Client CSS (B) | HTML (B) | Server (B) | Other (B) |
| --- | --- | --- | --- | --- | --- | --- |
| Litro docs SSG | 14941817 | 1305760 | 14205 | 8195307 | 0 | 5426545 |
| Litro docs SSR | 14722892 | 1329055 | 0 | 0 | 7072972 | 6320865 |

### Docs: HTML page weight

| App | Route | HTTP status | Raw HTML (B) | Gzip HTML (B) |
| --- | --- | --- | --- | --- |
| Litro docs SSG | / | 200 | 182317 | 32526 |
| Litro docs SSG | /docs/introduction | 200 | 85021 | 16871 |
| Litro docs SSG | /blog | 200 | 278951 | 52554 |
| Litro docs SSG | /blog/welcome | 200 | 30747 | 8134 |
| Litro docs SSR | / | 200 | 187438 | 33045 |
| Litro docs SSR | /docs/introduction | 200 | 85575 | 16991 |
| Litro docs SSR | /blog | 200 | 301538 | 53216 |
| Litro docs SSR | /blog/welcome | 200 | 32185 | 8263 |

### Docs: HTTP load

| App | Route | Load runs | Duration (s) | Connections | Requests | Requests/s (mean) | Bytes/s (mean) | Latency mean (ms) | p50 (ms) | p97.5 (ms) | p99 (ms) | Max (ms) | Non-2xx | Errors | Timeouts |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Litro docs SSG | / | 1 | 10 | 10 | 121643 | 11059.28 | 2018365812.37 | 0.17 | 0 | 1 | 2 | 8 | 0 | 0 | 0 |
| Litro docs SSG | /docs/introduction | 1 | 10 | 10 | 149445 | 14945.6 | 1273600409.6 | 0.07 | 0 | 1 | 1 | 10 | 0 | 0 | 0 |
| Litro docs SSG | /blog | 1 | 10 | 10 | 82927 | 8293.4 | 2314626662.4 | 0.86 | 1 | 2 | 2 | 16 | 0 | 0 | 0 |
| Litro docs SSG | /blog/welcome | 1 | 10 | 10 | 206722 | 20670.41 | 639421644.8 | 0.04 | 0 | 1 | 1 | 8 | 0 | 0 | 0 |
| Litro docs SSR | / | 1 | 10 | 10 | 292 | 29.2 | 5788057.6 | 336.36 | 332 | 423 | 452 | 555 | 0 | 0 | 0 |
| Litro docs SSR | /docs/introduction | 1 | 10 | 10 | 1298 | 129.81 | 12058624 | 76.26 | 75 | 91 | 149 | 494 | 0 | 0 | 0 |
| Litro docs SSR | /blog | 1 | 10 | 10 | 826 | 82.6 | 25808076.8 | 119.76 | 117 | 146 | 155 | 627 | 0 | 0 | 0 |
| Litro docs SSR | /blog/welcome | 1 | 10 | 10 | 6712 | 671.2 | 22636134.4 | 14.38 | 13 | 27 | 30 | 131 | 0 | 0 | 0 |

### Docs: HTTP spread

| App | Route | Metric | Mean | Std dev | Min | Max |
| --- | --- | --- | --- | --- | --- | --- |
| Litro docs SSG | / | Latency (ms) | 0.17 | 0.47 | 1 | 8 |
| Litro docs SSG | / | Requests/s | 11059.28 | 489.61 | 9871 | 11500 |
| Litro docs SSG | / | Bytes/s | 2018365812.37 | 89147768.16 | 1801645049 | 2098968500 |
| Litro docs SSG | /docs/introduction | Latency (ms) | 0.07 | 0.28 | 1 | 10 |
| Litro docs SSG | /docs/introduction | Requests/s | 14945.6 | 389.3 | 14236 | 15571 |
| Litro docs SSG | /docs/introduction | Bytes/s | 1273600409.6 | 33401548.68 | 1213106504 | 1326867194 |
| Litro docs SSG | /blog | Latency (ms) | 0.86 | 0.52 | 1 | 16 |
| Litro docs SSG | /blog | Requests/s | 8293.4 | 197.75 | 7999 | 8748 |
| Litro docs SSG | /blog | Bytes/s | 2314626662.4 | 55237566.46 | 2233088829 | 2442187908 |
| Litro docs SSG | /blog/welcome | Latency (ms) | 0.04 | 0.2 | 1 | 8 |
| Litro docs SSG | /blog/welcome | Requests/s | 20670.41 | 676.98 | 19800 | 22085 |
| Litro docs SSG | /blog/welcome | Bytes/s | 639421644.8 | 20824795.92 | 612433800 | 683111135 |
| Litro docs SSR | / | Latency (ms) | 336.36 | 35.74 | 267 | 555 |
| Litro docs SSR | / | Requests/s | 29.2 | 1.99 | 25 | 31 |
| Litro docs SSR | / | Bytes/s | 5788057.6 | 394745.62 | 4955825 | 6145223 |
| Litro docs SSR | /docs/introduction | Latency (ms) | 76.26 | 23.31 | 8 | 494 |
| Litro docs SSR | /docs/introduction | Requests/s | 129.81 | 9.47 | 118 | 150 |
| Litro docs SSR | /docs/introduction | Bytes/s | 12058624 | 879915.76 | 10962790 | 13935750 |
| Litro docs SSR | /blog | Latency (ms) | 119.76 | 31.33 | 10 | 627 |
| Litro docs SSR | /blog | Requests/s | 82.6 | 4.18 | 74 | 88 |
| Litro docs SSR | /blog | Bytes/s | 25808076.8 | 1305590.99 | 23122188 | 27496656 |
| Litro docs SSR | /blog/welcome | Latency (ms) | 14.38 | 4.5 | 3 | 131 |
| Litro docs SSR | /blog/welcome | Requests/s | 671.2 | 29.86 | 627 | 722 |
| Litro docs SSR | /blog/welcome | Bytes/s | 22636134.4 | 1007274.95 | 21146829 | 24350894 |

### Docs (SSG only): Lighthouse

| App | Route | Runs | Score (0–100) | FCP (ms) | LCP (ms) | CLS (unitless) | TBT (ms) | Speed Index (ms) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Litro docs SSG | / | 3 | 61 | 5415.746 | 10380.869 | 0 | 42 | 5415.746 |
| Litro docs SSG | /docs/introduction | 3 | 63 | 4816.163 | 9931.495 | 0 | 33.5 | 4816.163 |
| Litro docs SSG | /blog | 3 | 72 | 3315.249 | 5805.186 | 0 | 0 | 3315.249 |
| Litro docs SSG | /blog/welcome | 3 | 64 | 4440.309 | 9479.964 | 0 | 31.5 | 4440.309 |

### Docs (SSG only): Lighthouse spread

| App | Route | Metric (units above) | Runs | Mean | Median | p95 | Std dev | Min | Max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Litro docs SSG | / | performance | 3 | 61 | 61 | 61 | 0 | 61 | 61 |
| Litro docs SSG | / | fcp | 3 | 5420.091 | 5415.746 | 5429.072 | 6.351 | 5415.456 | 5429.072 |
| Litro docs SSG | / | lcp | 3 | 10389.47 | 10380.869 | 10407.358 | 12.652 | 10380.185 | 10407.358 |
| Litro docs SSG | / | cls | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| Litro docs SSG | / | tbt | 3 | 40.667 | 41 | 42 | 1.247 | 39 | 42 |
| Litro docs SSG | / | speedIndex | 3 | 5420.091 | 5415.746 | 5429.072 | 6.351 | 5415.456 | 5429.072 |
| Litro docs SSG | /docs/introduction | performance | 3 | 62.667 | 63 | 63 | 0.471 | 62 | 63 |
| Litro docs SSG | /docs/introduction | fcp | 3 | 4874.852 | 4816.163 | 4992.365 | 83.094 | 4816.028 | 4992.365 |
| Litro docs SSG | /docs/introduction | lcp | 3 | 9939.202 | 9931.495 | 9954.819 | 11.043 | 9931.292 | 9954.819 |
| Litro docs SSG | /docs/introduction | cls | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| Litro docs SSG | /docs/introduction | tbt | 3 | 33.833 | 33.5 | 34.5 | 0.471 | 33.5 | 34.5 |
| Litro docs SSG | /docs/introduction | speedIndex | 3 | 4874.852 | 4816.163 | 4992.365 | 83.094 | 4816.028 | 4992.365 |
| Litro docs SSG | /blog | performance | 3 | 71.333 | 72 | 72 | 0.943 | 70 | 72 |
| Litro docs SSG | /blog | fcp | 3 | 3371.246 | 3315.249 | 3483.917 | 79.671 | 3314.573 | 3483.917 |
| Litro docs SSG | /blog | lcp | 3 | 5935.089 | 5805.186 | 6196.205 | 184.637 | 5803.877 | 6196.205 |
| Litro docs SSG | /blog | cls | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| Litro docs SSG | /blog | tbt | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| Litro docs SSG | /blog | speedIndex | 3 | 3371.246 | 3315.249 | 3483.917 | 79.671 | 3314.573 | 3483.917 |
| Litro docs SSG | /blog/welcome | performance | 3 | 63.667 | 64 | 64 | 0.471 | 63 | 64 |
| Litro docs SSG | /blog/welcome | fcp | 3 | 4555.643 | 4612.119 | 4614.499 | 81.559 | 4440.309 | 4614.499 |
| Litro docs SSG | /blog/welcome | lcp | 3 | 9443.93 | 9479.963 | 9499.826 | 65.508 | 9351.999 | 9499.826 |
| Litro docs SSG | /blog/welcome | cls | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| Litro docs SSG | /blog/welcome | tbt | 3 | 31.333 | 31.5 | 31.5 | 0.236 | 31 | 31.5 |
| Litro docs SSG | /blog/welcome | speedIndex | 3 | 4555.643 | 4612.119 | 4614.499 | 81.559 | 4440.309 | 4614.499 |

### Docs SSR streaming

| Route | Runs | TTFB median (ms) | TTLB median (ms) | Delta (ms) | Payload (B) |
| --- | --- | --- | --- | --- | --- |
| / | 5 | 24 | 34 | 10 | 187438 |
| /docs/introduction | 5 | 0 | 7 | 7 | 85575 |
| /blog | 5 | 1 | 11 | 10 | 301538 |
| /blog/welcome | 5 | 0 | 2 | 2 | 32185 |

### Docs SSR streaming spread

| Route | Metric (ms; totalBytes in B) | Runs | Mean | Median | p95 | Std dev | Min | Max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| / | ttfb | 5 | 31.81 | 23.924 | 63.465 | 15.87 | 22.457 | 63.465 |
| / | ttlb | 5 | 41.815 | 33.937 | 73.774 | 16.123 | 31.746 | 73.774 |
| / | delta | 5 | 10.005 | 10.012 | 11.728 | 1.055 | 8.52 | 11.728 |
| / | totalBytes | 5 | 187438 | 187438 | 187438 | 0 | 187438 | 187438 |
| /docs/introduction | ttfb | 5 | 0.519 | 0.486 | 0.645 | 0.083 | 0.422 | 0.645 |
| /docs/introduction | ttlb | 5 | 6.52 | 6.52 | 6.7 | 0.127 | 6.305 | 6.7 |
| /docs/introduction | delta | 5 | 6.002 | 6.054 | 6.092 | 0.099 | 5.819 | 6.092 |
| /docs/introduction | totalBytes | 5 | 85575 | 85575 | 85575 | 0 | 85575 | 85575 |
| /blog | ttfb | 5 | 1.296 | 1.329 | 1.4 | 0.077 | 1.18 | 1.4 |
| /blog | ttlb | 5 | 10.617 | 10.625 | 10.661 | 0.035 | 10.565 | 10.661 |
| /blog | delta | 5 | 9.321 | 9.328 | 9.385 | 0.06 | 9.244 | 9.385 |
| /blog | totalBytes | 5 | 301538 | 301538 | 301538 | 0 | 301538 | 301538 |
| /blog/welcome | ttfb | 5 | 0.249 | 0.256 | 0.342 | 0.059 | 0.168 | 0.342 |
| /blog/welcome | ttlb | 5 | 1.497 | 1.51 | 1.649 | 0.106 | 1.356 | 1.649 |
| /blog/welcome | delta | 5 | 1.248 | 1.254 | 1.308 | 0.049 | 1.188 | 1.308 |
| /blog/welcome | totalBytes | 5 | 32185 | 32185 | 32185 | 0 | 32185 | 32185 |

### Next.js and Nuxt: old versus new

Historical comparison across separate runs: Node v24.7.0 → v24.22.3. HN Nuxt now transfers fixture data with useAsyncData instead of re-fetching live data during hydration. Different framework/peer versions, data loading, machine load, and run conditions can affect these values; these changes do not isolate the effect of a dependency upgrade. Static HTTP, bundle breakdown, and minimal-app Lighthouse were not recorded in the old baseline. See the full current tables for those measures.

| Suite | Framework | Old version | New version | Measure | Old | New | Change |
| --- | --- | --- | --- | --- | --- | --- | --- |
| crossFramework | Next.js | 16.4.0 | 16.4.6 | Build median (ms) | 3653 | 2020 | -44.703% |
| crossFramework | Next.js | 16.4.0 | 16.4.6 | Output (B) | 636618 | 637904 | 0.202% |
| crossFramework | Next.js | 16.4.0 | 16.4.6 | Mean HTML gzip (B) | 1834.5 | 1832 | -0.136% |
| crossFramework | Nuxt | 4.6.1 | 4.6.4 | Build median (ms) | 2454 | 2362 | -3.749% |
| crossFramework | Nuxt | 4.6.1 | 4.6.4 | Output (B) | 211132 | 214130 | 1.42% |
| crossFramework | Nuxt | 4.6.1 | 4.6.4 | Mean HTML gzip (B) | 755 | 756.5 | 0.199% |
| hnBenchmark | Next.js | 16.4.0 | 16.4.6 | Build median (ms) | 3408 | 2162 | -36.561% |
| hnBenchmark | Next.js | 16.4.0 | 16.4.6 | Output (B) | 7505379 | 7506647 | 0.017% |
| hnBenchmark | Next.js | 16.4.0 | 16.4.6 | Mean HTML gzip (B) | 7435.2 | 7434.8 | -0.005% |
| hnBenchmark | Nuxt | 4.6.1 | 4.6.4 | Build median (ms) | 2993 | 2094 | -30.037% |
| hnBenchmark | Nuxt | 4.6.1 | 4.6.4 | Output (B) | 1217376 | 2161365 | 77.543% |
| hnBenchmark | Nuxt | 4.6.1 | 4.6.4 | Mean HTML gzip (B) | 3984.4 | 4000 | 0.392% |

<!-- BENCHMARK-REPORT:END -->
