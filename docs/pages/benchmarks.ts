import { html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import { LitroPage } from '@beatzball/litro/runtime';
import { definePageData } from '@beatzball/litro';
import { siteConfig } from '../server/starlight.config.js';
import { starlightHead } from '@beatzball/litro-docs-ui/src/route-meta.js';
import { buildSeoHead, buildJsonLd } from '@beatzball/litro-docs-ui/src/seo.js';
import { compareStyles } from '@beatzball/litro-docs-ui/src/compare-styles.js';

// Register components used in render()
import '@beatzball/litro-docs-ui/src/components/starlight-header.js';
import '@beatzball/litro-docs-ui/src/components/litro-card.js';
import '@beatzball/litro-docs-ui/src/components/litro-card-grid.js';
import '@beatzball/litro-docs-ui/src/components/litro-badge.js';
import '@beatzball/litro-docs-ui/src/components/litro-tabs.js';
import '@beatzball/litro-docs-ui/src/components/litro-tab-item.js';

/* ── Types ────────────────────────────────────────────────────────────── */

interface Stats {
  runs: number[];
  mean: number;
  median: number;
  p95: number;
  stddev: number;
  min: number;
  max: number;
}

interface BundleSize {
  clientJS: number;
  clientCSS: number;
  serverBundle: number;
  staticHTML: number;
  totalOutput: number;
}

interface LatencyStats {
  mean: number;
  p50: number;
  p97_5: number;
  p99: number;
  max: number;
}

interface HttpRoute {
  latency: LatencyStats;
  requests: { mean: number; total: number };
  throughput: { mean: number };
  errors: number;
  timeouts: number;
  duration: number;
  connections: number;
}

interface PageWeightRoute {
  rawBytes: number;
  gzipBytes: number;
  statusCode: number;
}

interface LighthouseRoute {
  performance: number;
  fcp: number;
  lcp: number;
  cls: number;
  tbt: number;
  speedIndex: number;
}

interface StreamingRoute {
  ttfb: number;
  ttlb: number;
  delta: number;
  totalBytes: number;
}

interface FrameworkResult {
  name: string;
  version: string;
  buildTime: Stats;
  outputSize: number;
  pageWeight: Record<string, PageWeightRoute>;
}

interface BenchmarkResults {
  meta: {
    timestamp: string;
    nodeVersion: string;
    platform: string;
    arch: string;
    cpuModel: string;
    cpuCount: number;
    memoryGB: number;
    commitSha: string;
    commitMessage: string;
  };
  buildTime: { ssg: Stats; ssr: Stats };
  bundleSize: { ssg: BundleSize; ssr: BundleSize };
  httpPerf: { ssg: Record<string, HttpRoute>; ssr: Record<string, HttpRoute> };
  pageWeight: { ssg: Record<string, PageWeightRoute>; ssr: Record<string, PageWeightRoute> };
  lighthouse: { ssg: Record<string, LighthouseRoute> };
  streaming: { ssr: Record<string, StreamingRoute> };
  crossFramework?: FrameworkResult[];
  hnBenchmark?: FrameworkResult[];
}

export interface BenchmarksData {
  results: BenchmarkResults;
  siteTitle: string;
  nav: typeof siteConfig.nav;
  seoHead: string;
  seoTitle: string;
}

/* ── Server data ──────────────────────────────────────────────────────── */

const EMPTY_STATS: Stats = { runs: [], mean: 0, median: 0, p95: 0, stddev: 0, min: 0, max: 0 };
const EMPTY_BUNDLE: BundleSize = { clientJS: 0, clientCSS: 0, serverBundle: 0, staticHTML: 0, totalOutput: 0 };
const EMPTY_RESULTS: BenchmarkResults = {
  meta: { timestamp: '', nodeVersion: '', platform: '', arch: '', cpuModel: '', cpuCount: 0, memoryGB: 0, commitSha: '', commitMessage: '' },
  buildTime: { ssg: EMPTY_STATS, ssr: EMPTY_STATS },
  bundleSize: { ssg: EMPTY_BUNDLE, ssr: EMPTY_BUNDLE },
  httpPerf: { ssg: {}, ssr: {} },
  pageWeight: { ssg: {}, ssr: {} },
  lighthouse: { ssg: {} },
  streaming: { ssr: {} },
};

export const pageData = definePageData(async (_event) => {
  const { readFile } = await import('node:fs/promises');
  const { resolve } = await import('node:path');
  const jsonPath = resolve(process.cwd(), '..', 'benchmarks', 'results', 'latest.json');

  let results: BenchmarkResults = EMPTY_RESULTS;
  try {
    const raw = await readFile(jsonPath, 'utf-8');
    results = JSON.parse(raw) as BenchmarkResults;
  } catch {
    // No benchmark data yet — page renders "run bench" placeholders
  }

  const seoTitle = 'Benchmarks — Litro';
  const seoHead = buildSeoHead({
    title: seoTitle,
    description: 'Performance benchmarks: Litro vs Nuxt vs Next.js, plus SSG vs SSR internals. Build time, output size, page weight, TTFB, Lighthouse, and streaming metrics.',
    path: '/benchmarks',
    type: 'website',
  }) + buildJsonLd({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    'name': 'Litro Benchmarks',
    'description': 'Cross-framework performance comparison and Litro SSG vs SSR internals.',
    'url': 'https://litro.dev/benchmarks',
  });

  return {
    results,
    siteTitle: siteConfig.title,
    nav: siteConfig.nav,
    seoHead,
    seoTitle,
  } satisfies BenchmarksData;
});

export const routeMeta = {
  head: starlightHead,
  title: 'Benchmarks — Litro',
};

/* ── Component ────────────────────────────────────────────────────────── */

@customElement('page-benchmarks')
export class BenchmarksPage extends LitroPage {
  static override styles = [
    compareStyles,
    css`
      /* ── Meta block ────────────────────────────────────────────────── */
      .meta {
        font-size: var(--sl-text-sm, 0.875rem);
        color: var(--sl-color-gray-4, #9ca3af);
        margin-bottom: 2rem;
        line-height: 1.8;
      }
      .meta code {
        font-size: inherit;
      }

      /* ── Section divider ───────────────────────────────────────────── */
      .section-divider {
        border: none;
        border-top: 1px solid var(--sl-color-gray-6, #e5e7eb);
        margin: 3rem 0;
      }

      /* ── Summary cards ─────────────────────────────────────────────── */
      .summary-section {
        margin-bottom: 2.5rem;
      }
      .card-comparison {
        display: flex;
        gap: 1.25rem;
        align-items: baseline;
        margin-top: 0.35rem;
        font-size: var(--sl-text-sm, 0.875rem);
        color: var(--sl-color-text);
      }
      .card-label {
        font-weight: 600;
        color: var(--sl-color-gray-4, #9ca3af);
        text-transform: uppercase;
        font-size: var(--sl-text-xs, 0.75rem);
        letter-spacing: 0.04em;
        margin-right: 0.25rem;
      }
      .card-badge { margin-top: 0.6rem; }

      /* ── Framework card (cross-framework summary) ──────────────────── */
      .fw-card-values {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        margin-top: 0.35rem;
        font-size: var(--sl-text-sm, 0.875rem);
        color: var(--sl-color-text);
      }
      .fw-card-row {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
      }
      .fw-card-row .fw-name {
        font-weight: 500;
      }
      .fw-card-row .fw-value {
        font-variant-numeric: tabular-nums;
      }

      /* ── Winner highlight ──────────────────────────────────────────── */
      .winner-cell {
        color: var(--sl-color-tip, #15803d);
        font-weight: 600;
      }
      .winner-value {
        color: var(--sl-color-tip, #15803d);
        font-weight: 600;
      }

      /* ── Table captions ────────────────────────────────────────────── */
      caption {
        text-align: left;
        font-size: var(--sl-text-sm, 0.875rem);
        color: var(--sl-color-gray-4, #9ca3af);
        padding: 0.5rem 1rem;
        caption-side: bottom;
      }

      /* ── Notes ─────────────────────────────────────────────────────── */
      .note {
        font-size: var(--sl-text-sm, 0.875rem);
        color: var(--sl-color-gray-4, #9ca3af);
        margin-bottom: 1rem;
        line-height: 1.6;
      }

      /* ── Output size bar ───────────────────────────────────────────── */
      .bar {
        display: inline-block;
        height: 0.75rem;
        background: var(--sl-color-accent, #ea580c);
        border-radius: 3px;
        vertical-align: middle;
        min-width: 2px;
      }
      .bar-label {
        font-size: var(--sl-text-xs, 0.75rem);
        color: var(--sl-color-gray-4, #9ca3af);
        margin-left: 0.5rem;
        vertical-align: middle;
      }

      /* ── Annotation footnotes ─────────────────────────────────────── */
      .annotation-marker {
        color: var(--sl-color-accent, #ea580c);
        font-weight: 600;
        margin-left: 1px;
      }
      .annotation-legend {
        margin: 0.75rem 0 1.5rem;
        font-size: var(--sl-text-sm, 0.875rem);
        color: var(--sl-color-gray-4, #9ca3af);
        line-height: 1.6;
      }
      .annotation-legend p {
        margin: 0.2rem 0;
      }
    `,
  ];

  /* ── Helpers ──────────────────────────────────────────────────────── */

  private _formatBytes(bytes: number): string {
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  private _formatMs(ms: number): string {
    if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
    return `${ms.toFixed(1)}ms`;
  }

  private _winner(a: number, b: number, lowerIsBetter: boolean): 'ssg' | 'ssr' | 'tie' {
    if (a === b) return 'tie';
    if (lowerIsBetter) return a < b ? 'ssg' : 'ssr';
    return a > b ? 'ssg' : 'ssr';
  }

  private _winnerLabel(w: 'ssg' | 'ssr' | 'tie'): string {
    if (w === 'tie') return 'Tie';
    return w.toUpperCase();
  }

  private _fwWinnerIdx(values: number[], lowerIsBetter: boolean): number {
    if (values.length === 0) return -1;
    const target = lowerIsBetter ? Math.min(...values) : Math.max(...values);
    return values.indexOf(target);
  }

  /** Returns a Set of all indices whose formatted display value matches the winner's. */
  private _fwTiedWinnerIndices(values: number[], lowerIsBetter: boolean, formatFn: (v: number) => string): Set<number> {
    const winnerIdx = this._fwWinnerIdx(values, lowerIsBetter);
    if (winnerIdx === -1) return new Set();
    const winnerDisplay = formatFn(values[winnerIdx]);
    const tied = new Set<number>();
    for (let i = 0; i < values.length; i++) {
      if (formatFn(values[i]) === winnerDisplay) tied.add(i);
    }
    return tied;
  }

  /* ── Render ──────────────────────────────────────────────────────── */

  override render() {
    const data = this.serverData as BenchmarksData | null;
    if (!data) return html`<p>Loading...</p>`;

    const r = data.results;
    const fw = r.crossFramework ?? [];
    const hasCross = fw.length > 0;
    const hn = (r as BenchmarkResults & { hnBenchmark?: FrameworkResult[] }).hnBenchmark ?? [];
    const hasHn = hn.length > 0;
    const hasInternals = r.buildTime.ssg.runs.length > 0;

    return html`
      <div class="page">
        <starlight-header
          siteTitle="${data.siteTitle}"
          .nav="${data.nav}"
          currentPath="/benchmarks"
        ></starlight-header>
        <main>
          <h1>Benchmarks</h1>
          <p class="intro">
            Real-world performance numbers for Litro and competing frameworks,
            measured on the same hardware with identical page content.
          </p>
          ${r.meta.timestamp ? html`
            <p class="meta">
              <code>${new Date(r.meta.timestamp).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</code>
              &middot; commit <code>${r.meta.commitSha}</code>
              &middot; ${r.meta.nodeVersion}
              &middot; ${r.meta.cpuModel} (${r.meta.cpuCount} cores, ${r.meta.memoryGB} GB)
            </p>
          ` : ''}

          <!-- ═══════ Section 1: Cross-Framework (minimal) ═══════ -->
          ${hasCross ? this._crossFrameworkSection(fw) : this._crossFrameworkPlaceholder()}

          <hr class="section-divider" />

          <!-- ═══════ Section 2: HN Benchmark (realistic) ═══════ -->
          ${hasHn ? this._hnBenchmarkSection(hn) : this._hnBenchmarkPlaceholder()}

          <hr class="section-divider" />

          <!-- ═══════ Section 3: Litro SSG vs SSR ═══════ -->
          ${hasInternals ? this._litroInternalsSection(r) : this._litroInternalsPlaceholder()}
        </main>
      </div>
    `;
  }

  /* ══════════════════════════════════════════════════════════════════════
   * SECTION 1: Cross-Framework Comparison
   * ════════════════════════════════════════════════════════════════════ */

  private _crossFrameworkSection(frameworks: FrameworkResult[]) {
    const buildWinnerIdx = this._fwWinnerIdx(frameworks.map(f => f.buildTime.mean), true);
    const sizeWinnerIdx = this._fwWinnerIdx(frameworks.map(f => f.outputSize), true);

    // Avg gzip across all routes per framework
    const routes = Object.keys(frameworks[0]?.pageWeight ?? {});
    const avgGzips = frameworks.map(fw => {
      if (routes.length === 0) return 0;
      return routes.reduce((s, rt) => s + (fw.pageWeight[rt]?.gzipBytes ?? 0), 0) / routes.length;
    });
    const weightWinnerIdx = this._fwWinnerIdx(avgGzips, true);

    return html`
      <h2>Framework Comparison</h2>
      <p class="note">
        Identical minimal apps (2 routes, same content) built in SSG mode.
        Litro uses Lit + Nitro, Nuxt uses Vue + Nitro, Next.js uses React.
      </p>

      <!-- Summary cards -->
      <section class="summary-section" aria-label="Cross-framework summary">
        <litro-card-grid>
          ${this._fwSummaryCard('Build Time', frameworks, fw => this._formatMs(fw.buildTime.mean), buildWinnerIdx)}
          ${this._fwSummaryCard('Output Size', frameworks, fw => this._formatBytes(fw.outputSize), sizeWinnerIdx)}
          ${routes.length > 0 ? this._fwSummaryCard('Avg Page Weight', frameworks, (_, i) => this._formatBytes(avgGzips[i]), weightWinnerIdx) : ''}
        </litro-card-grid>
      </section>

      <!-- Detail tabs -->
      <litro-tabs>
        ${this._fwBuildTab(frameworks, buildWinnerIdx)}
        ${this._fwOutputSizeTab(frameworks, sizeWinnerIdx)}
        ${routes.length > 0 ? this._fwPageWeightTab(frameworks, routes) : ''}
      </litro-tabs>
    `;
  }

  private _crossFrameworkPlaceholder() {
    return html`
      <h2>Framework Comparison</h2>
      <p class="note">
        Cross-framework benchmarks have not been run yet. Run
        <code>pnpm bench:cross</code> to compare Litro against Nuxt and Next.js.
      </p>
    `;
  }

  /* ══════════════════════════════════════════════════════════════════════
   * SECTION 2: HN Benchmark (realistic app, SSG only)
   * TODO: Add SSR benchmark section once --hn-ssr is implemented in the
   * runner. Would show per-request TTFB, throughput, and latency p99
   * across all 5 frameworks using measureHttpPerf().
   * ════════════════════════════════════════════════════════════════════ */

  private _hnSizeAnnotations: Record<string, string> = {
    'nextjs': '\u2020',
  };

  private _hnWeightAnnotations: Record<string, string> = {
    'nuxt': '\u2021',
  };

  private _fwNameWithAnnotation(name: string, annotations?: Record<string, string>) {
    const sym = annotations?.[name];
    return sym ? html`${name}<sup class="annotation-marker">${sym}</sup>` : html`${name}`;
  }

  private _hnBenchmarkSection(frameworks: FrameworkResult[]) {
    const buildWinnerIdx = this._fwWinnerIdx(frameworks.map(f => f.buildTime.mean), true);
    const sizeTiedWinners = this._fwTiedWinnerIndices(
      frameworks.map(f => f.outputSize), true, v => this._formatBytes(v),
    );

    const routes = Object.keys(frameworks[0]?.pageWeight ?? {});
    const avgGzips = frameworks.map(fw => {
      if (routes.length === 0) return 0;
      return routes.reduce((s, rt) => s + (fw.pageWeight[rt]?.gzipBytes ?? 0), 0) / routes.length;
    });
    const weightWinnerIdx = this._fwWinnerIdx(avgGzips, true);

    const sizeAnn = this._hnSizeAnnotations;
    const weightAnn = this._hnWeightAnnotations;

    return html`
      <h2>HN Clone Benchmark</h2>
      <p class="note">
        Five identical Hacker News clones (3 Litro adapters + Next.js + Nuxt),
        same fixture data, same routes (~100 pages), SSG mode. Tests realistic app
        complexity with data fetching, dynamic routes, and nested comment trees.
      </p>

      <section class="summary-section" aria-label="HN benchmark summary">
        <litro-card-grid>
          ${this._fwSummaryCard('Build Time', frameworks, fw => this._formatMs(fw.buildTime.mean), buildWinnerIdx)}
          ${this._fwSummaryCard('Output Size', frameworks, fw => this._formatBytes(fw.outputSize), sizeTiedWinners, sizeAnn)}
          ${routes.length > 0 ? this._fwSummaryCard('Avg Page Weight', frameworks, (_, i) => this._formatBytes(avgGzips[i]), weightWinnerIdx, weightAnn) : ''}
        </litro-card-grid>
      </section>

      <div class="annotation-legend">
        <p><span class="annotation-marker">\u2020</span> Next.js output includes RSC payload files (<code>.txt</code>) alongside HTML, inflating total on-disk size.</p>
        <p><span class="annotation-marker">\u2021</span> Nuxt produces the smallest page weight because it does not duplicate data for hydration. Litro inlines a <code>__litro_data__</code> JSON blob (~14 KB on the index page) and Next.js inlines RSC scripts (~25 KB) — both ship serialized data alongside rendered HTML so the client can hydrate. Nuxt prerenders the HTML and ships only a minimal metadata stub (~160 bytes), relying on the server-rendered markup without client re-rendering.</p>
      </div>

      <litro-tabs>
        ${this._fwBuildTab(frameworks, buildWinnerIdx)}
        ${this._fwOutputSizeTab(frameworks, sizeTiedWinners, sizeAnn)}
        ${routes.length > 0 ? this._fwPageWeightTab(frameworks, routes, weightAnn) : ''}
      </litro-tabs>

      <p class="note">
        These benchmarks measure static prerendering (SSG) only. Per-request SSR
        benchmarks — measuring TTFB, throughput, and latency under load — are
        planned for a future update.
      </p>
    `;
  }

  private _hnBenchmarkPlaceholder() {
    return html`
      <h2>HN Clone Benchmark</h2>
      <p class="note">
        HN clone benchmarks have not been run yet. Run
        <code>pnpm bench:hn</code> to compare all 5 HN clones.
      </p>
    `;
  }

  private _litroInternalsPlaceholder() {
    return html`
      <h2>Litro SSG vs SSR</h2>
      <p class="note">
        Internal Litro benchmarks have not been run yet. Run
        <code>pnpm bench</code> to compare SSG vs SSR across build time,
        output size, HTTP latency, and Lighthouse scores.
      </p>
    `;
  }

  private _fwSummaryCard(
    title: string,
    frameworks: FrameworkResult[],
    valueFn: (fw: FrameworkResult, i: number) => string,
    winnerIdx: number | Set<number>,
    annotations?: Record<string, string>,
  ) {
    const winners = typeof winnerIdx === 'number' ? new Set([winnerIdx]) : winnerIdx;
    const firstWinnerIdx = typeof winnerIdx === 'number' ? winnerIdx : [...winnerIdx][0];
    const isTie = winners.size > 1;
    const winnerName = frameworks[firstWinnerIdx]?.name ?? '';
    const winnerSym = annotations?.[winnerName];
    const tieNames = isTie ? [...winners].map(i => frameworks[i]?.name).join(' & ') : winnerName;

    return html`
      <litro-card title="${title}">
        <div class="fw-card-values">
          ${frameworks.map((fw, i) => html`
            <div class="fw-card-row">
              <span class="fw-name">${this._fwNameWithAnnotation(fw.name, annotations)}</span>
              <span class="fw-value ${winners.has(i) ? 'winner-value' : ''}">${valueFn(fw, i)}</span>
            </div>
          `)}
        </div>
        <div class="card-badge">
          <litro-badge variant="${winnerSym ? 'caution' : 'tip'}" text="${isTie ? `${tieNames} tied` : `${winnerName} wins`}${winnerSym ? ` ${winnerSym}` : ''}"></litro-badge>
        </div>
      </litro-card>
    `;
  }

  private _fwBuildTab(frameworks: FrameworkResult[], buildWinnerIdx: number) {
    return html`
      <litro-tab-item label="Build Time">
        <h3>Production Build Time</h3>
        <div class="table-wrap">
          <table>
            <caption>Time to complete a full production build (${frameworks[0]?.buildTime.runs?.length ?? '?'} runs each).</caption>
            <thead>
              <tr>
                <th scope="col">Framework</th>
                <th scope="col">Version</th>
                <th scope="col">Mean</th>
                <th scope="col">Median</th>
                <th scope="col">p95</th>
                <th scope="col">Std Dev</th>
              </tr>
            </thead>
            <tbody>
              ${frameworks.map((fw, i) => html`
                <tr>
                  <th scope="row">${fw.name}</th>
                  <td>${fw.version}</td>
                  <td class="${i === buildWinnerIdx ? 'winner-cell' : ''}">${this._formatMs(fw.buildTime.mean)}</td>
                  <td>${this._formatMs(fw.buildTime.median)}</td>
                  <td>${this._formatMs(fw.buildTime.p95)}</td>
                  <td>${this._formatMs(fw.buildTime.stddev)}</td>
                </tr>
              `)}
            </tbody>
          </table>
        </div>
      </litro-tab-item>
    `;
  }

  private _fwOutputSizeTab(frameworks: FrameworkResult[], sizeWinnerIdx: number | Set<number>, annotations?: Record<string, string>) {
    const winners = typeof sizeWinnerIdx === 'number' ? new Set([sizeWinnerIdx]) : sizeWinnerIdx;
    const maxOutput = Math.max(...frameworks.map(f => f.outputSize));

    return html`
      <litro-tab-item label="Output Size">
        <h3>Build Output Size</h3>
        <div class="table-wrap">
          <table>
            <caption>Total size of production build output on disk.</caption>
            <thead>
              <tr>
                <th scope="col">Framework</th>
                <th scope="col">Total Size</th>
                <th scope="col">Relative</th>
              </tr>
            </thead>
            <tbody>
              ${frameworks.map((fw, i) => {
                const pct = maxOutput > 0 ? (fw.outputSize / maxOutput) * 100 : 0;
                return html`
                  <tr>
                    <th scope="row">${this._fwNameWithAnnotation(fw.name, annotations)}</th>
                    <td class="${winners.has(i) ? 'winner-cell' : ''}">${this._formatBytes(fw.outputSize)}</td>
                    <td>
                      <span class="bar" style="width: ${pct.toFixed(1)}%"></span>
                      <span class="bar-label">${pct.toFixed(0)}%</span>
                    </td>
                  </tr>
                `;
              })}
            </tbody>
          </table>
        </div>
      </litro-tab-item>
    `;
  }

  private _fwPageWeightTab(frameworks: FrameworkResult[], routes: string[], annotations?: Record<string, string>) {
    return html`
      <litro-tab-item label="Page Weight">
        <h3>HTML Response Size</h3>
        <div class="table-wrap">
          <table>
            <caption>Raw and gzip-compressed HTML payload per route.</caption>
            <thead>
              <tr>
                <th scope="col">Route</th>
                ${frameworks.map(fw => html`<th scope="col">${this._fwNameWithAnnotation(fw.name, annotations)} raw</th><th scope="col">${this._fwNameWithAnnotation(fw.name, annotations)} gzip</th>`)}
              </tr>
            </thead>
            <tbody>
              ${routes.map(rt => {
                const gzips = frameworks.map(fw => fw.pageWeight[rt]?.gzipBytes ?? Infinity);
                const minGzip = Math.min(...gzips);
                return html`
                  <tr>
                    <th scope="row"><code>${rt}</code></th>
                    ${frameworks.map(fw => {
                      const pw = fw.pageWeight[rt];
                      if (!pw) return html`<td>-</td><td>-</td>`;
                      const isWinner = pw.gzipBytes === minGzip;
                      return html`
                        <td class="${isWinner ? 'winner-cell' : ''}">${this._formatBytes(pw.rawBytes)}</td>
                        <td class="${isWinner ? 'winner-cell' : ''}">${this._formatBytes(pw.gzipBytes)}</td>
                      `;
                    })}
                  </tr>
                `;
              })}
            </tbody>
          </table>
        </div>
      </litro-tab-item>
    `;
  }

  /* ══════════════════════════════════════════════════════════════════════
   * SECTION 2: Litro Internals (SSG vs SSR)
   * ════════════════════════════════════════════════════════════════════ */

  private _litroInternalsSection(r: BenchmarkResults) {
    const routes = Object.keys(r.httpPerf.ssg);

    const avgTtfbSsg = routes.reduce((s, rt) => s + r.httpPerf.ssg[rt].latency.mean, 0) / routes.length;
    const avgTtfbSsr = routes.reduce((s, rt) => s + r.httpPerf.ssr[rt].latency.mean, 0) / routes.length;
    const lhRoutesSsg = Object.keys(r.lighthouse.ssg);
    const hasLighthouse = lhRoutesSsg.length > 0;
    const avgLhSsg = hasLighthouse ? lhRoutesSsg.reduce((s, rt) => s + r.lighthouse.ssg[rt].performance, 0) / lhRoutesSsg.length : 0;

    const buildWinner = this._winner(r.buildTime.ssg.mean, r.buildTime.ssr.mean, true);
    const sizeWinner = this._winner(r.bundleSize.ssg.totalOutput, r.bundleSize.ssr.totalOutput, true);
    const ttfbWinner = this._winner(avgTtfbSsg, avgTtfbSsr, true);

    return html`
      <h2>Litro Internals: SSG vs SSR</h2>
      <p class="note">
        Deep-dive comparing Litro's Static Site Generation and Server-Side
        Rendering modes on the docs site. Useful for choosing a deployment strategy.
      </p>

      <!-- Summary cards -->
      <section class="summary-section" aria-label="SSG vs SSR summary">
        <litro-card-grid>
          ${this._ssgSsrCard('Build Time', this._formatMs(r.buildTime.ssg.mean), this._formatMs(r.buildTime.ssr.mean), buildWinner)}
          ${this._ssgSsrCard('Output Size', this._formatBytes(r.bundleSize.ssg.totalOutput), this._formatBytes(r.bundleSize.ssr.totalOutput), sizeWinner)}
          ${this._ssgSsrCard('Avg TTFB', this._formatMs(avgTtfbSsg), this._formatMs(avgTtfbSsr), ttfbWinner)}
        </litro-card-grid>
      </section>

      <!-- Detail tabs -->
      <litro-tabs>
        ${this._buildTab(r, buildWinner, sizeWinner)}
        ${this._responseTimeTab(r, routes)}
        ${this._pageWeightTab(r, routes)}
        ${hasLighthouse ? this._lighthouseTab(r, routes) : this._lighthouseSkippedTab()}
        ${this._streamingTab(r)}
      </litro-tabs>
    `;
  }

  /* ── SSG vs SSR Partials ────────────────────────────────────────── */

  private _ssgSsrCard(title: string, ssgVal: string, ssrVal: string, winner: 'ssg' | 'ssr' | 'tie') {
    return html`
      <litro-card title="${title}">
        <div class="card-comparison">
          <span><span class="card-label">SSG</span> ${ssgVal}</span>
          <span><span class="card-label">SSR</span> ${ssrVal}</span>
        </div>
        <div class="card-badge">
          <litro-badge variant="tip" text="${this._winnerLabel(winner) + (winner !== 'tie' ? ' wins' : '')}"></litro-badge>
        </div>
      </litro-card>
    `;
  }

  private _buildTab(r: BenchmarkResults, buildWinner: 'ssg' | 'ssr' | 'tie', sizeWinner: 'ssg' | 'ssr' | 'tie') {
    const medianW = this._winner(r.buildTime.ssg.median, r.buildTime.ssr.median, true);
    const p95W = this._winner(r.buildTime.ssg.p95, r.buildTime.ssr.p95, true);

    return html`
      <litro-tab-item label="Build">
        <h3>Build Time</h3>
        <div class="table-wrap">
          <table>
            <caption>Time to complete a full production build (${r.buildTime.ssg.runs.length} runs each).</caption>
            <thead>
              <tr><th scope="col">Metric</th><th scope="col">SSG</th><th scope="col">SSR</th><th scope="col">Faster</th></tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Mean</th>
                <td class="${buildWinner === 'ssg' ? 'winner-cell' : ''}">${this._formatMs(r.buildTime.ssg.mean)}</td>
                <td class="${buildWinner === 'ssr' ? 'winner-cell' : ''}">${this._formatMs(r.buildTime.ssr.mean)}</td>
                <td>${this._winnerLabel(buildWinner)}</td>
              </tr>
              <tr>
                <th scope="row">Median</th>
                <td class="${medianW === 'ssg' ? 'winner-cell' : ''}">${this._formatMs(r.buildTime.ssg.median)}</td>
                <td class="${medianW === 'ssr' ? 'winner-cell' : ''}">${this._formatMs(r.buildTime.ssr.median)}</td>
                <td>${this._winnerLabel(medianW)}</td>
              </tr>
              <tr>
                <th scope="row">p95</th>
                <td class="${p95W === 'ssg' ? 'winner-cell' : ''}">${this._formatMs(r.buildTime.ssg.p95)}</td>
                <td class="${p95W === 'ssr' ? 'winner-cell' : ''}">${this._formatMs(r.buildTime.ssr.p95)}</td>
                <td>${this._winnerLabel(p95W)}</td>
              </tr>
              <tr>
                <th scope="row">Std Dev</th>
                <td>${this._formatMs(r.buildTime.ssg.stddev)}</td>
                <td>${this._formatMs(r.buildTime.ssr.stddev)}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3>Bundle Size</h3>
        <div class="table-wrap">
          <table>
            <caption>Size of build output on disk.</caption>
            <thead>
              <tr><th scope="col">Asset</th><th scope="col">SSG</th><th scope="col">SSR</th></tr>
            </thead>
            <tbody>
              <tr><th scope="row">Client JS</th><td>${this._formatBytes(r.bundleSize.ssg.clientJS)}</td><td>${this._formatBytes(r.bundleSize.ssr.clientJS)}</td></tr>
              <tr><th scope="row">Client CSS</th><td>${this._formatBytes(r.bundleSize.ssg.clientCSS)}</td><td>${this._formatBytes(r.bundleSize.ssr.clientCSS)}</td></tr>
              <tr><th scope="row">Server Bundle</th><td>${this._formatBytes(r.bundleSize.ssg.serverBundle)}</td><td>${this._formatBytes(r.bundleSize.ssr.serverBundle)}</td></tr>
              <tr><th scope="row">Static HTML</th><td>${this._formatBytes(r.bundleSize.ssg.staticHTML)}</td><td>${this._formatBytes(r.bundleSize.ssr.staticHTML)}</td></tr>
              <tr>
                <th scope="row"><strong>Total</strong></th>
                <td class="${sizeWinner === 'ssg' ? 'winner-cell' : ''}"><strong>${this._formatBytes(r.bundleSize.ssg.totalOutput)}</strong></td>
                <td class="${sizeWinner === 'ssr' ? 'winner-cell' : ''}"><strong>${this._formatBytes(r.bundleSize.ssr.totalOutput)}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
      </litro-tab-item>
    `;
  }

  private _responseTimeTab(r: BenchmarkResults, routes: string[]) {
    return html`
      <litro-tab-item label="Response Time">
        <h3>Latency Under Load</h3>
        <div class="table-wrap">
          <table>
            <caption>autocannon: ${r.httpPerf.ssg[routes[0]]?.connections ?? 10} connections, ${r.httpPerf.ssg[routes[0]]?.duration ?? 10}s per route.</caption>
            <thead>
              <tr>
                <th scope="col">Route</th>
                <th scope="col">SSG mean</th><th scope="col">SSG p97.5</th><th scope="col">SSG p99</th>
                <th scope="col">SSR mean</th><th scope="col">SSR p97.5</th><th scope="col">SSR p99</th>
                <th scope="col">Faster</th>
              </tr>
            </thead>
            <tbody>
              ${routes.map(rt => {
                const ssg = r.httpPerf.ssg[rt].latency;
                const ssr = r.httpPerf.ssr[rt].latency;
                const w = this._winner(ssg.mean, ssr.mean, true);
                return html`
                  <tr>
                    <th scope="row"><code>${rt}</code></th>
                    <td class="${w === 'ssg' ? 'winner-cell' : ''}">${this._formatMs(ssg.mean)}</td>
                    <td>${this._formatMs(ssg.p97_5)}</td>
                    <td>${this._formatMs(ssg.p99)}</td>
                    <td class="${w === 'ssr' ? 'winner-cell' : ''}">${this._formatMs(ssr.mean)}</td>
                    <td>${this._formatMs(ssr.p97_5)}</td>
                    <td>${this._formatMs(ssr.p99)}</td>
                    <td>${this._winnerLabel(w)}</td>
                  </tr>
                `;
              })}
            </tbody>
          </table>
        </div>

        <h3>Throughput</h3>
        <div class="table-wrap">
          <table>
            <caption>Total requests handled in the test window.</caption>
            <thead>
              <tr>
                <th scope="col">Route</th>
                <th scope="col">SSG req/s</th><th scope="col">SSG total</th>
                <th scope="col">SSR req/s</th><th scope="col">SSR total</th>
              </tr>
            </thead>
            <tbody>
              ${routes.map(rt => {
                const ssg = r.httpPerf.ssg[rt];
                const ssr = r.httpPerf.ssr[rt];
                const w = this._winner(ssg.requests.mean, ssr.requests.mean, false);
                return html`
                  <tr>
                    <th scope="row"><code>${rt}</code></th>
                    <td class="${w === 'ssg' ? 'winner-cell' : ''}">${ssg.requests.mean.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                    <td>${ssg.requests.total.toLocaleString('en-US')}</td>
                    <td class="${w === 'ssr' ? 'winner-cell' : ''}">${ssr.requests.mean.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                    <td>${ssr.requests.total.toLocaleString('en-US')}</td>
                  </tr>
                `;
              })}
            </tbody>
          </table>
        </div>
      </litro-tab-item>
    `;
  }

  private _pageWeightTab(r: BenchmarkResults, routes: string[]) {
    return html`
      <litro-tab-item label="Page Weight">
        <h3>HTML Response Size</h3>
        <div class="table-wrap">
          <table>
            <caption>Raw and gzip-compressed HTML payload per route.</caption>
            <thead>
              <tr>
                <th scope="col">Route</th>
                <th scope="col">SSG raw</th><th scope="col">SSG gzip</th>
                <th scope="col">SSR raw</th><th scope="col">SSR gzip</th>
                <th scope="col">Smaller</th>
              </tr>
            </thead>
            <tbody>
              ${routes.map(rt => {
                const ssg = r.pageWeight.ssg[rt];
                const ssr = r.pageWeight.ssr[rt];
                const w = this._winner(ssg.gzipBytes, ssr.gzipBytes, true);
                return html`
                  <tr>
                    <th scope="row"><code>${rt}</code></th>
                    <td class="${w === 'ssg' ? 'winner-cell' : ''}">${this._formatBytes(ssg.rawBytes)}</td>
                    <td class="${w === 'ssg' ? 'winner-cell' : ''}">${this._formatBytes(ssg.gzipBytes)}</td>
                    <td class="${w === 'ssr' ? 'winner-cell' : ''}">${this._formatBytes(ssr.rawBytes)}</td>
                    <td class="${w === 'ssr' ? 'winner-cell' : ''}">${this._formatBytes(ssr.gzipBytes)}</td>
                    <td>${this._winnerLabel(w)}</td>
                  </tr>
                `;
              })}
            </tbody>
          </table>
        </div>
      </litro-tab-item>
    `;
  }

  private _lighthouseTab(r: BenchmarkResults, routes: string[]) {
    return html`
      <litro-tab-item label="Lighthouse">
        <h3>Lighthouse Performance (SSG)</h3>
        <p class="note">
          SSR pages use Declarative Shadow DOM — Lighthouse cannot measure paint
          events inside shadow roots, so only SSG scores are shown.
        </p>
        <div class="table-wrap">
          <table>
            <caption>Headless Chrome Lighthouse audit (median of 3 runs per route).</caption>
            <thead>
              <tr>
                <th scope="col">Route</th>
                <th scope="col">Score</th>
                <th scope="col">FCP</th>
                <th scope="col">LCP</th>
                <th scope="col">CLS</th>
                <th scope="col">TBT</th>
                <th scope="col">SI</th>
              </tr>
            </thead>
            <tbody>
              ${routes.map(rt => {
                const ssg = r.lighthouse.ssg[rt];
                if (!ssg) return html``;
                return html`
                  <tr>
                    <th scope="row"><code>${rt}</code></th>
                    <td>${ssg.performance}</td>
                    <td>${this._formatMs(ssg.fcp)}</td>
                    <td>${this._formatMs(ssg.lcp)}</td>
                    <td>${ssg.cls.toFixed(3)}</td>
                    <td>${this._formatMs(ssg.tbt)}</td>
                    <td>${this._formatMs(ssg.speedIndex)}</td>
                  </tr>
                `;
              })}
            </tbody>
          </table>
        </div>
      </litro-tab-item>
    `;
  }

  private _lighthouseSkippedTab() {
    return html`
      <litro-tab-item label="Lighthouse">
        <h3>Lighthouse Performance</h3>
        <p>Lighthouse was skipped in this benchmark run. Run <code>pnpm bench</code> (without <code>--skip-lighthouse</code>) to collect Lighthouse data.</p>
      </litro-tab-item>
    `;
  }

  private _streamingTab(r: BenchmarkResults) {
    const routes = Object.keys(r.streaming.ssr);
    return html`
      <litro-tab-item label="Streaming">
        <h3>SSR Streaming</h3>
        <p class="note">
          Streaming metrics are SSR-only. TTFB is time to first byte of the
          response; TTLB is time to last byte. Delta is how long the stream
          took to deliver the full payload.
        </p>
        <div class="table-wrap">
          <table>
            <caption>Measured with raw HTTP requests (median of 5 runs).</caption>
            <thead>
              <tr>
                <th scope="col">Route</th>
                <th scope="col">TTFB</th>
                <th scope="col">TTLB</th>
                <th scope="col">Delta</th>
                <th scope="col">Size</th>
              </tr>
            </thead>
            <tbody>
              ${routes.map(rt => {
                const s = r.streaming.ssr[rt];
                return html`
                  <tr>
                    <th scope="row"><code>${rt}</code></th>
                    <td>${this._formatMs(s.ttfb)}</td>
                    <td>${this._formatMs(s.ttlb)}</td>
                    <td>${this._formatMs(s.delta)}</td>
                    <td>${this._formatBytes(s.totalBytes)}</td>
                  </tr>
                `;
              })}
            </tbody>
          </table>
        </div>
      </litro-tab-item>
    `;
  }
}

export default BenchmarksPage;
