import { html, unsafeHTML } from '@elenajs/core';
import { LitroPage } from '@beatzball/litro/adapter/elena/page';
import { definePageData } from '@beatzball/litro';
import type { Post } from 'litro:content';
import { getPosts } from 'litro:content';
import { siteConfig } from '../../../server/starlight.config.js';
import { starlightHead } from '../../../src/route-meta.js';
import { formatDate, isoDate } from '../../../src/date-utils.js';
// Re-exporting child components prevents Rollup tree-shaking.
export { StarlightPage } from '../../../src/components/starlight-page.js';

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
      <starlight-page sitetitle="${siteTitle}" nav="${JSON.stringify(nav)}" currentpath="/blog/tags/${tag}" nosidebar="true">
        <h1 style="font-size:var(--sl-text-4xl);font-weight:700;margin:0 0 2rem;">
          Posts tagged: <span style="color:var(--sl-color-accent);">#${tag}</span>
        </h1>
        ${unsafeHTML(postsHtml)}
        <p style="margin-top:2rem;">
          <a href="/blog" style="font-size:var(--sl-text-sm);color:var(--sl-color-accent);text-decoration:none;">&larr; All Posts</a>
        </p>
      </starlight-page>
    `;
  }
}

TagPage.define();

export default TagPage;
