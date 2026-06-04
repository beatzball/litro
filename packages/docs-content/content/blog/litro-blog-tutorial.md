---
title: Building a Blog with Litro's Content Layer
description: A step-by-step tutorial for building a Markdown blog with Litro's content layer — getPosts(), frontmatter, tag pages, static generation, and deploying to GitHub Pages.
date: 2026-03-21
tags: [tutorial, content-layer, ssg, blog]
---

# Building a Blog with Litro's Content Layer

Litro includes a content layer for Markdown — `litro:content` — that makes it straightforward to build a blog or documentation site. This tutorial walks through building one from scratch: writing posts, listing them, filtering by tag, and prerendering everything to static HTML.

## Prerequisites

You'll need a Litro project with the `11ty-blog` recipe or the `starlight` recipe, both of which include the content layer. Or start from scratch with `pnpm create @beatzball/litro` and choose `11ty-blog`.

## What is `litro:content`?

`litro:content` is a virtual module — not a filesystem API. It's available **server-side only**, in `server/api/*.ts` files and `definePageData()` fetchers. It reads Markdown files from your `content/` directory and returns parsed posts with frontmatter.

```ts
import { getPosts, getGlobalData } from 'litro:content';

// List all posts
const posts = await getPosts();

// Get global metadata. Reads `content/_data/metadata.js` (default export) first,
// then falls back to `content/_data/metadata.json`, then returns `{}`.
const meta = await getGlobalData();
```

In `vite.config.ts`, a browser stub returns empty async functions so the import doesn't break client-side builds. Content is always server-fetched and delivered to components via `definePageData()` → `this.serverData`.

## Post Frontmatter

Litro uses 11ty-compatible frontmatter. A blog post looks like this:

```markdown
---
title: My First Post
description: A short summary for SEO and the blog index.
date: 2026-03-21
tags: [tutorial, web-components]
---

# My First Post

Content goes here.
```

`getPosts()` parses all `.md` files in `content/blog/` and returns an array of `Post` objects. Each post has:

- `slug` — the filename without extension (e.g. `my-first-post`)
- `title` — from frontmatter
- `description` — from frontmatter (optional)
- `date` — from frontmatter, parsed as a `Date`
- `tags` — from frontmatter (array)
- `draft` — from frontmatter; drafts are excluded from `getPosts()` in production unless `{ includeDrafts: true }` is passed
- `body` — rendered HTML
- `rawBody` — original Markdown
- `url` — resolved URL path (e.g. `/blog/my-first-post`)
- `frontmatter` — full parsed frontmatter object (pass-through)

## Blog Index Page

`pages/blog/index.ts` lists all posts:

```ts
import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { definePageData } from '@beatzball/litro';
import { LitroPage } from '@beatzball/litro/runtime';
import { getPosts } from 'litro:content';
import type { Post } from 'litro:content';

// Post.date is a Date on the server, but after the JSON round-trip into
// __litro_data__ it becomes a string on the client. Normalise before use.
function toDate(d: Date | string): Date {
  return d instanceof Date ? d : new Date(d as string);
}

export const pageData = definePageData(async (_event) => {
  const allPosts = await getPosts();
  const posts = allPosts
    .filter(p => p.url.startsWith('/blog/'))
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  return { posts };
});

export const routeMeta = {
  title: 'Blog',
};

@customElement('page-blog-index')
export class BlogIndex extends LitroPage {
  override render() {
    const data = this.serverData as { posts: Post[] } | null;
    if (!data) return html`<p>Loading&hellip;</p>`;

    return html`
      <main>
        <h1>Blog</h1>
        <ul>
          ${data.posts.map(post => html`
            <li>
              <a href="${post.url}">${post.title}</a>
              <time datetime="${toDate(post.date).toISOString()}">${toDate(post.date).toLocaleDateString()}</time>
            </li>
          `)}
        </ul>
      </main>
    `;
  }
}

export default BlogIndex;
```

## Individual Post Page

`pages/blog/[slug].ts` renders a single post. The slug is read from the route params via `event.context.params`.

```ts
import { html } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { customElement } from 'lit/decorators.js';
import { createError } from 'h3';
import { definePageData } from '@beatzball/litro';
import { LitroPage } from '@beatzball/litro/runtime';
import { getPosts } from 'litro:content';
import type { Post } from 'litro:content';

// Post.date is a Date on the server, but after the JSON round-trip into
// __litro_data__ it becomes a string on the client. Normalise before use.
function toDate(d: Date | string): Date {
  return d instanceof Date ? d : new Date(d as string);
}

export const pageData = definePageData(async (event) => {
  const slug = event.context.params?.slug ?? '';
  const posts = await getPosts();
  const post = posts.find(p => p.slug === slug);

  if (!post) {
    throw createError({ statusCode: 404, message: `Post not found: ${slug}` });
  }

  return { post };
});

export async function generateRoutes(): Promise<string[]> {
  const posts = await getPosts();
  return posts
    .filter(p => p.url.startsWith('/blog/'))
    .map(p => p.url);
}

export const routeMeta = {
  title: 'Blog — My Site',
};

@customElement('page-blog-slug')
export class BlogPost extends LitroPage {
  override render() {
    const data = this.serverData as { post: Post } | null;
    if (!data) return html`<p>Loading&hellip;</p>`;

    const { post } = data;
    const date = toDate(post.date);

    return html`
      <main>
        <article>
          <h1>${post.title}</h1>
          <time datetime="${date.toISOString()}">${date.toLocaleDateString()}</time>
          ${unsafeHTML(post.body)}
        </article>
        <a href="/blog">&larr; Back to Blog</a>
      </main>
    `;
  }
}

export default BlogPost;
```

