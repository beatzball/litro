import { html, css, repeat, when } from '@microsoft/fast-element';
import { LitroPage } from '@beatzball/litro/adapter/fast/page';
import { definePageData } from '@beatzball/litro';
import type { Post } from 'litro:content';
import { getPosts } from 'litro:content';
import { siteConfig } from '../../server/starlight.config.js';
import { starlightHead } from '../../src/route-meta.js';
import { formatDate, isoDate } from '../../src/date-utils.js';

// Register components — namespace imports prevent Rollup tree-shaking.
import * as _starlightHeader from '../../src/components/starlight-header.js';
globalThis.__litro_ce__ = { ...(globalThis as any).__litro_ce__, _starlightHeader };

export interface BlogIndexData {
  posts: Post[];
  siteTitle: string;
  nav: typeof siteConfig.nav;
}

export const pageData = definePageData(async (_event) => {
  const all = await getPosts();
  // Filter to only blog posts (URL prefix from contentDir='content')
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

export class BlogIndexPage extends LitroPage {}

const template = html<BlogIndexPage>`
  ${(x) => {
    const data = x.serverData as BlogIndexData | null;
    const { posts = [], siteTitle = '{{projectName}}', nav = [] } = data ?? {};

    return html<BlogIndexPage>`
      <div style="min-height:100vh;display:flex;flex-direction:column;">
        <starlight-header
          :siteTitle="${() => siteTitle}"
          :nav="${() => nav}"
          :currentPath="${() => '/blog'}"
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

          ${when(() => posts.length === 0, html`
            <p style="color:var(--sl-color-gray-4);">No posts yet.</p>
          `)}
          ${when(() => posts.length > 0, html<BlogIndexPage>`
            <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:2rem;">
              ${repeat(() => posts, html<Post>`
                <li style="border-bottom:1px solid var(--sl-color-border);padding-bottom:2rem;">
                  <a href="${x => '/blog/' + x.url.slice('/content/blog/'.length)}" style="
                    display:block;
                    font-size:var(--sl-text-2xl);
                    font-weight:600;
                    color:var(--sl-color-text);
                    text-decoration:none;
                    margin-bottom:0.4rem;
                  ">${x => x.title}</a>
                  <time
                    datetime="${x => isoDate(x.date)}"
                    style="font-size:var(--sl-text-sm);color:var(--sl-color-gray-4);"
                  >${x => formatDate(x.date)}</time>
                  ${when(x => !!x.description, html<Post>`
                    <p style="margin:0.5rem 0 0.75rem;color:var(--sl-color-gray-5);line-height:1.6;">
                      ${x => x.description}
                    </p>
                  `)}
                  ${when(x => x.tags.filter(t => t !== 'posts').length > 0, html<Post>`
                    <div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-top:0.5rem;">
                      ${repeat(x => x.tags.filter(t => t !== 'posts'), html<string>`
                        <a href="${x => '/blog/tags/' + x}" style="
                          display:inline-block;
                          padding:0.15em 0.55em;
                          font-size:var(--sl-text-xs);
                          border-radius:9999px;
                          background:var(--sl-color-accent-low);
                          color:var(--sl-color-accent-high,#5b21b6);
                          text-decoration:none;
                          font-weight:600;
                        ">#${x => x}</a>
                      `)}
                    </div>
                  `)}
                </li>
              `)}
            </ul>
          `)}
        </main>
      </div>
    `;
  }}
`;

const styles = css``;

BlogIndexPage.define({ name: 'page-blog', template, styles });

export default BlogIndexPage;
