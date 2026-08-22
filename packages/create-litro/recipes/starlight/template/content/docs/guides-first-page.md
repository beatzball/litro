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
| `sidebar.order` | `number` | No | Sort order within the sidebar group. Pages without one sort last, alphabetically |
| `sidebar.group` | `string` | No | Sidebar group this page belongs to. Defaults to `Documentation` |
| `sidebar.label` | `string` | No | Override the label shown in the sidebar (defaults to `title`) |

The `sidebar.*` fields are read by `litro docs sync`, which rewrites the
`sidebar` array in `server/starlight.config.js` from your pages. Run it after
adding or renaming a page:

```bash
litro docs sync    # regenerate the sidebar from your pages
litro docs check   # verify pages and sidebar agree; exits 1 on drift
```

`litro docs check` makes a good CI step: a page that is live but missing from
the sidebar is reachable by URL and invisible to readers, which is easy to ship
and hard to notice.

## Markdown Features

This site supports **GitHub Flavored Markdown (GFM)**, including:

- Tables (like the one above)
- Fenced code blocks with syntax highlighting
- Task lists: `- [ ] Todo`
- Strikethrough: `~~text~~`

Headings (`##`, `###`, `####`) are automatically extracted to build the table of contents shown on the right side of each docs page.

## After Adding a Page

Run `pnpm build` to regenerate the static HTML for all routes, then `pnpm preview` to verify the new page appears in the sidebar and TOC.
