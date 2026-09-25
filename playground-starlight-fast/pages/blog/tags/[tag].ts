import { html, css, repeat, when } from '@microsoft/fast-element';
import { LitroPage } from '@beatzball/litro/adapter/fast/page';
import { definePageData } from '@beatzball/litro';
import type { Post } from 'litro:content';
import { getPosts } from 'litro:content';
import { siteConfig } from '../../../server/starlight.config.js';
import { starlightHead } from '../../../src/route-meta.js';
import { formatDate, isoDate } from '../../../src/date-utils.js';

// Register components — namespace imports prevent Rollup tree-shaking.
import * as _starlightHeader from '../../../src/components/starlight-header.js';
globalThis.__litro_ce__ = { ...(globalThis as any).__litro_ce__, _starlightHeader };

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
  title: 'Tags — playground-starlight-fast',
};

export class TagPage extends LitroPage {}

const template = html<TagPage>`
  ${(x) => {
    const data = x.serverData as TagPageData | null;
    const { tag = '', posts = [], siteTitle = 'playground-starlight-fast', nav = [] } = data ?? {};

    return html<TagPage>`
      <div style="min-height:100vh;display:flex;flex-direction:column;">
        <starlight-header
          :siteTitle="${() => siteTitle}"
          :nav="${() => nav}"
          :currentPath="${() => '/blog/tags/' + tag}"
        ></starlight-header>
        <main style="
          flex:1;
          max-width:56rem;
          margin:0 auto;
          padding:var(--sl-content-pad-y,2rem) var(--sl-content-pad-x,1.5rem);
          width:100%;
        ">
          <h1 style="font-size:var(--sl-text-4xl);font-weight:700;margin:0 0 2rem;">
            Posts tagged: <span style="color:var(--sl-color-accent);">#${() => tag}</span>
          </h1>

          ${when(() => posts.length === 0, html`
            <p style="color:var(--sl-color-gray-4);">No posts found for this tag.</p>
          `)}
          ${when(() => posts.length > 0, html<TagPage>`
            <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:1.5rem;">
              ${repeat(() => posts, html<Post>`
                <li style="border-bottom:1px solid var(--sl-color-border);padding-bottom:1.5rem;">
                  <a href="${x => '/blog/' + x.url.slice('/content/blog/'.length)}" style="
                    display:block;
                    font-size:var(--sl-text-xl);
                    font-weight:600;
                    color:var(--sl-color-text);
                    text-decoration:none;
                    margin-bottom:0.3rem;
                  ">${x => x.title}</a>
                  <time
                    datetime="${x => isoDate(x.date)}"
                    style="font-size:var(--sl-text-sm);color:var(--sl-color-gray-4);"
                  >${x => formatDate(x.date)}</time>
                  ${when(x => !!x.description, html<Post>`
                    <p style="margin:0.4rem 0 0;color:var(--sl-color-gray-5);">${x => x.description}</p>
                  `)}
                </li>
              `)}
            </ul>
          `)}

          <p style="margin-top:2rem;">
            <a href="/blog" style="font-size:var(--sl-text-sm);color:var(--sl-color-accent);text-decoration:none;">
              &larr; All Posts
            </a>
          </p>
        </main>
      </div>
    `;
  }}
`;

const styles = css``;

TagPage.define({ name: 'page-blog-tags-tag', template, styles });

export default TagPage;
