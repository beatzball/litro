import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { LitroPage } from '@beatzball/litro/runtime';
import { definePageData } from '@beatzball/litro';
import type { Post } from 'litro:content';
import { getPosts } from 'litro:content';
import { siteConfig } from '../../server/starlight.config.js';
import { starlightHead } from '@beatzball/litro-docs-ui/src/route-meta.js';
import { buildSeoHead } from '@beatzball/litro-docs-ui/src/seo.js';
import { formatDate, isoDate } from '@beatzball/litro-docs-ui/src/date-utils.js';

// Register components used in render()
import '@beatzball/litro-docs-ui/src/components/starlight-header.js';

export interface BlogIndexData {
  posts: Post[];
  siteTitle: string;
  nav: typeof siteConfig.nav;
  seoHead: string;
}

export const pageData = definePageData(async (_event) => {
  const all = await getPosts();
  // Filter to only blog posts (URL prefix from contentDir='content')
  const posts = all.filter(p => p.url.startsWith('/content/blog/'));
  const seoHead = buildSeoHead({
    title: 'Blog — Litro',
    description: 'Technical articles on web components, SSR, standards-based development, and the Litro framework.',
    path: '/blog',
    type: 'website',
  });
  return {
    posts,
    siteTitle: siteConfig.title,
    nav: siteConfig.nav,
    seoHead,
  } satisfies BlogIndexData;
});

export const routeMeta = {
  head: starlightHead,
  title: 'Blog — Litro',
};

@customElement('page-blog')
export class BlogIndexPage extends LitroPage {

  override render() {
    const data = this.serverData as BlogIndexData | null;
    const { posts = [], siteTitle = 'Litro', nav = [] } = data ?? {};

    return html`
      <div style="min-height:100vh;display:flex;flex-direction:column;">
        <starlight-header
          siteTitle="${siteTitle}"
          .nav="${nav}"
          currentPath="/blog"
          .spaNav="${true}"
        ></starlight-header>
        <main style="
          flex:1;
          max-width:56rem;
          margin:0 auto;
          padding:var(--sl-content-pad-y,2rem) var(--sl-content-pad-x,1.5rem);
          width:100%;
        ">
          <h1 style="
            font-size:var(--sl-text-4xl);
            font-weight:700;
            margin:0 0 2rem;
          ">Blog</h1>

          ${posts.length === 0 ? html`
            <p style="color:var(--sl-color-gray-4);">No posts yet.</p>
          ` : html`
            <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:2rem;">
              ${posts.map(post => {
                const blogSlug = post.url.slice('/content/blog/'.length);
                return html`
                  <li style="border-bottom:1px solid var(--sl-color-border);padding-bottom:2rem;">
                    <litro-link href="/blog/${blogSlug}" style="
                      display:block;
                      font-size:var(--sl-text-2xl);
                      font-weight:600;
                      color:var(--sl-color-text);
                      text-decoration:none;
                      margin-bottom:0.4rem;
                    ">${post.title}</litro-link>
                    <time
                      datetime="${isoDate(post.date)}"
                      style="font-size:var(--sl-text-sm);color:var(--sl-color-gray-4);"
                    >${formatDate(post.date)}</time>
                    ${post.description ? html`
                      <p style="margin:0.5rem 0 0.75rem;color:var(--sl-color-gray-5);line-height:1.6;">
                        ${post.description}
                      </p>
                    ` : ''}
                    ${post.tags.filter(t => t !== 'posts').length > 0 ? html`
                      <div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-top:0.5rem;">
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
                  </li>
                `;
              })}
            </ul>
          `}
        </main>
      </div>
    `;
  }
}

export default BlogIndexPage;
