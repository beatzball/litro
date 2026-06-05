---
"@beatzball/litro": patch
---

Docs accuracy: correct the published Elena 0.8.0 CHANGELOG entry to reflect that the adapter uses direct light DOM SSR (no `@elenajs/ssr` dependency); fix the JSDoc on `LitroConfig` and the comment in `plugins/pages.ts` that misdescribed adapter selection (the only working path is `process.env.LITRO_ADAPTER`, not a `runtimeConfig.litro.adapter` block).
