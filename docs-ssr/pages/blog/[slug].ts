import { html, css } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { customElement } from 'lit/decorators.js';
import { LitroPage } from '@beatzball/litro/runtime';
import { definePageData } from '@beatzball/litro';
import { createError } from 'h3';
import type { Post } from 'litro:content';
import { getPosts } from 'litro:content';
import { previewPosts, isPreview } from '../../server/utils/preview.js';
import { siteConfig } from '../../server/starlight.config.js';
import { extractHeadings, addHeadingIds } from '@beatzball/litro-docs-ui/src/extract-headings.js';
import { applyHighlighting } from '@beatzball/litro-docs-ui/src/highlight.js';
import { starlightHead } from '@beatzball/litro-docs-ui/src/route-meta.js';
import { buildSeoHead, buildJsonLd } from '@beatzball/litro-docs-ui/src/seo.js';
import { formatDate, isoDate } from '@beatzball/litro-docs-ui/src/date-utils.js';

// Register components used in render()
import '@beatzball/litro-docs-ui/src/components/starlight-header.js';
import '@beatzball/litro-docs-ui/src/components/preview-banner.js';

export interface BlogPostData {
  post: Post;
  body: string;
  toc: Array<{ depth: number; text: string; slug: string }>;
  siteTitle: string;
  nav: typeof siteConfig.nav;
  seoHead: string;
  seoTitle: string;
  preview: boolean;
}

export const pageData = definePageData(async (event) => {
  const slug = event.context.params?.slug ?? '';

  // Content URLs are /content/blog/<slug> (contentDir = 'content')
  const posts = await previewPosts(event);
  const post = posts.find(p => p.url === `/content/blog/${slug}`);

  if (!post) {
    throw createError({ statusCode: 404, message: `Post not found: ${slug}` });
  }

  const toc = extractHeadings(post.rawBody);
  const body = applyHighlighting(
    addHeadingIds(post.body).replace(/^<h1[^>]*>.*?<\/h1>\s*/is, ''),
  );
  const blogSlug = post.url.slice('/content/blog/'.length);
  const postDescription = (post as Post & { description?: string }).description ?? '';
  const seoTitle = `${post.title} — Litro Blog`;
  const seoHead = buildSeoHead({
    title: seoTitle,
    description: postDescription,
    path: `/blog/${blogSlug}`,
    type: 'article',
  }) + buildJsonLd({
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": post.title,
    "description": postDescription,
    "datePublished": isoDate(post.date),
    "url": `https://litro.dev/blog/${blogSlug}`,
    "author": { "@type": "Organization", "name": "beatzball" },
    "keywords": post.tags.join(', '),
  });

  return {
    post,
    body,
    toc,
    siteTitle: siteConfig.title,
    nav: siteConfig.nav,
    seoHead,
    seoTitle,
    preview: isPreview(event),
  } satisfies BlogPostData;
});

export async function generateRoutes(): Promise<string[]> {
  const posts = await getPosts();
  return posts
    .filter(p => p.url.startsWith('/content/blog/'))
    .map(p => '/blog' + p.url.slice('/content/blog'.length));
}

export const routeMeta = {
  head: starlightHead,
  title: 'Blog — Litro',
};

@customElement('page-blog-slug')
export class BlogPostPage extends LitroPage {
  static override styles = css`
    /* ── Typography ──────────────────────────────────────────────────── */
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
    const data = this.serverData as BlogPostData | null;
    if (!data?.post) return html`<p>Loading&hellip;</p>`;

    const { post, body, siteTitle, nav, preview } = data;
    const blogSlug = post.url.slice('/content/blog/'.length);

    return html`
      <div style="min-height:100vh;display:flex;flex-direction:column;">
        <starlight-header
          siteTitle="${siteTitle}"
          .nav="${nav}"
          currentPath="/blog/${blogSlug}"
          .spaNav="${true}"
        ></starlight-header>
        <main style="
          flex:1;
          max-width:52rem;
          margin:0 auto;
          padding:var(--sl-content-pad-y,2rem) var(--sl-content-pad-x,1.5rem);
          width:100%;
        ">
          <article>
            <header style="margin-bottom:2rem;">
              <h1 style="font-size:var(--sl-text-4xl);font-weight:700;margin:0 0 0.75rem;line-height:1.15;">
                ${post.title}
              </h1>
              <time
                datetime="${isoDate(post.date)}"
                style="font-size:var(--sl-text-sm);color:var(--sl-color-gray-4);"
              >${formatDate(post.date)}</time>
              ${post.tags.filter(t => t !== 'posts').length > 0 ? html`
                <div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-top:0.75rem;">
                  ${post.tags.filter(t => t !== 'posts').map(tag => html`
                    <litro-link href="/blog/tags/${tag}" style="
                      display:inline-block;
                      padding:0.15em 0.55em;
                      font-size:var(--sl-text-xs);
                      border-radius:9999px;
                      background:var(--sl-color-accent-low);
                      color:var(--sl-color-accent-high,#5b21b6);
                      text-decoration:none;
                      font-weight:600;
                    ">#${tag}</litro-link>
                  `)}
                </div>
              ` : ''}
            </header>
            <!-- unsafeHTML renders the Markdown-generated HTML directly.
                 The content directory is trusted-author-only; do not place
                 user-submitted or untrusted content here without sanitizing. -->
            ${unsafeHTML(body)}
          </article>
          <footer style="margin-top:3rem;padding-top:1.5rem;border-top:1px solid var(--sl-color-border);">
            <litro-link href="/blog" style="font-size:var(--sl-text-sm);color:var(--sl-color-accent);text-decoration:none;">
              &larr; Back to Blog
            </litro-link>
          </footer>
        </main>
        ${preview ? html`<preview-banner></preview-banner>` : ''}
      </div>
    `;
  }
}

export default BlogPostPage;
