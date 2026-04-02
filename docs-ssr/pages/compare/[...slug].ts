import { html, css } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { customElement } from 'lit/decorators.js';
import { LitroPage } from '@beatzball/litro/runtime';
import { definePageData } from '@beatzball/litro';
import { createError } from 'h3';
import { getPosts } from 'litro:content';
import type { Post } from 'litro:content';
import { previewPosts } from '../../server/utils/preview.js';
import { siteConfig } from '../../server/starlight.config.js';
import { starlightHead } from '@beatzball/litro-docs-ui/src/route-meta.js';
import { buildSeoHead, buildJsonLd } from '@beatzball/litro-docs-ui/src/seo.js';
import { addHeadingIds } from '@beatzball/litro-docs-ui/src/extract-headings.js';
import { applyHighlighting } from '@beatzball/litro-docs-ui/src/highlight.js';
import { compareStyles } from '@beatzball/litro-docs-ui/src/compare-styles.js';

// Register components used in render()
import '@beatzball/litro-docs-ui/src/components/starlight-header.js';
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

const SLUG_TO_FRAMEWORK: Record<string, string> = {
  nextjs: 'nextjs',
  nuxt: 'nuxt',
};

export interface ComparePageData {
  post: Post;
  body: string;
  siteTitle: string;
  nav: typeof siteConfig.nav;
  seoHead: string;
  seoTitle: string;
  slug: string;
  litro: FrameworkResult | null;
  competitor: FrameworkResult | null;
}

/* ── Server data ──────────────────────────────────────────────────────── */

export const pageData = definePageData(async (event) => {
  const slug = event.context.params?.slug ?? '';

  const posts = await previewPosts(event);
  const post = posts.find(p => p.url === `/content/compare/${slug}`);

  if (!post) {
    throw createError({ statusCode: 404, message: `Compare page not found: ${slug}` });
  }

  const body = applyHighlighting(addHeadingIds(post.body));

  const description = (post as Post & { description?: string }).description ?? siteConfig.description;
  const seoTitle = `${post.title} — Litro`;
  const seoHead = buildSeoHead({
    title: seoTitle,
    description,
    path: `/compare/${slug}`,
    type: 'article',
  }) + buildJsonLd({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    'name': seoTitle,
    'description': description,
    'url': `https://litro.dev/compare/${slug}`,
  });

  let litro: FrameworkResult | null = null;
  let competitor: FrameworkResult | null = null;
  const fwName = SLUG_TO_FRAMEWORK[slug];
  if (fwName) {
    try {
      const { readFile } = await import('node:fs/promises');
      const { resolve } = await import('node:path');
      const jsonPath = resolve(process.cwd(), '..', 'benchmarks', 'results', 'latest.json');
      const raw = await readFile(jsonPath, 'utf-8');
      const results = JSON.parse(raw);
      const frameworks: FrameworkResult[] = results.crossFramework ?? [];
      litro = frameworks.find(f => f.name === 'litro') ?? null;
      competitor = frameworks.find(f => f.name === fwName) ?? null;
    } catch {
      // No benchmark data
    }
  }

  return {
    post,
    body,
    siteTitle: siteConfig.title,
    nav: siteConfig.nav,
    seoHead,
    seoTitle,
    slug,
    litro,
    competitor,
  } satisfies ComparePageData;
});

export async function generateRoutes(): Promise<string[]> {
  const posts = await getPosts();
  return posts
    .filter(p => p.url.startsWith('/content/compare/'))
    .map(p => '/compare' + p.url.slice('/content/compare'.length));
}

export const routeMeta = {
  head: starlightHead,
  title: 'Compare — Litro',
};

/* ── Component ────────────────────────────────────────────────────────── */

