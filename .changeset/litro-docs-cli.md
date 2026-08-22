---
'@beatzball/litro': minor
---

Add `litro docs sync` and `litro docs check` for starlight docs sites.

A starlight site has two sources of truth that can silently disagree: the
Markdown files in the content directory, and the hand-written `sidebar` array
in `server/starlight.config.js`. Add a page and forget the config and the page
is live but unreachable — no link, no prev/next, and nothing says so.

- **`litro docs sync`** rewrites the sidebar from your pages' frontmatter,
  using `sidebar.order`, `sidebar.group` and `sidebar.label`.
- **`litro docs check`** changes nothing and exits 1 on drift: a page with no
  `title` or `description`, a body that opens with its own `# ` heading
  (duplicating the frontmatter title), colliding slugs, a page missing from the
  sidebar, or a sidebar link pointing at no page. Suitable as a CI step.

This also makes the recipe's own documentation true. It has always claimed
`sidebar.order` "controls sort order within the sidebar group" and that
`sidebar.label` overrides the sidebar text — neither field was read by
anything. Both work now, and `sidebar.group` joins them.

`sync` refuses to run when the sidebar has several groups but no page declares
one, since that would silently collapse a hand-built navigation into a single
group. It prints the group each page currently belongs to so the structure can
be restored by copy-paste, and takes `--force` for a deliberate flatten.
