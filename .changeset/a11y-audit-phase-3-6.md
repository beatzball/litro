---
"@beatzball/litro": minor
"@beatzball/litro-router": patch
"@beatzball/create-litro": patch
---

feat(framework): skip links API — `skipLinks` array on ShellOptions, `DEFAULT_SKIP_LINKS` constant, `SkipLink` type export

feat(framework): SPA focus management — focus outlet after page swap, announce new page title via `aria-live` region

feat(litro-router): screen reader announcements after SPA navigation via persistent `aria-live="polite"` region

feat(docs-ui): WAI-ARIA Tabs Pattern for `litro-tabs` — roving tabindex, arrow keys, `aria-controls`/`aria-labelledby`

feat(docs-ui): sidebar `inert` when closed on mobile, drawer mode detection via `matchMedia`

fix(docs-ui): visible focus indicators on search inputs (`.search-input:focus-visible`)

fix(docs-ui): GitHub link `aria-label` includes "(opens in new tab)"

fix(docs-ui): touch targets meet 44px minimum (menu button, GitHub link, search pill)

fix(docs-ui): sidebar group labels use `<h3>` instead of `<p>` for heading navigation

fix(docs-ui): preview banner `role="status"` for screen reader announcement

fix(docs-ui): search modal uses `aria-labelledby` with sr-only heading instead of `aria-label`

feat(create-litro): starlight recipe uses `skipLinks` array API with `DEFAULT_SKIP_LINKS`
