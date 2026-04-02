import { html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import { LitroPage } from '@beatzball/litro/runtime';
import { definePageData } from '@beatzball/litro';
import { siteConfig } from '../../server/starlight.config.js';
import { starlightHead } from '@beatzball/litro-docs-ui/src/route-meta.js';
import { buildSeoHead, buildJsonLd } from '@beatzball/litro-docs-ui/src/seo.js';
import { compareStyles } from '@beatzball/litro-docs-ui/src/compare-styles.js';

// Register components used in render()
import '@beatzball/litro-docs-ui/src/components/starlight-header.js';
import '@beatzball/litro-docs-ui/src/components/litro-card.js';
import '@beatzball/litro-docs-ui/src/components/litro-card-grid.js';
import '@beatzball/litro-docs-ui/src/components/litro-badge.js';

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

interface PageWeightRoute {
  rawBytes: number;
  gzipBytes: number;
  statusCode: number;
}

interface FrameworkResult {
  name: string;
  version: string;
  buildTime: Stats;
  outputSize: number;
  pageWeight: Record<string, PageWeightRoute>;
}

interface CompareIndexData {
  frameworks: FrameworkResult[];
  siteTitle: string;
  nav: typeof siteConfig.nav;
  seoHead: string;
  seoTitle: string;
}

/* ── Server data ──────────────────────────────────────────────────────── */

export const pageData = definePageData(async (_event) => {
  const { readFile } = await import('node:fs/promises');
  const { resolve } = await import('node:path');
  const jsonPath = resolve(process.cwd(), '..', 'benchmarks', 'results', 'latest.json');

  let frameworks: FrameworkResult[] = [];
  try {
    const raw = await readFile(jsonPath, 'utf-8');
    const results = JSON.parse(raw);
    frameworks = results.crossFramework ?? [];
  } catch {
    // No benchmark data yet — page renders without it
  }

  const seoTitle = 'Compare Litro — Litro';
  const seoHead = buildSeoHead({
    title: seoTitle,
    description: 'See how Litro compares to Next.js, Nuxt, and Enhance. Feature comparisons, migration guides, and real performance benchmarks.',
    path: '/compare',
    type: 'website',
  }) + buildJsonLd({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    'name': 'Compare Litro',
    'description': 'Cross-framework comparison: Litro vs Next.js, Nuxt, and Enhance.',
    'url': 'https://litro.dev/compare',
  });

  return {
    frameworks,
    siteTitle: siteConfig.title,
    nav: siteConfig.nav,
    seoHead,
    seoTitle,
  } satisfies CompareIndexData;
});

export const routeMeta = {
  head: starlightHead,
  title: 'Compare — Litro',
};

/* ── Component ────────────────────────────────────────────────────────── */

@customElement('page-compare')
export class CompareIndexPage extends LitroPage {
  static override styles = [
    compareStyles,
    css`
      /* ── Summary cards ─────────────────────────────────────────────── */
      .summary-section {
        margin-bottom: 2.5rem;
      }
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
      .fw-card-row .fw-name { font-weight: 500; }
      .fw-card-row .fw-value { font-variant-numeric: tabular-nums; }
      .winner-value {
        color: var(--sl-color-tip, #15803d);
        font-weight: 600;
      }
      .card-badge { margin-top: 0.6rem; }

      /* ── Comparison grid ───────────────────────────────────────────── */
      .compare-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 1.5rem;
        margin: 2rem 0;
      }
      .compare-link {
        display: block;
        padding: 1.5rem;
        border: 1px solid var(--sl-color-border, #e2e8f0);
        border-radius: 0.75rem;
        text-decoration: none;
        color: var(--sl-color-text);
        transition: border-color 0.15s, box-shadow 0.15s;
      }
      .compare-link:hover {
        border-color: var(--sl-color-accent, #ea580c);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
        text-decoration: none;
      }
      .compare-link h3 {
        margin: 0 0 0.5rem;
        font-size: var(--sl-text-lg, 1.125rem);
        border-bottom: none;
      }
      .compare-link p {
        margin: 0;
        font-size: var(--sl-text-sm, 0.875rem);
        color: var(--sl-color-gray-5, #6b7280);
      }
      .compare-link .arrow {
        display: inline-block;
        margin-left: 0.25rem;
        transition: transform 0.15s;
      }
      .compare-link:hover .arrow {
        transform: translateX(3px);
      }

      /* ── Benchmark note ────────────────────────────────────────────── */
      .note {
        font-size: var(--sl-text-sm, 0.875rem);
        color: var(--sl-color-gray-4, #9ca3af);
        margin-bottom: 1rem;
        line-height: 1.6;
      }
      .bench-link {
        margin-top: 1rem;
        font-size: var(--sl-text-sm, 0.875rem);
      }

      /* ── Winner highlight table ────────────────────────────────────── */
      .winner-cell {
        color: var(--sl-color-tip, #15803d);
        font-weight: 600;
      }
      caption {
        text-align: left;
        font-size: var(--sl-text-sm, 0.875rem);
        color: var(--sl-color-gray-4, #9ca3af);
        padding: 0.5rem 1rem;
        caption-side: bottom;
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

  private _fwWinnerIdx(values: number[], lowerIsBetter: boolean): number {
    if (values.length === 0) return -1;
    const target = lowerIsBetter ? Math.min(...values) : Math.max(...values);
    return values.indexOf(target);
  }

  /* ── Render ──────────────────────────────────────────────────────── */

  override render() {
    const data = this.serverData as CompareIndexData | null;
    if (!data) return html`<p>Loading...</p>`;

    const fw = data.frameworks;
    const hasBench = fw.length > 0;

    return html`
      <div class="page">
        <starlight-header
          siteTitle="${data.siteTitle}"
          .nav="${data.nav}"
          currentPath="/compare"
          .spaNav="${true}"
        ></starlight-header>
        <main>
          <h1>Compare Litro</h1>
          <p class="intro">
            See how Litro stacks up against the most popular fullstack frameworks.
            Feature-by-feature comparisons, real benchmarks, and migration guides.
          </p>

          ${hasBench ? this._benchmarkSummary(fw) : ''}

          <h2>Framework Comparisons</h2>
          <div class="compare-grid">
            <a class="compare-link" href="/compare/nextjs">
              <h3>Litro vs Next.js <span class="arrow">-></span></h3>
              <p>React's dominant fullstack framework. Compare component models, routing, SSR strategies, and bundle sizes.</p>
            </a>
            <a class="compare-link" href="/compare/nuxt">
              <h3>Litro vs Nuxt <span class="arrow">-></span></h3>
              <p>Vue's fullstack framework, also powered by Nitro. Compare the shared server engine with different component models.</p>
            </a>
            <a class="compare-link" href="/compare/enhance">
              <h3>Litro vs Enhance <span class="arrow">-></span></h3>
              <p>Another web-components-first framework. Compare approaches to SSR, routing, and progressive enhancement.</p>
            </a>
          </div>

          ${hasBench ? this._benchmarkTable(fw) : ''}

          <p class="bench-link">
            <a href="/benchmarks">Full benchmark methodology, SSG vs SSR internals, and raw data -></a>
          </p>
        </main>
      </div>
    `;
  }

  /* ── Partials ───────────────────────────────────────────────────── */

  private _benchmarkSummary(frameworks: FrameworkResult[]) {
    const buildWinnerIdx = this._fwWinnerIdx(frameworks.map(f => f.buildTime.mean), true);
    const sizeWinnerIdx = this._fwWinnerIdx(frameworks.map(f => f.outputSize), true);

    const routes = Object.keys(frameworks[0]?.pageWeight ?? {});
    const avgGzips = frameworks.map(fw => {
      if (routes.length === 0) return 0;
      return routes.reduce((s, rt) => s + (fw.pageWeight[rt]?.gzipBytes ?? 0), 0) / routes.length;
    });
    const weightWinnerIdx = this._fwWinnerIdx(avgGzips, true);

    return html`
      <h2>Performance at a Glance</h2>
      <p class="note">
        Identical minimal apps (2 routes, same content) built in SSG mode.
      </p>

      <section class="summary-section" aria-label="Cross-framework performance summary">
        <litro-card-grid>
          ${this._fwCard('Build Time', frameworks, fw => this._formatMs(fw.buildTime.mean), buildWinnerIdx)}
          ${this._fwCard('Output Size', frameworks, fw => this._formatBytes(fw.outputSize), sizeWinnerIdx)}
          ${routes.length > 0 ? this._fwCard('Avg Page Weight', frameworks, (_, i) => this._formatBytes(avgGzips[i]), weightWinnerIdx) : ''}
        </litro-card-grid>
      </section>
    `;
  }

  private _fwCard(
    title: string,
    frameworks: FrameworkResult[],
    valueFn: (fw: FrameworkResult, i: number) => string,
    winnerIdx: number,
  ) {
    return html`
      <litro-card title="${title}">
        <div class="fw-card-values">
          ${frameworks.map((fw, i) => html`
            <div class="fw-card-row">
              <span class="fw-name">${fw.name}</span>
              <span class="fw-value ${i === winnerIdx ? 'winner-value' : ''}">${valueFn(fw, i)}</span>
            </div>
          `)}
        </div>
        <div class="card-badge">
          <litro-badge variant="tip" text="${frameworks[winnerIdx]?.name ?? ''} wins"></litro-badge>
        </div>
      </litro-card>
    `;
  }

  private _benchmarkTable(frameworks: FrameworkResult[]) {
    const buildWinnerIdx = this._fwWinnerIdx(frameworks.map(f => f.buildTime.mean), true);
    const sizeWinnerIdx = this._fwWinnerIdx(frameworks.map(f => f.outputSize), true);
    const maxOutput = Math.max(...frameworks.map(f => f.outputSize));

    return html`
      <h2>Benchmark Overview</h2>
      <div class="table-wrap">
        <table>
          <caption>Production SSG build on identical minimal apps (${frameworks[0]?.buildTime.runs?.length ?? '?'} runs).</caption>
          <thead>
            <tr>
              <th scope="col">Framework</th>
              <th scope="col">Version</th>
              <th scope="col">Build Time</th>
              <th scope="col">Output Size</th>
              <th scope="col">Relative Size</th>
            </tr>
          </thead>
          <tbody>
            ${frameworks.map((fw, i) => {
              const pct = maxOutput > 0 ? (fw.outputSize / maxOutput) * 100 : 0;
              return html`
                <tr>
                  <th scope="row">${fw.name}</th>
                  <td>${fw.version}</td>
                  <td class="${i === buildWinnerIdx ? 'winner-cell' : ''}">${this._formatMs(fw.buildTime.mean)}</td>
                  <td class="${i === sizeWinnerIdx ? 'winner-cell' : ''}">${this._formatBytes(fw.outputSize)}</td>
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
    `;
  }
}

export default CompareIndexPage;
