---
title: Your First Page
description: Create a new docs page and add it to the sidebar navigation.
sidebar:
  order: 4
---

## Create a Markdown File

Add a new `.md` file to `content/docs/`. The filename (without extension) becomes the URL slug.

For example, create `content/docs/my-topic.md`:

```markdown
---
title: My Topic
description: A brief description for SEO and the sidebar.
---

## Introduction

Write your documentation here using standard Markdown.
```

## Add It to the Sidebar

Open `server/starlight.config.js` and add an entry to the appropriate sidebar group:

```js
sidebar: [
  {
    label: 'My Section',
    items: [
      { label: 'My Topic', slug: 'my-topic' },
    ],
  },
],
```

The `slug` must match the filename (without `.md`). The page will be available at `/docs/my-topic`.

## Frontmatter Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `title` | `string` | Yes | Page title (shown in sidebar and `<title>`) |
| `description` | `string` | No | Short summary for SEO |
| `sidebar.order` | `number` | No | Controls sort order within the sidebar group |
| `sidebar.label` | `string` | No | Override the label shown in the sidebar |

## Markdown Features

This site supports **GitHub Flavored Markdown (GFM)**, including:

- Tables (like the one above)
- Fenced code blocks with syntax highlighting
- Task lists: `- [ ] Todo`
- Strikethrough: `~~text~~`

Headings (`##`, `###`, `####`) are automatically extracted to build the table of contents shown on the right side of each docs page.

## After Adding a Page

Run `pnpm build` to regenerate the static HTML for all routes, then `pnpm preview` to verify the new page appears in the sidebar and TOC.
