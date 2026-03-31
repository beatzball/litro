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

export interface ComparePageData {
  post: Post;
  body: string;
  siteTitle: string;
  nav: typeof siteConfig.nav;
  seoHead: string;
  seoTitle: string;
  slug: string;
}

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

  return {
    post,
    body,
    siteTitle: siteConfig.title,
    nav: siteConfig.nav,
    seoHead,
    seoTitle,
    slug,
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
    `,
  ];

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
        </main>
      </div>
    `;
  }
}

export default CompareSlugPage;
