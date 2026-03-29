---
title: 11ty Blog Recipe
description: The 11ty-blog recipe creates a Markdown blog with the litro:content layer.
date: 2026-01-01
---

# 11ty Blog Recipe

The `11ty-blog` recipe creates an SSG blog powered by the `litro:content` Markdown layer.

## Scaffold

```bash
pnpm create @beatzball/litro my-blog
# choose: 11ty-blog
```

## Structure

```
my-blog/
  content/
    blog/
      .11tydata.json
      first-post.md
  pages/
    index.ts          ← blog listing
    blog/
      [slug].ts       ← blog post
      tags/
        [tag].ts      ← tag listing
  public/
  app.ts
  nitro.config.ts     ← uses ssgPreset()
  vite.config.ts
```

## Writing Posts

Create Markdown files in `content/blog/` with frontmatter:

```md
---
title: My First Post
description: Getting started with the 11ty-blog recipe.
date: 2026-01-15
tags:
  - blog
  - announcement
---

# My First Post

Content here...
```

## Build

```bash
litro build
```

Output goes to `dist/static/`. Deploy to any static hosting (GitHub Pages, Netlify, Cloudflare Pages, etc.).
