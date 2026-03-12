import { html, css } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { customElement } from 'lit/decorators.js';
import { LitroPage } from '@beatzball/litro/runtime';
import { definePageData } from '@beatzball/litro';
import { createError } from 'h3';
import type { Post } from 'litro:content';
import { getPosts } from 'litro:content';
import { siteConfig } from '../../server/starlight.config.js';
import { extractHeadings, addHeadingIds } from '../../src/extract-headings.js';
import { applyHighlighting } from '../../src/highlight.js';
import { starlightHead } from '../../src/route-meta.js';
import { buildSeoHead } from '../../src/seo.js';

// Register components used in render()
import '../../src/components/starlight-page.js';

export interface DocPageData {
  doc: Post;
  body: string;
  toc: Array<{ depth: number; text: string; slug: string }>;
  sidebar: typeof siteConfig.sidebar;
  siteTitle: string;
  currentSlug: string;
  prevDoc: { label: string; href: string } | null;
  nextDoc: { label: string; href: string } | null;
  nav: typeof siteConfig.nav;
  editUrl: string | null;
  seoHead: string;
}

function computePrevNext(
  sidebar: typeof siteConfig.sidebar,
  currentSlug: string,
): { prevDoc: DocPageData['prevDoc']; nextDoc: DocPageData['nextDoc'] } {
  const flat = sidebar.flatMap(g => g.items);
  const idx = flat.findIndex(item => item.slug === currentSlug);
  return {
    prevDoc: idx > 0
      ? { label: flat[idx - 1].label, href: `/docs/${flat[idx - 1].slug}` }
      : null,
    nextDoc: idx < flat.length - 1
      ? { label: flat[idx + 1].label, href: `/docs/${flat[idx + 1].slug}` }
      : null,
  };
}

export const pageData = definePageData(async (event) => {
  const slug = event.context.params?.slug ?? '';

  const posts = await getPosts();
  const doc = posts.find(p => p.url === `/content/docs/${slug}`);

  if (!doc) {
    throw createError({ statusCode: 404, message: `Doc not found: ${slug}` });
  }

  const toc = extractHeadings(doc.rawBody);
  // Strip the first <h1> from the HTML body — starlight-page renders the
  // page title from the frontmatter `title` field as its own styled <h1>.
  // Keeping the Markdown's leading # heading would produce duplicate <h1>s.
  const body = applyHighlighting(
    addHeadingIds(doc.body).replace(/^<h1[^>]*>.*?<\/h1>\s*/is, ''),
  );
  const { prevDoc, nextDoc } = computePrevNext(siteConfig.sidebar, slug);
  const editUrl = siteConfig.editUrlBase
    ? `${siteConfig.editUrlBase}/content/docs/${slug}.md`
    : null;

  const seoHead = buildSeoHead({
    title: `${doc.title} — Litro`,
    description: (doc as Post & { description?: string }).description ?? siteConfig.description,
    path: `/docs/${slug}`,
    type: 'article',
  });

  return {
    doc,
    body,
    toc,
    sidebar: siteConfig.sidebar,
    siteTitle: siteConfig.title,
    currentSlug: slug,
    prevDoc,
    nextDoc,
    nav: siteConfig.nav,
    editUrl,
    seoHead,
  } satisfies DocPageData;
});

export async function generateRoutes(): Promise<string[]> {
  const posts = await getPosts();
  return posts
    .filter(p => p.url.startsWith('/content/docs/'))
    .map(p => '/docs' + p.url.slice('/content/docs'.length));
}

export const routeMeta = {
  head: starlightHead,
  title: 'Docs — Litro',
};

@customElement('page-docs-slug')
export class DocPage extends LitroPage {
  /**
   * Styles injected into page-docs-slug's shadow root so they reach the
   * <div slot="content"> subtree. Global stylesheets (starlight.css,
   * highlight.css) cannot pierce shadow DOM boundaries.
   */
  static override styles = css`
    /* ── Typography for slotted doc content ─────────────────────────── */
    h1, h2, h3, h4, h5, h6 {
      margin-top: 1.5em; margin-bottom: 0.5em;
      font-weight: 600; line-height: 1.25;
      color: var(--sl-color-text);
    }
    h1 { font-size: var(--sl-text-4xl, 2.25rem); }
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
    img { max-width: 100%; height: auto; }
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
    const data = this.serverData as DocPageData | null;
    if (!data?.doc) return html`<p>Loading&hellip;</p>`;

    return html`
      <starlight-page
        siteTitle="${data.siteTitle}"
        pageTitle="${data.doc.title}"
        .nav="${data.nav}"
        .sidebar="${data.sidebar}"
        .toc="${data.toc}"
        currentSlug="${data.currentSlug}"
        currentPath="/docs/${data.currentSlug}"
      >
        <div slot="content">
          ${unsafeHTML(data.body)}

          ${data.prevDoc || data.nextDoc ? html`
            <nav style="
              display:flex;
              justify-content:space-between;
              padding-top:2rem;
              margin-top:2rem;
              border-top:1px solid var(--sl-color-border);
              font-size:var(--sl-text-sm);
            " aria-label="Previous and next pages">
              ${data.prevDoc ? html`
                <a href="${data.prevDoc.href}" style="color:var(--sl-color-accent);text-decoration:none;">
                  &larr; ${data.prevDoc.label}
                </a>
              ` : html`<span></span>`}
              ${data.nextDoc ? html`
                <a href="${data.nextDoc.href}" style="color:var(--sl-color-accent);text-decoration:none;">
                  ${data.nextDoc.label} &rarr;
                </a>
              ` : ''}
            </nav>
          ` : ''}

          ${data.editUrl ? html`
            <p style="margin-top:1.5rem;font-size:var(--sl-text-xs);color:var(--sl-color-gray-4);">
              <a href="${data.editUrl}" style="color:var(--sl-color-accent);" target="_blank" rel="noopener">
                Edit this page
              </a>
            </p>
          ` : ''}
        </div>
      </starlight-page>
    `;
  }
}

export default DocPage;
