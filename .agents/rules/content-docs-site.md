# Content and docs site rules

The docs sites render Markdown inside shadow DOM, serialize content through
JSON, and exist in an SSG and an SSR version.

### CONTENT-001 — Content slugs are unique across the whole content directory

A content file's slug is its bare filename (the parent folder name for
`index.md`). Keep basenames unique across every collection in one content
directory, blog and docs together.

**Why:** posts are keyed by slug. Before the check existed, one of two colliding
files silently vanished from every listing while the site built clean.

**Check:** `build()` in `packages/framework/src/content/index.ts` now throws and
names both files.

### CONTENT-002 — Format content dates with `toLocalDate()`

Any code that displays `Post.date` passes it through `toLocalDate()` before
`toLocaleDateString()` or local-time accessors.

**Why:** YAML dates arrive as `Date` objects at UTC midnight, and after the JSON
round-trip into `__litro_data__` they are ISO strings. Both show the previous
day in timezones behind UTC. The server HTML and the hydrated client can
disagree.

**Check:** `packages/docs-ui/src/date-utils.ts`. Test with a browser timezone
behind UTC.

### CONTENT-003 — Raw HTML in Markdown needs `rehype-raw` and a language class

Keep `rehypeRaw` in the content pipeline. A `<pre><code>` block written as raw
HTML carries `class="language-<lang>"`.

**Why:** a CommonMark HTML block ends at the first blank line, so remark splits
multi-line raw HTML into broken pieces. `rehype-raw` parses it back into a tree.
`applyHighlighting()` only matches `<code class="language-*">`, so a block
without the class gets a dark background and no token colors.

**Check:** `packages/framework/src/content/parser.ts` and the regex in
`packages/docs-ui/src/highlight.ts`.

### CONTENT-004 — A page that renders Markdown brings its own highlight styles

A page component that renders Markdown with `unsafeHTML` calls
`applyHighlighting()` on the body in its page data, and includes the highlight
token rules in its `static override styles`.

**Why:** Lit SSR renders into shadow DOM. Global stylesheets cannot reach inside
it, so code blocks stay uncoloured.

**Check:** `docs/pages/blog/[slug].ts` and `docs-ssr/pages/blog/[slug].ts` are
the reference.

### CONTENT-005 — A recipe's global stylesheet hides undefined elements

Every global stylesheet a recipe links from its HTML shell starts with:

```css
:not(:defined) {
  visibility: hidden;
}
```

**Why:** before client JavaScript defines the elements, the browser shows
un-upgraded content, which flashes and shifts. `visibility` avoids the reflow
that `display: none` causes.

**Check:** `git grep -n ":not(:defined)" -- '*.css'`. It is in
`packages/create-litro/recipes/starlight/template/public/styles/starlight.css`,
the starlight playgrounds and `docs/public/styles/starlight.css`. A new recipe
with a global stylesheet needs it too.

### CONTENT-006 — The docs' `sl-*` components do not render on the server

In `packages/docs-ui`, navigation links and calls to action are plain `<a>`
elements. `sl-*` elements that only add behavior are hidden with
`@media (scripting: none)`.

**Why:** the `sl-*` component library needs browser APIs and is never registered
on the server. SSR prints a bare tag. Without JavaScript an `sl-button[href]`
has no anchor inside it, so the link does nothing.

**Check:** the `@media (scripting: none)` blocks in
`packages/docs-ui/src/components/starlight-header.ts` and
`packages/docs-ui/src/components/starlight-page.ts`. Test new controls with
JavaScript off.

### CONTENT-007 — Some `docs/` and `docs-ssr/` differences are intentional

The two sites render the same content and should differ only in render mode.
These differences are on purpose, so do not "sync" them away:

1. `.spaNav="${true}"` on `<starlight-header>` in `docs-ssr/` only.
2. `<litro-link>` instead of plain `<a>` in `docs-ssr/` only.
3. `previewPosts(event)` / `isPreview(event)` and `<preview-banner>` in
   `docs-ssr/` only, instead of plain `getPosts()`.
4. `docs-ssr/pages/search.ts`, which has no `docs/` counterpart.

**Why:** these are SSR-only features: client navigation, draft preview and a
search backend. The static site has none of them.

**Check:** diff the two `pages/` trees. Anything outside this list is drift.

### CONTENT-008 — A docs page that imports server-only code needs a browser stub

When a docs page imports a utility that uses `node:fs` or the Markdown
toolchain, the site's `vite.config.ts` resolves that import to a stub for the
browser build.

**Why:** `definePageData` and `generateRoutes` run only on the server, but Vite
still follows every top-level import in the page file and fails to bundle
Node-only code.

**Check:** the `litro:packages-stub` plugin in `docs/vite.config.ts` and
`docs-ssr/vite.config.ts`.
