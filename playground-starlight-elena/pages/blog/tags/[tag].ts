import { html, unsafeHTML } from '@elenajs/core';
import { LitroPage } from '@beatzball/litro/adapter/elena/page';
import { definePageData } from '@beatzball/litro';
import type { Post } from 'litro:content';
import { getPosts } from 'litro:content';
import { siteConfig } from '../../../server/starlight.config.js';
import { starlightHead } from '../../../src/route-meta.js';
import { formatDate, isoDate } from '../../../src/date-utils.js';

export interface TagPageData {
  tag: string;
  posts: Post[];
  siteTitle: string;
  nav: typeof siteConfig.nav;
}

export const pageData = definePageData(async (event) => {
  const tag = event.context.params?.tag ?? '';
  const all = await getPosts({ tag });
  const posts = all.filter(p => p.url.startsWith('/content/blog/'));
  return {
    tag,
    posts,
    siteTitle: siteConfig.title,
    nav: siteConfig.nav,
  } satisfies TagPageData;
});

export async function generateRoutes(): Promise<string[]> {
  const all = await getPosts();
  const blogPosts = all.filter(p => p.url.startsWith('/content/blog/'));
  const tags = [...new Set(blogPosts.flatMap(p => p.tags))].sort();
  return tags.map(tag => `/blog/tags/${tag}`);
}

export const routeMeta = {
  head: starlightHead,
  title: 'Tags — {{projectName}}',
};

export class TagPage extends LitroPage {
  static override tagName = 'page-blog-tags-tag';

  render() {
    const data = this.serverData as TagPageData | null;
    const { tag = '', posts = [], siteTitle = '{{projectName}}', nav = [] } = data ?? {};

    const navLinksHtml = nav.map(item =>
      `<a href="${item.href}" style="padding:0.35rem 0.75rem;font-size:var(--sl-text-sm);font-weight:500;color:var(--sl-color-gray-5);text-decoration:none;border-radius:var(--sl-border-radius);">${item.label}</a>`
    ).join('');

    const postsHtml = posts.length === 0
      ? '<p style="color:var(--sl-color-gray-4);">No posts found for this tag.</p>'
      : `<ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:1.5rem;">
          ${posts.map(post => {
            const href = '/blog/' + post.url.slice('/content/blog/'.length);
            const descHtml = post.description
              ? `<p style="margin:0.4rem 0 0;color:var(--sl-color-gray-5);">${post.description}</p>`
              : '';
            return `<li style="border-bottom:1px solid var(--sl-color-border);padding-bottom:1.5rem;">
              <a href="${href}" style="display:block;font-size:var(--sl-text-xl);font-weight:600;color:var(--sl-color-text);text-decoration:none;margin-bottom:0.3rem;">${post.title}</a>
              <time datetime="${isoDate(post.date)}" style="font-size:var(--sl-text-sm);color:var(--sl-color-gray-4);">${formatDate(post.date)}</time>
              ${descHtml}
            </li>`;
          }).join('')}
        </ul>`;

    return html`
      <div style="min-height:100vh;display:flex;flex-direction:column;">
        <header style="height:var(--sl-nav-height,3.5rem);background-color:var(--sl-color-bg-nav,#fff);border-bottom:1px solid var(--sl-color-border,#e8e8e8);display:flex;align-items:center;padding:0 var(--sl-content-pad-x,1.5rem);gap:1rem;position:sticky;top:0;z-index:100;">
          <a href="/" style="font-size:var(--sl-text-lg);font-weight:700;color:var(--sl-color-text);text-decoration:none;">${siteTitle}</a>
          <nav style="display:flex;align-items:center;gap:0.25rem;flex:1;" aria-label="Main navigation">${unsafeHTML(navLinksHtml)}</nav>
        </header>
        <main style="flex:1;max-width:56rem;margin:0 auto;padding:var(--sl-content-pad-y,2rem) var(--sl-content-pad-x,1.5rem);width:100%;">
          <h1 style="font-size:var(--sl-text-4xl);font-weight:700;margin:0 0 2rem;">
            Posts tagged: <span style="color:var(--sl-color-accent);">#${tag}</span>
          </h1>
          ${unsafeHTML(postsHtml)}
          <p style="margin-top:2rem;">
            <a href="/blog" style="font-size:var(--sl-text-sm);color:var(--sl-color-accent);text-decoration:none;">&larr; All Posts</a>
          </p>
        </main>
      </div>
    `;
  }
}

TagPage.define();

export default TagPage;
