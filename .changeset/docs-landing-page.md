---
'@beatzball/create-litro': minor
---

Give a scaffolded docs site a page at `/docs`.

The starlight recipe shipped only `pages/docs/[slug].ts`, so `/docs` was a 404.
A reader who typed the obvious path, or trimmed a URL back one segment from
`/docs/getting-started`, landed on nothing — and a static host that will not
list a directory turns that into a 403, which reads as "forbidden" rather than
"no such page". Supernova inherited the same hole.

Every adapter variant of the recipe now ships `pages/docs/index.ts`, a landing
page that lists each sidebar group and each entry under it, with the entry's
frontmatter `description` where the content file has one. It is a real
prerendered page, not a redirect, so any static host serves it and it works
with no client JavaScript. The site navigation's Docs entry points at `/docs`,
which is also what lets the prerender crawler reach the page.
