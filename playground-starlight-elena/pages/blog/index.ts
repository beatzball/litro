import { html, unsafeHTML } from '@elenajs/core';
import { LitroPage } from '@beatzball/litro/adapter/elena/page';
import { definePageData } from '@beatzball/litro';
import type { Post } from 'litro:content';
import { getPosts } from 'litro:content';
import { siteConfig } from '../../server/starlight.config.js';
import { starlightHead } from '../../src/route-meta.js';
import { formatDate, isoDate } from '../../src/date-utils.js';
// Re-exporting child components prevents Rollup tree-shaking.
export { StarlightPage } from '../../src/components/starlight-page.js';

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
      <starlight-page sitetitle="${siteTitle}" pagetitle="Blog" nav="${JSON.stringify(nav)}" currentpath="/blog" nosidebar="true">
        ${unsafeHTML(postsHtml)}
      </starlight-page>
    `;
  }
}

BlogIndexPage.define();

export default BlogIndexPage;
