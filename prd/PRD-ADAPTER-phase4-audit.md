# PRD-ADAPTER Phase 4 — Verification & Audit

**Scope:** Five identical HN clones (Litro × 3 adapters + Next.js + Nuxt) + mock API + benchmark integration + docs.
**Branch:** `worktree-feat-hacker-news-comparison-benchmarks`
**Audit date:** 2026-04-19
**Last updated:** 2026-04-20
**Status:** All blockers resolved. Ready for merge.

## How This Audit Was Produced

Six parallel verification agents (3 groups × 2 agents) independently audited the same scope using the same checklist. A seventh synthesizer agent collated findings, resolved disagreements via direct grep evidence, and produced a prioritized action queue. This document tracks the status of each finding.

---

## Resolved in this branch

### B1 (blocker) — Elena list pages rendered HTML-escaped markup

Elena's `html` tag escapes interpolated strings by default. The three top-level pages (`index`, `ask`, `show`) interpolated `.map(...).join('')` of raw-HTML strings without `unsafeHTML()`, so the built output contained `&lt;li class="story-item"` instead of rendered markup.

- **Files fixed:** `benchmarks/apps/hn-litro-elena/pages/{index,ask,show}.ts`
- **Fix:** imported `unsafeHTML` from `@elenajs/core` and wrapped the `.join('')` result.
- **Verified:** `&lt;li` removed, `<li class="story-item"` present in `dist/static/{index,ask,show}/index.html`.
- **Impact:** Elena's page-weight / output-size numbers were measuring escaped text. Benchmarks re-run after fix.

### B2 (blocker) — `docs/pages/benchmarks.ts` crashed SSG build when `latest.json` missing

`pageData` loader called `readFile`/`JSON.parse` with no try/catch, so a clean clone + `pnpm --filter @beatzball/litro-docs build` would throw before the render-time `hasCross`/`hasHn` guards ran.

- **Files fixed:** `docs/pages/benchmarks.ts`
- **Fix:** added `EMPTY_STATS` / `EMPTY_BUNDLE` / `EMPTY_RESULTS` fallback constants, wrapped read+parse in try/catch, guarded meta line with `${r.meta.timestamp ? ...}`. Mirrors the pattern already used in `docs/pages/compare/index.ts`.
- **Verified:** SSG builds cleanly without `latest.json`.

### M4 (major) — FAST adapter `:innerHTML` empty in prerender output

FAST's SSR engine does not evaluate `:innerHTML` property bindings, so the prerendered HTML for `/story/*` routes contained `<div class="story-text" ></div>` and `<div class="comment-section" ></div>` — empty. This made FAST's output-size and page-weight numbers not comparable to other adapters.

- **Resolution:** app-level post-build workaround (Option 1). Framework-level fix (Option 2) is deferred post-merge.
- **New files:**
  - `benchmarks/apps/hn-litro-fast/render-comments.ts` — shared comment-tree renderer (used by both prerender and client).
  - `benchmarks/apps/hn-litro-fast/postbuild-fill-innerhtml.ts` — reads `__litro_data__` from each static HTML file, renders the same markup, replaces the empty `<div>` markers.
- **Modified:** `benchmarks/apps/hn-litro-fast/nitro.config.ts` — registers a `compiled` hook that runs the fill step when `LITRO_MODE=static`.
- **Verified:** build log shows `[hn-litro-fast] filled :innerHTML on 79 story pages`; `/story/47760529` page weight grew from ~27 KB (empty) to 52.5 KB — on par with Lit (62.5 KB) and Elena (48.8 KB).
- **Docs updated:**
  - Removed `*` annotation for `litro-fast` in `docs/pages/benchmarks.ts` and the matching legend entry.
  - Added "Where Workarounds Live" subsection to `packages/docs-content/content/docs/adapters/overview.md` documenting that this workaround is app-level, not adapter-level — any FAST project must own a similar post-build step or avoid `:innerHTML` for SSG-critical content.

---

## Deferred (tracked follow-ups, not blocking merge)

### M1 — Cross-adapter date-formatting parity for user-created date

Different adapters render the `user.created` field in different formats:

- `hn-litro`, `hn-litro-fast`, `hn-litro-elena` → ISO (`2024-03-15`)
- `hn-nuxt` → localized long (`March 15, 2024`)
- `hn-nextjs` → relative (`4d ago`) — also semantically wrong for a creation date

**Fix sketch:** pick ISO, apply to all 5 apps (`pages/user/[id]`).

### M2 — 404 handling parity

- `hn-nuxt` returns proper 404 (`createError({ statusCode: 404 })`).
- `hn-nextjs`, `hn-litro{,-fast,-elena}` render `<div class="hn-empty">Not found</div>` with 200 status.

Not load-bearing for current benchmarks (fixtures guarantee hits), but would bite anyone running against real HN API or clicking unseeded routes.

### M3 — Unsafe cast in `benchmarks/apps/hn-shared/api.ts:50`

`const item = await fetchItem(id) as HNComment;` bypasses both null and type-narrowing checks. Runtime safe today thanks to the guard on the next line, but fragile.

**Fix sketch:** `const item = await fetchItem(id); if (!item || item.type !== 'comment') return null;`.

