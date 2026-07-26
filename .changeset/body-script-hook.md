---
"@beatzball/litro": minor
---

Add a per-page `bodyScript` hook: pages can return an optional `bodyScript` string (raw HTML, typically a synchronous `<script>`) from `definePageData()`, and the shell emits it at end-of-body immediately before the app-bundle script. This gives pages a synchronous, pre-hydration slot — symmetric with `seoHead` for `<head>` — for filling server-unknowable values (e.g. times in the user's local timezone) on first paint. Like `seoHead`/`seoTitle`, the field is stripped from the serialized `__litro_data__` client JSON. Pages that don't use it are byte-for-byte unchanged.
