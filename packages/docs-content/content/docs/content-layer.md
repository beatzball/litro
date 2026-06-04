---
title: Content Layer
description: The litro:content virtual module provides a Markdown content API compatible with 11ty data files.
date: 2026-01-01
---

# Content Layer

The `litro:content` virtual module provides a server-side Markdown content API. It is compatible with 11ty's frontmatter conventions and reads global metadata from a single `_data/metadata.{js,json}` file.

## Directory Structure

```
content/
  blog/              ← scanned for posts (default location)
    .11tydata.json   ← optional: { "tags": ["blog"] } applied to every post in this dir
    first-post.md
  _data/
    metadata.js      ← optional: default-exported object available via getGlobalData()
```

The default content root is `<projectRoot>/content/blog`, overridable in `litro.recipe.json` via the `contentDir` field. Whatever you set, `getGlobalData()` looks for `_data/metadata.{js,json}` in the parent directory of `contentDir`.

## API

```ts
import { getPosts, getPost, getTags, getGlobalData } from 'litro:content';
import type { Post } from 'litro:content';
```

### `getPosts(options?)`

Returns all posts, optionally filtered by a single tag:

```ts
const all = await getPosts();
const blogPosts = await getPosts({ tag: 'blog' });
const recentDocs = await getPosts({ tag: 'docs', limit: 10 });
const withDrafts = await getPosts({ includeDrafts: true });  // dev-only typical
```

Options:

```ts
interface GetPostsOptions {
  tag?: string;            // filter by a single tag (exact match)
  limit?: number;          // cap the number of results
  includeDrafts?: boolean; // include posts with `draft: true` frontmatter (default false in production)
}
```

### `getPost(slug)`

Returns a single post by its **slug** (the filename without the `.md` extension; nested files use just the file's own slug, not the full path). Returns `null` if not found.

```ts
const post = await getPost('hello-world');
```

### `getTags()`

Returns the sorted list of unique tags across all posts.

### `getGlobalData()`

Reads `content/_data/metadata.js` (default export) first, then falls back to `content/_data/metadata.json`, then `{}`. Returns the parsed object as-is — there is no merging across multiple `_data/` files.

## Frontmatter

Each Markdown file can include YAML frontmatter:

```md
---
title: My Post
description: A brief summary.
date: 2026-01-01
tags:
  - blog
  - announcement
draft: false
---

# My Post

Content here...
```

## Post Shape

```ts
interface Post {
  slug: string;                              // filename without .md
  title: string;                             // from frontmatter
  date: Date;                                // parsed from frontmatter into a Date object
  description?: string;                      // optional, from frontmatter
  tags: string[];                            // from frontmatter; falls back to .11tydata.json tags if frontmatter omits the field (frontmatter replaces, not merges)
  draft: boolean;                            // from frontmatter; defaults to false
  body: string;                              // rendered HTML
  rawBody: string;                           // raw Markdown source
  url: string;                               // resolved URL path, e.g. `/blog/hello-world`
  frontmatter: Record<string, unknown>;      // full parsed frontmatter, pass-through
}
```

Note: after a JSON round-trip through the `__litro_data__` script tag, `Post.date` arrives on the client as an ISO string rather than a `Date`. Normalise with a small helper if you read it during `render()`:

```ts
function toDate(d: Date | string): Date {
  return d instanceof Date ? d : new Date(d as string);
}
```

## SSG + generateRoutes

For SSG, export `generateRoutes()` from your page file to tell the SSG plugin which dynamic routes to prerender. Since `Post.url` is already the final URL, the function is usually a one-liner:

```ts
import { getPosts } from 'litro:content';

export async function generateRoutes(): Promise<string[]> {
  const posts = await getPosts({ tag: 'docs' });
  return posts.map(p => p.url);
}
```
