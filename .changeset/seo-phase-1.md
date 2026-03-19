---
"@beatzball/litro": minor
"@beatzball/litro-router": patch
"@beatzball/create-litro": patch
---

feat(seo): inject seoHead and seoTitle from pageData into HTML shell

Pages can now return `seoHead` (a string of meta/JSON-LD tags) and `seoTitle` from `definePageData()`. The framework extracts these at request time and injects them into the actual `<head>` element of the HTML response — not buried in the `__litro_data__` JSON blob.

Also improves npm discoverability: updated descriptions and keywords for all three packages, and rewrote the framework README with a Hello World example, comparison table, and SEO section.
