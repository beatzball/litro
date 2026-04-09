import { html, unsafeHTML } from '@elenajs/core';
import { LitroPage } from '@beatzball/litro/adapter/elena/page';
import { definePageData } from '@beatzball/litro';
import { createError } from 'h3';
import type { Post } from 'litro:content';
import { getPosts } from 'litro:content';
import { siteConfig } from '../../server/starlight.config.js';
import { extractHeadings, addHeadingIds } from '../../src/extract-headings.js';
import { starlightHead } from '../../src/route-meta.js';
import { formatDate, isoDate } from '../../src/date-utils.js';

export interface BlogPostData {
  post: Post;
  body: string;
  toc: Array<{ depth: number; text: string; slug: string }>;
  siteTitle: string;
  nav: typeof siteConfig.nav;
}

export const pageData = definePageData(async (event) => {
  const slug = event.context.params?.slug ?? '';

  const posts = await getPosts();
  const post = posts.find(p => p.url === `/content/blog/${slug}`);

  if (!post) {
    throw createError({ statusCode: 404, message: `Post not found: ${slug}` });
  }

  const toc = extractHeadings(post.rawBody);
  const body = addHeadingIds(post.body);

  return {
    post,
    body,
    toc,
    siteTitle: siteConfig.title,
    nav: siteConfig.nav,
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
  title: 'Blog — {{projectName}}',
};

export class BlogPostPage extends LitroPage {
  static override tagName = 'page-blog-slug';

  render() {
    const data = this.serverData as BlogPostData | null;
    if (!data?.post) return html`<p>Loading&hellip;</p>`;

    const { post, body, siteTitle, nav } = data;
    const blogSlug = post.url.slice('/content/blog/'.length);
    const visibleTags = post.tags.filter(t => t !== 'posts');

    const navLinksHtml = (nav || []).map(item => {
      const current = ('/blog/' + blogSlug).startsWith(item.href) ? 'page' : 'false';
      return `<a href="${item.href}" style="padding:0.35rem 0.75rem;font-size:var(--sl-text-sm);font-weight:500;color:var(--sl-color-gray-5);text-decoration:none;border-radius:var(--sl-border-radius);">${item.label}</a>`;
    }).join('');

    const tagsHtml = visibleTags.length > 0
      ? `<div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-top:0.75rem;">
          ${visibleTags.map(t => `<a href="/blog/tags/${t}" style="display:inline-block;padding:0.15em 0.55em;font-size:var(--sl-text-xs);border-radius:9999px;background:var(--sl-color-accent-low);color:var(--sl-color-accent-high,#5b21b6);text-decoration:none;font-weight:600;">#${t}</a>`).join('')}
        </div>`
      : '';

    return html`
      <div style="min-height:100vh;display:flex;flex-direction:column;">
        <header style="height:var(--sl-nav-height,3.5rem);background-color:var(--sl-color-bg-nav,#fff);border-bottom:1px solid var(--sl-color-border,#e8e8e8);display:flex;align-items:center;padding:0 var(--sl-content-pad-x,1.5rem);gap:1rem;position:sticky;top:0;z-index:100;">
          <a href="/" style="font-size:var(--sl-text-lg);font-weight:700;color:var(--sl-color-text);text-decoration:none;">${siteTitle}</a>
          <nav style="display:flex;align-items:center;gap:0.25rem;flex:1;" aria-label="Main navigation">${unsafeHTML(navLinksHtml)}</nav>
        </header>
        <main style="flex:1;max-width:52rem;margin:0 auto;padding:var(--sl-content-pad-y,2rem) var(--sl-content-pad-x,1.5rem);width:100%;">
          <article>
            <header style="margin-bottom:2rem;">
              <h1 style="font-size:var(--sl-text-4xl);font-weight:700;margin:0 0 0.75rem;line-height:1.15;">${post.title}</h1>
              <time datetime="${isoDate(post.date)}" style="font-size:var(--sl-text-sm);color:var(--sl-color-gray-4);">${formatDate(post.date)}</time>
              ${unsafeHTML(tagsHtml)}
            </header>
            <div>${unsafeHTML(body)}</div>
          </article>
          <footer style="margin-top:3rem;padding-top:1.5rem;border-top:1px solid var(--sl-color-border);">
            <a href="/blog" style="font-size:var(--sl-text-sm);color:var(--sl-color-accent);text-decoration:none;">&larr; Back to Blog</a>
          </footer>
        </main>
      </div>
    `;
  }
}

BlogPostPage.define();

export default BlogPostPage;
