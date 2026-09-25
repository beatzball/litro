import { html, css, repeat, when } from '@microsoft/fast-element';
import { LitroPage } from '@beatzball/litro/adapter/fast/page';
import { definePageData } from '@beatzball/litro';
import { createError } from 'h3';
import type { Post } from 'litro:content';
import { getPosts } from 'litro:content';
import { siteConfig } from '../../server/starlight.config.js';
import { extractHeadings, addHeadingIds } from '../../src/extract-headings.js';
import { starlightHead } from '../../src/route-meta.js';
import { formatDate, isoDate } from '../../src/date-utils.js';

// Register components — namespace imports prevent Rollup tree-shaking.
import * as _starlightHeader from '../../src/components/starlight-header.js';
globalThis.__litro_ce__ = { ...(globalThis as any).__litro_ce__, _starlightHeader };

export interface BlogPostData {
  post: Post;
  body: string;
  toc: Array<{ depth: number; text: string; slug: string }>;
  siteTitle: string;
  nav: typeof siteConfig.nav;
}

export const pageData = definePageData(async (event) => {
  const slug = event.context.params?.slug ?? '';

  // Content URLs are /content/blog/<slug> (contentDir = 'content')
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

export class BlogPostPage extends LitroPage {}

const template = html<BlogPostPage>`
  ${(x) => {
    const data = x.serverData as BlogPostData | null;
    if (!data?.post) return html`<p>Loading&hellip;</p>`;

    const { post, body, siteTitle, nav } = data;
    const blogSlug = post.url.slice('/content/blog/'.length);
    const visibleTags = post.tags.filter(t => t !== 'posts');

    return html<BlogPostPage>`
      <div style="min-height:100vh;display:flex;flex-direction:column;">
        <starlight-header
          :siteTitle="${() => siteTitle}"
          :nav="${() => nav}"
          :currentPath="${() => '/blog/' + blogSlug}"
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
                ${() => post.title}
              </h1>
              <time
                datetime="${() => isoDate(post.date)}"
                style="font-size:var(--sl-text-sm);color:var(--sl-color-gray-4);"
              >${() => formatDate(post.date)}</time>
              ${when(() => visibleTags.length > 0, html<BlogPostPage>`
                <div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-top:0.75rem;">
                  ${repeat(() => visibleTags, html<string>`
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
            </header>
            <!-- :innerHTML renders the Markdown-generated HTML directly.
                 The content directory is trusted-author-only; do not place
                 user-submitted or untrusted content here without sanitizing. -->
            <div :innerHTML="${() => body}"></div>
          </article>
          <footer style="margin-top:3rem;padding-top:1.5rem;border-top:1px solid var(--sl-color-border);">
            <a href="/blog" style="font-size:var(--sl-text-sm);color:var(--sl-color-accent);text-decoration:none;">
              &larr; Back to Blog
            </a>
          </footer>
        </main>
      </div>
    `;
  }}
`;

const styles = css``;

BlogPostPage.define({ name: 'page-blog-slug', template, styles });

export default BlogPostPage;
