import { html, unsafeHTML } from '@elenajs/core';
import { LitroPage } from '@beatzball/litro/adapter/elena/page';
import { definePageData } from '@beatzball/litro';
import type { Post } from 'litro:content';
import { getPosts } from 'litro:content';
import { siteConfig } from '../../server/starlight.config.js';
import { starlightHead } from '../../src/route-meta.js';
import { formatDate, isoDate } from '../../src/date-utils.js';

export interface BlogIndexData {
  posts: Post[];
  siteTitle: string;
  nav: typeof siteConfig.nav;
}

export const pageData = definePageData(async (_event) => {
  const all = await getPosts();
  const posts = all.filter(p => p.url.startsWith('/content/blog/'));
  return {
    posts,
    siteTitle: siteConfig.title,
    nav: siteConfig.nav,
  } satisfies BlogIndexData;
});

export const routeMeta = {
  head: starlightHead,
  title: 'Blog — {{projectName}}',
};

export class BlogIndexPage extends LitroPage {
  static override tagName = 'page-blog';

  render() {
    const data = this.serverData as BlogIndexData | null;
    const { posts = [], siteTitle = '{{projectName}}', nav = [] } = data ?? {};

    const navLinksHtml = nav.map(item => {
      const current = '/blog'.startsWith(item.href) ? 'page' : 'false';
      return `<a href="${item.href}" style="padding:0.35rem 0.75rem;font-size:var(--sl-text-sm);font-weight:500;color:var(--sl-color-gray-5);text-decoration:none;border-radius:var(--sl-border-radius);">${item.label}</a>`;
    }).join('');

    const postsHtml = posts.length === 0
      ? '<p style="color:var(--sl-color-gray-4);">No posts yet.</p>'
      : `<ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:2rem;">
          ${posts.map(post => {
            const href = '/blog/' + post.url.slice('/content/blog/'.length);
            const visibleTags = post.tags.filter(t => t !== 'posts');
            const tagsHtml = visibleTags.length > 0
              ? `<div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-top:0.5rem;">
                  ${visibleTags.map(t => `<a href="/blog/tags/${t}" style="display:inline-block;padding:0.15em 0.55em;font-size:var(--sl-text-xs);border-radius:9999px;background:var(--sl-color-accent-low);color:var(--sl-color-accent-high,#5b21b6);text-decoration:none;font-weight:600;">#${t}</a>`).join('')}
                </div>`
              : '';
            const descHtml = post.description
              ? `<p style="margin:0.5rem 0 0.75rem;color:var(--sl-color-gray-5);line-height:1.6;">${post.description}</p>`
              : '';
            return `<li style="border-bottom:1px solid var(--sl-color-border);padding-bottom:2rem;">
              <a href="${href}" style="display:block;font-size:var(--sl-text-2xl);font-weight:600;color:var(--sl-color-text);text-decoration:none;margin-bottom:0.4rem;">${post.title}</a>
              <time datetime="${isoDate(post.date)}" style="font-size:var(--sl-text-sm);color:var(--sl-color-gray-4);">${formatDate(post.date)}</time>
              ${descHtml}${tagsHtml}
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
          <h1 style="font-size:var(--sl-text-4xl);font-weight:700;margin:0 0 2rem;">Blog</h1>
          ${unsafeHTML(postsHtml)}
        </main>
      </div>
    `;
  }
}

BlogIndexPage.define();

export default BlogIndexPage;