@customElement('page-compare-slug')
export class CompareSlugPage extends LitroPage {
  static override styles = [
    compareStyles,
    css`
      /* ── highlight.js fire theme ─────────────────────────────────────── */
      pre:has(.hljs) { background-color: #0d0d10; color: #cbd5e1; }
      .hljs { color: #cbd5e1; background: transparent; }
      .hljs-keyword, .hljs-selector-tag, .hljs-tag { color: #f97316; }
      .hljs-string, .hljs-attr, .hljs-attribute { color: #38bdf8; }
      .hljs-number, .hljs-literal { color: #fbbf24; }
      .hljs-title, .hljs-title.class_, .hljs-title.function_, .hljs-built_in { color: #fb923c; }
      .hljs-comment { color: #6b7280; font-style: italic; }
      .hljs-variable, .hljs-params { color: #cbd5e1; }
      .hljs-operator, .hljs-punctuation { color: #94a3b8; }
      .hljs-meta, .hljs-meta .hljs-keyword { color: #38bdf8; }
      .hljs-type { color: #fb923c; }
      .hljs-deletion { color: #f87171; background: rgba(248,113,113,.1); }
      .hljs-addition { color: #4ade80; background: rgba(74,222,128,.1); }
      .hljs-section, .hljs-selector-class, .hljs-selector-id { color: #fb923c; }
      .hljs-symbol, .hljs-bullet, .hljs-link { color: #38bdf8; }
      .hljs-emphasis { font-style: italic; }
      .hljs-strong { font-weight: bold; }

      /* ── Benchmark section ───────────────────────────────────────────── */
      .perf-section {
        margin-top: 3rem;
        padding-top: 2rem;
        border-top: 1px solid var(--sl-color-border, #e2e8f0);
      }
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
      .note {
        font-size: var(--sl-text-sm, 0.875rem);
        color: var(--sl-color-gray-4, #9ca3af);
        margin-bottom: 1rem;
        line-height: 1.6;
      }
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
      .bench-link {
        margin-top: 1rem;
        font-size: var(--sl-text-sm, 0.875rem);
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

  /* ── Render ──────────────────────────────────────────────────────── */

  override render() {
    const data = this.serverData as ComparePageData | null;
    if (!data) return html`<p>Loading&hellip;</p>`;

    return html`
      <div class="page">
        <starlight-header
          siteTitle="${data.siteTitle}"
          .nav="${data.nav}"
          currentPath="/compare/${data.slug}"
          .spaNav="${true}"
        ></starlight-header>
        <main>
          ${unsafeHTML(data.body)}
          ${data.litro && data.competitor ? this._perfSection(data.litro, data.competitor) : ''}
        </main>
      </div>
    `;
  }

  /* ── Performance section ────────────────────────────────────────── */

  private _perfSection(litro: FrameworkResult, competitor: FrameworkResult) {
    const frameworks = [litro, competitor];
    const routes = Object.keys(litro.pageWeight);
    const maxOutput = Math.max(litro.outputSize, competitor.outputSize);
    const buildFaster = litro.buildTime.mean <= competitor.buildTime.mean ? 0 : 1;
    const smaller = litro.outputSize <= competitor.outputSize ? 0 : 1;

    return html`
      <div class="perf-section">
        <h2>Performance</h2>
        <p class="note">
          Real benchmarks from identical minimal apps (2 routes, same content) built in SSG mode.
        </p>

        <h3>Build Time</h3>
        <div class="table-wrap">
          <table>
            <caption>Production build (${litro.buildTime.runs?.length ?? '?'} runs).</caption>
            <thead>
              <tr>
                <th scope="col">Framework</th>
                <th scope="col">Version</th>
                <th scope="col">Mean</th>
                <th scope="col">Median</th>
                <th scope="col">p95</th>
              </tr>
            </thead>
            <tbody>
              ${frameworks.map((fw, i) => html`
                <tr>
                  <th scope="row">${fw.name}</th>
                  <td>${fw.version}</td>
                  <td class="${i === buildFaster ? 'winner-cell' : ''}">${this._formatMs(fw.buildTime.mean)}</td>
                  <td>${this._formatMs(fw.buildTime.median)}</td>
                  <td>${this._formatMs(fw.buildTime.p95)}</td>
                </tr>
              `)}
            </tbody>
          </table>
        </div>

        <h3>Output Size</h3>
        <div class="table-wrap">
          <table>
            <caption>Total build output on disk.</caption>
            <thead>
              <tr>
                <th scope="col">Framework</th>
                <th scope="col">Size</th>
                <th scope="col">Relative</th>
              </tr>
            </thead>
            <tbody>
              ${frameworks.map((fw, i) => {
                const pct = maxOutput > 0 ? (fw.outputSize / maxOutput) * 100 : 0;
                return html`
                  <tr>
                    <th scope="row">${fw.name}</th>
                    <td class="${i === smaller ? 'winner-cell' : ''}">${this._formatBytes(fw.outputSize)}</td>
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

        ${routes.length > 0 ? html`
          <h3>Page Weight</h3>
          <div class="table-wrap">
            <table>
              <caption>HTML response size per route (gzip-compressed).</caption>
              <thead>
                <tr>
                  <th scope="col">Route</th>
                  ${frameworks.map(fw => html`<th scope="col">${fw.name}</th>`)}
                  <th scope="col">Smaller</th>
                </tr>
              </thead>
              <tbody>
                ${routes.map(rt => {
                  const a = litro.pageWeight[rt]?.gzipBytes ?? Infinity;
                  const b = competitor.pageWeight[rt]?.gzipBytes ?? Infinity;
                  const winnerIdx = a <= b ? 0 : 1;
                  return html`
                    <tr>
                      <th scope="row"><code>${rt}</code></th>
                      ${frameworks.map((fw, i) => {
                        const pw = fw.pageWeight[rt];
                        if (!pw) return html`<td>-</td>`;
                        return html`<td class="${i === winnerIdx ? 'winner-cell' : ''}">${this._formatBytes(pw.gzipBytes)}</td>`;
                      })}
                      <td>${frameworks[winnerIdx].name}</td>
                    </tr>
                  `;
                })}
              </tbody>
            </table>
          </div>
        ` : ''}

        <p class="bench-link">
          <a href="/benchmarks">See full benchmarks with all frameworks -></a>
        </p>
      </div>
    `;
  }
}

export default CompareSlugPage;
