import { html, unsafeHTML } from '@elenajs/core';
import { LitroPage } from '@beatzball/litro/adapter/elena/page';
import { definePageData } from '@beatzball/litro';
import { createError } from 'h3';
import type { Post } from 'litro:content';
import { getPosts } from 'litro:content';
import { siteConfig } from '../../server/starlight.config.js';
import { extractHeadings, addHeadingIds } from '../../src/extract-headings.js';
import { applyHighlighting } from '../../src/highlight.js';
import { starlightHead } from '../../src/route-meta.js';
// Re-exporting child components prevents Rollup tree-shaking.
export { StarlightPage } from '../../src/components/starlight-page.js';

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
  const body = applyHighlighting(addHeadingIds(doc.body));
  const { prevDoc, nextDoc } = computePrevNext(siteConfig.sidebar, slug);
  const editUrl = siteConfig.editUrlBase
    ? `${siteConfig.editUrlBase}/content/docs/${slug}.md`
    : null;

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
  title: 'Docs — {{projectName}}',
};

export class DocPage extends LitroPage {
  static override tagName = 'page-docs-slug';

  render() {
    const data = this.serverData as DocPageData | null;
    if (!data?.doc) return html`<p>Loading&hellip;</p>`;

    const { doc, body, sidebar, siteTitle, currentSlug, toc, nav, prevDoc, nextDoc, editUrl } = data;

    // Prev/next
    const prevHtml = prevDoc
      ? `<a href="${prevDoc.href}" class="prev-next-link">&larr; ${prevDoc.label}</a>`
      : '<span></span>';
    const nextHtml = nextDoc
      ? `<a href="${nextDoc.href}" class="prev-next-link">${nextDoc.label} &rarr;</a>`
      : '';
    const prevNextHtml = (prevDoc || nextDoc)
      ? `<nav class="prev-next" aria-label="Previous and next pages">${prevHtml}${nextHtml}</nav>`
      : '';

    const editHtml = editUrl
      ? `<p class="edit-link"><a href="${editUrl}" target="_blank" rel="noopener">Edit this page</a></p>`
      : '';

    return html`
      <style>
        @scope (page-docs-slug) {
          :scope { display: block; }

          /* Prev/next */
          .prev-next { display: flex; justify-content: space-between; padding-top: 2rem; margin-top: 2rem; border-top: 1px solid var(--sl-color-border); font-size: var(--sl-text-sm); }
          .prev-next-link { color: var(--sl-color-accent); text-decoration: none; }
          .edit-link { margin-top: 1.5rem; font-size: var(--sl-text-xs); color: var(--sl-color-gray-4); }
          .edit-link a { color: var(--sl-color-accent); }

          /* Doc content typography */
          .doc-body h1, .doc-body h2, .doc-body h3, .doc-body h4, .doc-body h5, .doc-body h6 { margin-top: 1.5em; margin-bottom: 0.5em; font-weight: 600; line-height: 1.25; color: var(--sl-color-text); }
          .doc-body h1 { font-size: var(--sl-text-4xl, 2.25rem); }
          .doc-body h2 { font-size: var(--sl-text-2xl, 1.5rem); border-bottom: 1px solid var(--sl-color-border, #e8e8e8); padding-bottom: 0.25em; }
          .doc-body h3 { font-size: var(--sl-text-xl, 1.25rem); }
          .doc-body h4 { font-size: var(--sl-text-lg, 1.125rem); }
          .doc-body p { margin-top: 0; margin-bottom: 1rem; line-height: 1.7; }
          .doc-body a { color: var(--sl-color-text-accent, var(--sl-color-accent)); text-decoration: none; }
          .doc-body a:hover { text-decoration: underline; }
          .doc-body code { font-family: var(--sl-font-mono, ui-monospace, monospace); font-size: 0.875em; background-color: var(--sl-color-bg-inline-code, #e8e8e8); border: 1px solid var(--sl-color-border, #e8e8e8); border-radius: 0.25rem; padding: 0.15em 0.4em; }
          .doc-body pre { background-color: #0d0e11; color: #e2e4e9; border-radius: 0.375rem; padding: 1rem 1.25rem; overflow-x: auto; margin: 1.5rem 0; font-size: var(--sl-text-sm, 0.875rem); line-height: 1.6; }
          .doc-body pre code { background: none; border: none; padding: 0; font-size: inherit; }
          .doc-body ul, .doc-body ol { padding-left: 1.5rem; margin: 0 0 1rem; }
          .doc-body li { margin-bottom: 0.25rem; line-height: 1.7; }
          .doc-body blockquote { margin: 1.5rem 0; padding: 0.75rem 1rem; border-left: 4px solid var(--sl-color-accent, #ea580c); background-color: var(--sl-color-accent-low, #fff7ed); border-radius: 0 0.375rem 0.375rem 0; }
          .doc-body hr { border: none; border-top: 1px solid var(--sl-color-border, #e8e8e8); margin: 2rem 0; }
          .doc-body img { max-width: 100%; height: auto; }
          .doc-body table { width: 100%; border-collapse: collapse; margin: 1.5rem 0; font-size: var(--sl-text-sm, 0.875rem); }
          .doc-body th, .doc-body td { border: 1px solid var(--sl-color-border, #e8e8e8); padding: 0.5rem 0.75rem; text-align: left; }
          .doc-body th { background-color: var(--sl-color-gray-1, #f6f6f6); font-weight: 600; }

          /* highlight.js fire theme */
          .doc-body pre:has(.hljs) { background-color: #0d0d10; color: #cbd5e1; }
          .doc-body .hljs { color: #cbd5e1; background: transparent; }
          .doc-body .hljs-keyword, .doc-body .hljs-selector-tag, .doc-body .hljs-tag { color: #f97316; }
          .doc-body .hljs-string, .doc-body .hljs-attr, .doc-body .hljs-attribute { color: #38bdf8; }
          .doc-body .hljs-number, .doc-body .hljs-literal { color: #fbbf24; }
          .doc-body .hljs-title, .doc-body .hljs-title.class_, .doc-body .hljs-title.function_, .doc-body .hljs-built_in { color: #fb923c; }
          .doc-body .hljs-comment { color: #6b7280; font-style: italic; }
          .doc-body .hljs-variable, .doc-body .hljs-params { color: #cbd5e1; }
          .doc-body .hljs-operator, .doc-body .hljs-punctuation { color: #94a3b8; }
          .doc-body .hljs-meta, .doc-body .hljs-meta .hljs-keyword { color: #38bdf8; }
          .doc-body .hljs-type { color: #fb923c; }
        }
      </style>
      <starlight-page
        sitetitle="${siteTitle}"
        pagetitle="${doc.title}"
        nav="${JSON.stringify(nav)}"
        sidebar="${JSON.stringify(sidebar)}"
        toc="${JSON.stringify(toc)}"
        currentslug="${currentSlug}"
        currentpath="${'/docs/' + currentSlug}"
      >
        <div class="doc-body">${unsafeHTML(body)}</div>
        ${unsafeHTML(prevNextHtml)}
        ${unsafeHTML(editHtml)}
      </starlight-page>
    `;
  }
}

DocPage.define();

export default DocPage;