`generateRoutes()` is the static generation hook. During `litro build --mode static` (or `litro generate`), Litro calls this function and prerenders each returned path.

## Tag Pages

`pages/blog/tags/[tag].ts` lists posts filtered by tag:

```ts
import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { createError } from 'h3';
import { definePageData } from '@beatzball/litro';
import { LitroPage } from '@beatzball/litro/runtime';
import { getPosts } from 'litro:content';
import type { Post } from 'litro:content';

export const pageData = definePageData(async (event) => {
  const tag = event.context.params?.tag ?? '';
  const posts = await getPosts();
  const tagged = posts
    .filter(p =>
      p.url.startsWith('/blog/') &&
      p.tags.includes(tag)
    )
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  if (tagged.length === 0) {
    throw createError({ statusCode: 404, message: `Tag not found: ${tag}` });
  }

  return { tag, posts: tagged };
});

export async function generateRoutes(): Promise<string[]> {
  const posts = await getPosts();
  const tags = new Set(
    posts
      .filter(p => p.url.startsWith('/blog/'))
      .flatMap(p => p.tags)
  );
  return Array.from(tags).map(tag => `/blog/tags/${tag}`);
}

// Tag pages should not be indexed — they're thin filtered views
export const routeMeta = {
  head: '<meta name="robots" content="noindex, follow" />',
  title: 'Blog Tags',
};

@customElement('page-blog-tags-tag')
export class BlogTagPage extends LitroPage {
  override render() {
    const data = this.serverData as { tag: string; posts: Post[] } | null;
    if (!data) return html`<p>Loading&hellip;</p>`;

    return html`
      <main>
        <h1>Posts tagged: ${data.tag}</h1>
        <ul>
          ${data.posts.map(post => {
            const slug = post.slug;
            return html`
              <li>
                <a href="/blog/${slug}">${post.title}</a>
              </li>
            `;
          })}
        </ul>
        <a href="/blog">&larr; All posts</a>
      </main>
    `;
  }
}

export default BlogTagPage;
```

## Static Generation

For a blog deployed as static HTML (GitHub Pages, S3, Netlify), build in static mode:

```bash
litro build --mode static
# or, equivalently
litro generate
```

Litro runs `generateRoutes()` on each page that exports it, collects all paths, and prerenders them to `dist/static/`. The output is a directory of `.html` files ready to serve from any CDN.

For the sitemap to include your posts, make sure `sitemap.xml.ts` calls `getPosts()` and maps the slugs — the docs site template includes this.

## Deploying to GitHub Pages

Add a GitHub Actions workflow at `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      pages: write
      id-token: write
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install
      - run: pnpm exec litro generate
        env:
          LITRO_BASE_PATH: /your-repo-name
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist/static
      - uses: actions/deploy-pages@v4
```

`LITRO_BASE_PATH` prefixes the `/_litro/app.js` script URL for sub-path GitHub Pages deployments (e.g. `https://username.github.io/your-repo-name/`). Add a `.nojekyll` file to `public/` to prevent GitHub Pages from ignoring `_` directories.

## Adding an RSS Feed

Add `server/routes/blog/rss.xml.ts`:

```ts
import { defineEventHandler, setResponseHeader } from 'h3';
import { getPosts } from 'litro:content';

const SITE_URL = process.env.SITE_URL ?? 'https://example.com';
const SITE_TITLE = 'My Blog';

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'content-type', 'application/rss+xml; charset=utf-8');

  const posts = await getPosts();
  const blogPosts = posts
    .filter(p => p.url.startsWith('/blog/'))
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 20);

  const items = blogPosts.map(post => {
    const url = `${SITE_URL}${post.url}`;
    return `
    <item>
      <title><![CDATA[${post.title}]]></title>
      <link>${url}</link>
      <guid>${url}</guid>
      <pubDate>${post.date.toUTCString()}</pubDate>
    </item>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${SITE_TITLE}</title>
    <link>${SITE_URL}/blog</link>
    <description>Latest posts from ${SITE_TITLE}</description>
    ${items.join('')}
  </channel>
</rss>`;
});
```

Then add `/blog/rss.xml` to `prerender.routes` in `nitro.config.ts` — XML routes must be listed explicitly since `crawlLinks` can't discover them.

## What to Read Next

- [Content Layer guide](/docs/content-layer)
- [Static Generation guide](/docs/ssg)
- [Deploying to GitHub Pages](/docs/deployment/github-pages)
