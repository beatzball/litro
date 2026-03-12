---
title: Content Layer
description: The litro:content virtual module provides a Markdown content API compatible with 11ty data files.
date: 2026-01-01
---

# Content Layer

The `litro:content` virtual module provides a server-side Markdown content API. It is compatible with 11ty's data cascade and frontmatter conventions.

## Directory Structure

```
content/
  docs/
    .11tydata.json      ← { "tags": ["docs"] }
    getting-started.md
    api-routes.md
  blog/
    .11tydata.json      ← { "tags": ["blog"] }
    first-post.md
  _data/
    metadata.js         ← global data
```

## API

```ts
import { getPosts, getPost, getTags, getGlobalData } from 'litro:content';
```

### `getPosts(filter?)`

Returns all posts, optionally filtered by tag or other criteria:

```ts
const posts = await getPosts();
const blogPosts = await getPosts({ tags: ['blog'] });
const docPages = await getPosts({ tags: ['docs'] });
```

### `getPost(url)`

Returns a single post by its URL:

```ts
const post = await getPost('/content/docs/getting-started');
```

### `getTags()`

Returns all unique tags across all posts.

### `getGlobalData()`

Returns the merged global data from `_data/` files.

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
---

# My Post

Content here...
```

## Post Shape

```ts
interface Post {
  title: string;
  description?: string;
  date?: string;
  tags: string[];
  url: string;       // e.g. /content/docs/getting-started
  body: string;      // rendered HTML
  rawBody: string;   // raw Markdown
}
```

## SSG + generateRoutes

For SSG, export `generateRoutes()` from your page file to tell the SSG plugin which dynamic routes to prerender:

```ts
export async function generateRoutes(): Promise<string[]> {
  const posts = await getPosts({ tags: ['docs'] });
  return posts.map(p => '/docs' + p.url.slice('/content/docs'.length));
}
```
