import { html, css } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { customElement } from 'lit/decorators.js';
import { LitroPage } from '@beatzball/litro/runtime';
import { definePageData } from '@beatzball/litro';
import { createError } from 'h3';
import { siteConfig } from '../../../server/starlight.config.js';
import { extractHeadings, addHeadingIds } from '../../../src/extract-headings.js';
import { applyHighlighting } from '../../../src/highlight.js';
import { starlightHead } from '../../../src/route-meta.js';
import { buildSeoHead } from '../../../src/seo.js';
import { getPackageInfo, ALL_PACKAGE_SLUGS } from '../../../src/packages.js';
import type { PackageInfo } from '../../../src/packages.js';

import '../../../src/components/starlight-page.js';

export interface PkgPageData {
  pkg: PackageInfo;
  readmeBody: string;
  changelogBody: string;
  toc: ReturnType<typeof extractHeadings>;
  sidebar: typeof siteConfig.sidebar;
  siteTitle: string;
  currentSlug: string;
  nav: typeof siteConfig.nav;
  editUrl: string;
  seoHead: string;
}

export const pageData = definePageData(async (event) => {
  const slug = event.context.params?.pkg ?? '';
  const pkg = await getPackageInfo(slug);

  if (!pkg) {
    throw createError({ statusCode: 404, message: `Package not found: ${slug}` });
  }

  const readmeBody = applyHighlighting(addHeadingIds(pkg.readmeHtml));
  const changelogBody = applyHighlighting(addHeadingIds(pkg.changelogHtml));
  // TOC from both README and changelog headings
  const toc = extractHeadings(pkg.readmeMd + '\n' + pkg.changelogMd);
  const currentSlug = `packages/${slug}`;
  const editUrl =
    `https://github.com/beatzball/litro/blob/main/packages/${pkg.dir}/CHANGELOG.md`;

  const seoHead = buildSeoHead({
    title: `${pkg.name} — Litro`,
    description: pkg.description,
    path: `/docs/packages/${slug}`,
    type: 'article',
  });

  return {
    pkg,
    readmeBody,
    changelogBody,
    toc,
    sidebar: siteConfig.sidebar,
    siteTitle: siteConfig.title,
    currentSlug,
    nav: siteConfig.nav,
    editUrl,
    seoHead,
  } satisfies PkgPageData;
});

export async function generateRoutes(): Promise<string[]> {
  return ALL_PACKAGE_SLUGS.map(s => `/docs/packages/${s}`);
}

export const routeMeta = {
  head: starlightHead,
  title: 'Packages — Litro',
};

// SVG icon paths (inlined to avoid extra fetch)
const GITHUB_ICON = `<svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor" aria-hidden="true">
  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38
    0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13
    -.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66
    .07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15
    -.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0
    1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82
    1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01
    1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
</svg>`;

const NPM_ICON = `<svg viewBox="0 0 18 7" width="32" height="12" fill="currentColor" aria-hidden="true">
  <path d="M0 0h18v6H9V7H5V6H0zm1 5h2V2h1v3h1V1H1zm5-4v5h2V5h2V1zm2 1h1v2h-1zm3-1v4h2V2h1v3h1V2h1v3h1V1z"/>
</svg>`;

