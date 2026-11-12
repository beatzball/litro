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
- Comparison builds remove each app's output and configured framework caches before every timed build. Dependency installation is outside the timer. Cold refers to framework build caches; operating-system file caches are not flushed, and apps run sequentially in configured order. Next.js skips type checking; all comparison apps transpile without a separate type-check pass. Docs builds clear `dist`, `.nitro`, `.litro`, and `node_modules/.vite` before each timed build.
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

The refreshed full run has not been generated yet. Run both comparison phases with Lighthouse, then run `node scripts/update-benchmark-report.mjs`. No refreshed measurements are claimed here until that step completes.

<!-- BENCHMARK-REPORT:END -->
