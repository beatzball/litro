# PRD-6: OG Image Generation v2

**Status**: Draft (to be refined after v1 ships and learnings are captured)
**Depends on**: v1 OG image system (`@beatzball/litro/plugins/og`)

---

## 1. v1 Retrospective

> Fill in after v1 ships.

### What worked well
- [ ] Plugin registration pattern (opt-in, after ssg)
- [ ] Satori + resvg-js pipeline reliability
- [ ] Dark template with fire palette — visual quality
- [ ] SSG prerender auto-registration

### What was painful
- [ ] Build time impact: how many seconds added for ~50 OG routes?
- [ ] Any Satori CSS limitations hit (e.g., text wrapping, emoji)
- [ ] Font loading edge cases (WASM binary size for SSR deployments)
- [ ] Developer experience friction: manual `buildSeoHead` wiring in every page

### Metrics
- Prerender route count before OG: ___
- Prerender route count after OG: ___
- Build time delta: ___ seconds
- SSR response time for `/__og/*.png`: ___ ms (p50 / p95)

---

## 2. Upgrade A — Auto Meta Injection

**Concept**: The framework's `create-page-handler.ts` auto-injects `<meta property="og:image">` into the HTML shell for every page. Pages no longer need to include OG-specific fields in `buildSeoHead`.

### Pros

| Benefit | Impact |
|---------|--------|
| Zero boilerplate | Pages don't need to know OG images exist |
| Consistent | Every page gets an OG image automatically — can't forget |
| Framework-grade DX | Matches Next.js `opengraph-image.tsx` and Nuxt `defineOgImage()` expectations |
| Fewer bugs | No risk of `buildSeoHead` path getting out of sync with actual OG route |

### Cons

| Drawback | Severity |
|----------|----------|
| Less per-page control | Medium — pages can't easily opt out |
| Couples framework core to OG plugin | Medium — `shell.ts` would reference `/__og/` convention |
| noindex pages still get images | Low — wasteful but harmless |

### Implementation sketch

1. Add `ogImageBase?: string` to `ShellOptions` in `shell.ts`
2. When set, `buildShell` injects `<meta property="og:image" content="${ogImageBase}/__og/${pagePath}.png">` + width/height/twitter:image
3. The OG plugin stores the base URL on `nitro.options.__litroOgBase`
4. `create-page-handler.ts` reads it and passes to `buildShell`
5. `buildSeoHead` in docs-ui no longer emits og:image (or emits it only as a fallback)

### Open questions
- Should pages be able to opt out? (e.g., `routeMeta.ogImage: false`)
- Should the auto-injected URL include the site URL prefix, or just the path?

---

## 3. Upgrade B — `defineOgImage()` Composable

**Concept**: Pages export OG metadata as a separate declaration alongside `definePageData`:

```ts
export const ogImage = defineOgImage({
  title: 'Custom OG Title',
  description: 'Override for OG card',
  type: 'article',
  template: 'blog',
});
```

### Pros

| Benefit | Impact |
|---------|--------|
| Explicit per-page control | High — no data fetching needed for OG generation |
| Lightweight | The OG handler reads a static export, doesn't call `pageData.fetcher()` |
| Familiar pattern | Matches Nuxt's `defineOgImage()` — ecosystem developers expect this |
| Template variants | Pages can select named templates (blog, docs, compare) |

### Cons

| Drawback | Severity |
|----------|----------|
| New API surface | Low — but it's one more thing to learn |
| Duplication risk | Medium — title/description may drift from `definePageData` |
| Page manifest changes | Low — `#litro/page-manifest` already exports `pageModules` |

### Implementation sketch

1. Add `defineOgImage(options)` to `packages/framework/src/runtime/page-data.ts`
2. Returns `{ __litroOgImage: true, ...options }` (sentinel pattern, same as `definePageData`)
3. OG handler checks `pageModule.ogImage` first; falls back to `pageData.fetcher()` if absent
4. `#litro/page-manifest` virtual module already includes all named exports from page modules

### Open questions
- Should `defineOgImage` support an async fetcher? (e.g., fetching a hero image URL)
- Should it accept a full template function, or just data for named template variants?

---

## 4. Recommendation

> To be decided after v1 learnings.

**Preliminary lean**: Combine A + B.

- **Auto-injection (A)** as the zero-config default — every page gets an OG image with no effort
- **`defineOgImage()` (B)** as the explicit override — pages that need custom titles, descriptions, or template variants use this
- **Query-param fallback** (v1) preserved for non-page images

This layered approach means:
1. The 80% case (standard pages) requires zero code
2. The 15% case (custom OG data) uses a clean composable
3. The 5% case (one-off images) uses query params

---

## 5. Additional v2 Features

### Named template variants
Ship 4 built-in templates selectable by name:
- `default` — current dark card
- `blog` — includes date, author, tags
- `docs` — includes breadcrumb path
- `compare` — "Litro vs X" with dual branding

### Dev mode preview
`/__og/[path].html` renders the Satori input as visible HTML in the browser. Enables rapid design iteration without regenerating PNGs. Toggle with `?preview=true` query param.

### Edge runtime support
Replace `@resvg/resvg-js` (Node.js native) with `@resvg/resvg-wasm` for Cloudflare Workers and Vercel Edge. Requires async WASM initialization — the handler detects the runtime and loads the appropriate backend.

### Image caching layer (SSR)
For SSR deployments, add an in-memory LRU cache keyed by page path + content hash. Avoids regenerating unchanged images on every request. Cache size configurable via `OgHandlerConfig.cacheSize`.

### Recipe integration
The `starlight` recipe template ships with OG plugin pre-configured:
- `nitro.config.ts` includes `ogPlugin` in `build:before`
- `server/routes/__og/[...path].png.ts` pre-created
- `buildSeoHead` already wired (via docs-ui)

Other recipes (`fullstack`, `11ty-blog`) get a commented-out example they can uncomment.

---

## 6. Timeline

| Phase | Scope | Depends on |
|-------|-------|------------|
| v1 (current) | Plugin + handler + SSG prerender + docs integration | — |
| v2a | Auto meta injection | v1 shipped + learnings |
| v2b | `defineOgImage()` composable | v1 shipped + learnings |
| v2c | Named template variants | v2b |
| v2d | Dev preview mode | v1 |
| v2e | Edge runtime + caching | v1 + deployment testing |
| v2f | Recipe integration | v2a or v2b |