### M5 — `hn-nuxt/nuxt.config.ts` missing `nitro.preset: 'static'`

Consistency nit. `npx nuxi generate` forces full static generation regardless of `nitro.preset`, so this does not affect output — but matching `benchmarks/apps/nuxt/nuxt.config.ts` is cleaner.

### ~~FAST hydration import verification~~ (resolved)

Audit item referenced `@microsoft/fast-ssr/install-element-hydration.js` — that path does not exist; the hydration install lives under `@microsoft/fast-element`. Verified:
- Client hydration: `benchmarks/apps/hn-litro-fast/app.ts:1` imports `@microsoft/fast-element/install-element-hydration.js` (matches `playground-fast`, `playground-starlight-fast`, and the framework's own `packages/framework/src/adapter/fast/runtime/client.ts`).
- Server DOM shim: `benchmarks/apps/hn-litro-fast/nitro.config.ts:62` imports `@microsoft/fast-ssr/install-dom-shim.js` (correct — this is the SSR-side shim, not the hydration install).

### Option 2 — Supplemental fast-ssr `unsafeHTML` package (framework-level `:innerHTML` fix)

Per prior decision, Option 2 is deferred until after this PR merges. Goal: ship a supplemental package (possibly `@beatzball/fast-ssr-unsafe-html` or similar) that provides a proper `unsafeHTML`-style directive for fast-ssr so other FAST users don't need to write their own post-build step. This would eventually replace the app-level workaround in `hn-litro-fast`.

---

## Minor / nits (non-blocking)

- `benchmarks/apps/hn-nuxt/dist` is a tracked symlink → `.output/public`. Runner uses `.output/public` directly, so the symlink is unused — consider removing.
- Lit HN pages repeat `<link rel="stylesheet" href="/hn.css">` inside each component template instead of hoisting to `routeMeta.head`. Cosmetic.
- `HNComment.text` typed as `string` instead of `string | undefined`; guards with `text ?? ''` cover the edge.
- `hn-nextjs/app/{ask,show}/page.tsx` render an `<h2>` header not present in other adapters. Minor parity.
- `hn-shared/fixture-ids.ts` user list has 10 entries vs ~27-30 stories per category. Keeps scope small.
- `hn-nextjs/next.config.js` has `images: { unoptimized: true }` — unused since benchmarks have no images.
- `benchmarks/src/runner.ts` imports `measureHttpPerf` but does not use it in the `--hn` branch.
- `cross-framework.ts` routes nullish coalescing — empty array treated as truthy; add `routes.length > 0` guard if reused.

## Out of scope

- **Shared API Firebase default** in `hn-shared/api.ts`. `getBase()` falls back to the real Firebase URL when `HN_API_BASE` is unset. Deferred by decision — mock API sets the env var during benchmark runs, and the real API is acceptable for manual dev.
- **Per-request SSR benchmarks** (`--hn-ssr`). Explicitly TODO'd in `docs/pages/benchmarks.ts`.
- **Full Lighthouse on HN clones.** DSD limitation documented.

---

## Verification results

| Check | Result | Source |
|---|---|---|
| `@beatzball/litro` unit tests | 295/295 | `pnpm test` |
| `@beatzball/litro-router` unit tests | 18/18 | `pnpm --filter @beatzball/litro-router test` |
| `@beatzball/create-litro` unit tests | 17/17 | `pnpm --filter @beatzball/create-litro test` |
| `@beatzball/litro-docs-ui` unit tests | 61/61 | `pnpm test:docs` |
| `@beatzball/litro-docs` unit tests | 43/43 | `pnpm test:docs` |
| Playwright e2e | 159/159 | `pnpm test:e2e` |
| `pnpm bench:hn` end-to-end | clean | — |
| Security advisories on branch | 6 (5 moderate, 1 high) | `pnpm audit` |
| Security advisories on `main` | 6 (identical set) | `pnpm audit` on `main` |
| **New vulnerabilities introduced** | **0** | diff of advisory sets |
| Published packages modified | `@beatzball/litro` (dev-polling narrowing — patch) | `git diff main...HEAD -- packages/framework` |
| Changeset required | patch for `@beatzball/litro` | see below |

All 6 pre-existing advisories are transitive dependencies of `nitropack`, `vite`, or `lighthouse` and already present through other benchmark apps on `main`.

### Framework change (scoped to dev-mode polling narrowing)

Renames `ShellOptions.devMode` to `ShellOptions.contentDevPolling` and narrows the dev-mode polling script so it only runs for apps using the content layer. The content plugin sets `LITRO_HAS_CONTENT=true` during build; the page handler then gates the `<script>` tag that polls `/_litro/_litro-version.json`.

- **Why this shipped with Phase 4:** the HN benchmark apps don't use the content layer, and the unconditional polling script generated continuous 404 noise in dev.
- **Behavior change:** apps without the content layer no longer receive the dev-mode polling script. Content-using apps are unaffected.
- **Back-compat:** `buildShell()` is exported at `@beatzball/litro/runtime/shell.js` but is not documented as a public entry point — it's an internal runtime seam. External consumers passing `devMode: true` silently get no polling, which matches the new behavior's intent (polling only when content exists).
- **Changeset:** patch-level bump for `@beatzball/litro`.
