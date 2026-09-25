import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { LitroPage } from '@beatzball/litro/runtime';
import { definePageData } from '@beatzball/litro';
import type { Post } from 'litro:content';
import { getPosts } from 'litro:content';
import { siteConfig } from '../../../server/starlight.config.js';
import { starlightHead } from '../../../src/route-meta.js';
import { formatDate, isoDate } from '../../../src/date-utils.js';

// Register components used in render()
import '../../../src/components/starlight-header.js';

export interface TagPageData {
  tag: string;
  posts: Post[];
  siteTitle: string;
  nav: typeof siteConfig.nav;
}

export const pageData = definePageData(async (event) => {
  const tag = event.context.params?.tag ?? '';
  const all = await getPosts({ tag });
  // Filter to only blog posts (docs might have unexpected tags)
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
  title: 'Tags — playground-starlight',
};

@customElement('page-blog-tags-tag')
export class TagPage extends LitroPage {
  override render() {
    const data = this.serverData as TagPageData | null;
    const { tag = '', posts = [], siteTitle = 'playground-starlight', nav = [] } = data ?? {};

    return html`
      <div style="min-height:100vh;display:flex;flex-direction:column;">
        <starlight-header
          siteTitle="${siteTitle}"
          .nav="${nav}"
          currentPath="/blog/tags/${tag}"
        ></starlight-header>
        <main style="
          flex:1;
          max-width:56rem;
          margin:0 auto;
          padding:var(--sl-content-pad-y,2rem) var(--sl-content-pad-x,1.5rem);
          width:100%;
        ">
          <h1 style="font-size:var(--sl-text-4xl);font-weight:700;margin:0 0 2rem;">
            Posts tagged: <span style="color:var(--sl-color-accent);">#${tag}</span>
          </h1>

          ${posts.length === 0 ? html`
            <p style="color:var(--sl-color-gray-4);">No posts found for this tag.</p>
          ` : html`
            <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:1.5rem;">
              ${posts.map(post => {
                const blogSlug = post.url.slice('/content/blog/'.length);
                return html`
                  <li style="border-bottom:1px solid var(--sl-color-border);padding-bottom:1.5rem;">
                    <a href="/blog/${blogSlug}" style="
                      display:block;
                      font-size:var(--sl-text-xl);
                      font-weight:600;
                      color:var(--sl-color-text);
                      text-decoration:none;
                      margin-bottom:0.3rem;
                    ">${post.title}</a>
                    <time
                      datetime="${isoDate(post.date)}"
                      style="font-size:var(--sl-text-sm);color:var(--sl-color-gray-4);"
                    >${formatDate(post.date)}</time>
                    ${post.description ? html`
                      <p style="margin:0.4rem 0 0;color:var(--sl-color-gray-5);">${post.description}</p>
                    ` : ''}
                  </li>
                `;
              })}
            </ul>
          `}

          <p style="margin-top:2rem;">
            <a href="/blog" style="font-size:var(--sl-text-sm);color:var(--sl-color-accent);text-decoration:none;">
              ← All Posts
            </a>
          </p>
        </main>
      </div>
    `;
  }
}

export default TagPage;