@customElement('page-docs-packages-pkg')
export class PkgPage extends LitroPage {
  static override styles = css`
    /* ── Package meta row (version badge + icon links) ───────────────── */
    .pkg-meta {
      display: flex;
      align-items: center;
      gap: 0.625rem;
      flex-wrap: wrap;
      margin: -0.75rem 0 1.25rem;
    }
    .pkg-version {
      font-size: var(--sl-text-sm, 0.875rem);
      font-weight: 500;
      background-color: var(--sl-color-accent-low, #fff7ed);
      color: var(--sl-color-accent, #ea580c);
      border: 1px solid color-mix(in srgb, var(--sl-color-accent, #ea580c) 30%, transparent);
      border-radius: 9999px;
      padding: 0.2em 0.75em;
      font-family: var(--sl-font-mono, ui-monospace, monospace);
    }
    .pkg-icon-link {
      display: inline-flex;
      align-items: center;
      color: var(--sl-color-gray-4, #9ca3af);
      text-decoration: none;
      transition: color 0.15s;
    }
    .pkg-icon-link:hover { color: var(--sl-color-text, #23262f); }

    /* ── Description + install ───────────────────────────────────────── */
    .pkg-description {
      font-size: var(--sl-text-lg, 1.125rem);
      color: var(--sl-color-gray-3, #6b7280);
      margin: 0 0 1.25rem;
      line-height: 1.6;
    }
    .pkg-install {
      margin-bottom: 2rem;
    }
    .pkg-install pre {
      margin: 0;
      padding: 0.75rem 1rem;
      background-color: #0d0e11;
      color: #e2e4e9;
      border-radius: 0.375rem;
      font-size: var(--sl-text-sm, 0.875rem);
      font-family: var(--sl-font-mono, ui-monospace, monospace);
      overflow-x: auto;
      line-height: 1.8;
    }

    /* ── Section dividers ────────────────────────────────────────────── */
    .section-heading {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--sl-color-gray-4, #9ca3af);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin: 2.5rem 0 1rem;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid var(--sl-color-border, #e8e8e8);
    }

    /* ── Typography (same as DocPage) ────────────────────────────────── */
    h1, h2, h3, h4, h5, h6 {
      margin-top: 1.5em; margin-bottom: 0.5em;
      font-weight: 600; line-height: 1.25;
      color: var(--sl-color-text);
    }
    h2 { font-size: var(--sl-text-2xl, 1.5rem); border-bottom: 1px solid var(--sl-color-border, #e8e8e8); padding-bottom: 0.25em; }
    h3 { font-size: var(--sl-text-xl, 1.25rem); }
    h4 { font-size: var(--sl-text-lg, 1.125rem); }
    p  { margin-top: 0; margin-bottom: 1rem; line-height: 1.7; }
    a  { color: var(--sl-color-text-accent, var(--sl-color-accent)); text-decoration: none; }
    a:hover { text-decoration: underline; }
    code {
      font-family: var(--sl-font-mono, ui-monospace, monospace);
      font-size: 0.875em;
      background-color: var(--sl-color-bg-inline-code, #e8e8e8);
      border: 1px solid var(--sl-color-border, #e8e8e8);
      border-radius: 0.25rem;
      padding: 0.15em 0.4em;
    }
    pre {
      background-color: #0d0e11;
      color: #e2e4e9;
      border-radius: 0.375rem;
      padding: 1rem 1.25rem;
      overflow-x: auto;
      margin: 1.5rem 0;
      font-size: var(--sl-text-sm, 0.875rem);
      line-height: 1.6;
    }
    pre code { background: none; border: none; padding: 0; font-size: inherit; }
    ul, ol { padding-left: 1.5rem; margin: 0 0 1rem; }
    li { margin-bottom: 0.25rem; line-height: 1.7; }
    blockquote {
      margin: 1.5rem 0; padding: 0.75rem 1rem;
      border-left: 4px solid var(--sl-color-accent, #ea580c);
      background-color: var(--sl-color-accent-low, #fff7ed);
      border-radius: 0 0.375rem 0.375rem 0;
    }
    hr { border: none; border-top: 1px solid var(--sl-color-border, #e8e8e8); margin: 2rem 0; }
    table { width: 100%; border-collapse: collapse; margin: 1.5rem 0; font-size: var(--sl-text-sm, 0.875rem); }
    th, td { border: 1px solid var(--sl-color-border, #e8e8e8); padding: 0.5rem 0.75rem; text-align: left; }
    th { background-color: var(--sl-color-gray-1, #f6f6f6); font-weight: 600; }

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
  `;

  override render() {
    const data = this.serverData as PkgPageData | null;
    if (!data?.pkg) return html`<p>Loading&hellip;</p>`;

    const { pkg } = data;

    return html`
      <starlight-page
        siteTitle="${data.siteTitle}"
        pageTitle="${pkg.name}"
        .nav="${data.nav}"
        .sidebar="${data.sidebar}"
        .toc="${data.toc}"
        currentSlug="${data.currentSlug}"
        currentPath="/docs/${data.currentSlug}"
      >
        <div slot="content">
          <!-- Version badge + icon links, visually grouped with the title above -->
          <div class="pkg-meta">
            <span class="pkg-version">v${pkg.version}</span>
            <a
              class="pkg-icon-link"
              href="https://github.com/beatzball/litro/tree/main/packages/${pkg.dir}"
              target="_blank"
              rel="noopener"
              title="GitHub source"
            >${unsafeHTML(GITHUB_ICON)}</a>
            <a
              class="pkg-icon-link"
              href="https://www.npmjs.com/package/${pkg.name}"
              target="_blank"
              rel="noopener"
              title="View on npm"
            >${unsafeHTML(NPM_ICON)}</a>
          </div>

          <p class="pkg-description">${pkg.description}</p>

          <div class="pkg-install">
            <pre>npm install ${pkg.name}\npnpm add ${pkg.name}</pre>
          </div>

          ${data.readmeBody ? unsafeHTML(data.readmeBody) : ''}

          <p class="section-heading">Changelog</p>
          ${unsafeHTML(data.changelogBody)}

          <p style="margin-top:1.5rem;font-size:var(--sl-text-xs);color:var(--sl-color-gray-4);">
            <a href="${data.editUrl}" style="color:var(--sl-color-accent);" target="_blank" rel="noopener">
              View CHANGELOG.md on GitHub
            </a>
          </p>
        </div>
      </starlight-page>
    `;
  }
}

export default PkgPage;
