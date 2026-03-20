---
"@beatzball/litro": patch
---

fix: strip seoHead/seoTitle from __litro_data__ JSON; add .xml MIME type to litro preview

Pages returning `seoHead` from `definePageData()` commonly include a JSON-LD `<script>` block. The closing `</script>` inside the JSON string caused the browser HTML parser to terminate the outer `<script type="application/json">` element early, leaking the remainder of the JSON as visible text and causing `getServerData()` to return null. Fixed by destructuring `seoHead` and `seoTitle` out of the page data before `JSON.stringify` — these fields are only needed server-side to build the `<head>`.

Also adds `.xml` to the MIME type map in `litro preview`'s static file server, preventing browsers from prompting a download for `.xml` routes (e.g. RSS feeds, sitemaps) when previewing an SSG build locally.
