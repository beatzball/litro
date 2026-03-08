---
title: Hello, World!
date: 2026-01-15
description: Welcome to your new Litro blog — here's what you need to know to start writing.
tags:
  - posts
  - welcome
---

## Welcome to Your Litro Blog

You've just scaffolded a brand-new blog powered by Litro — a fullstack web framework that combines Lit web components with Nitro's battle-tested server engine. This post is here to help you get your bearings and understand how everything fits together.

Content lives in the `content/blog/` directory as plain Markdown files. Each file becomes a post. The frontmatter at the top of every file (the `---` fenced block) controls the post's title, date, description, and tags. The rest of the file is your post body, written in standard Markdown — headings, paragraphs, lists, links, code blocks, all of it.

## Writing Your First Post

Create a new `.md` file inside `content/blog/` and fill in the frontmatter:

```markdown
---
title: My Second Post
date: 2026-02-01
description: A short summary shown on the blog listing page.
tags:
  - posts
  - my-tag
---

Your post content goes here.
```

The `tags` field accepts a list. Every post in `content/blog/` automatically inherits the `posts` tag from `blog.11tydata.json`, so you only need to list additional tags in the post's own frontmatter. Tag pages are generated automatically at `/tags/<tag>` — no extra configuration required.

## How Content Is Served

Litro reads your Markdown files at build time (or on-demand in dev mode) using its content layer. The `getPosts()` function returns all published posts sorted newest-first, with each post's Markdown rendered to HTML in the `body` field. The `getPost(slug)` function fetches a single post by its URL slug, derived from the filename. For example, this file — `hello-world.md` — is available at `/blog/hello-world`.

Run `litro dev` to start the development server and visit `http://localhost:3030` to see your blog live. Changes to content files are picked up immediately without restarting the server.
