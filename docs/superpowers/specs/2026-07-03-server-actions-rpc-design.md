# Server Actions (Typed RPC) — v1 Design

- **Status:** Approved design, pre-implementation
- **Date:** 2026-07-03
- **Scope:** Litro core (`@beatzball/litro`) — Vite plugin + Nitro plugin + runtime. RFC phases 1–2 (spike + core). Forms, streaming returns, GET actions, and the lint rule are explicitly deferred to a second milestone.
- **Relationship to `@litro/agent`:** Server Actions ship first. The agent layer will reuse this milestone's serializer (seroval), the `/_litro/*` runtime-endpoint pattern, Standard Schema validation, and the `.server.ts` externalization boundary. Nothing in the agent spec blocks or is blocked by decisions here.

## 1. Summary

A typed function-call boundary between client and server. Export an async function from a `*.server.ts` module and import it anywhere:

- **On the server (SSR, other server code):** the import resolves to the real module; calls are plain in-process function calls.
- **In the browser:** a Vite plugin replaces the import with a generated stub that serializes arguments, POSTs to `/__litro/action/:id`, and deserializes the result. TypeScript resolves the import to the real file in both cases, so the call is fully typed with no schema duplication.

Server module code and its transitive dependencies (DB drivers, secrets) structurally never enter the client bundle.

## 2. Decisions made during design review

| Question | Decision |
|---|---|
| v1 scope | Core RPC only (RFC phases 1–2) + CSRF default. Forms/streaming/GET/lint deferred. |
| Endpoint mounting | Auto-registered by the Litro actions plugin (invoked from the same `nitro.config.ts` hooks that already call the page scanner). No consumer route files. Exact registration mechanism is spike question 1 — see §4.2. |
| Server-module marker | `.server.ts` filename only. No `'use server'` directive in v1 (can be added later, non-breaking). |
| Serializer | seroval, plain (non-streaming) mode in v1. Dependency chosen for its streaming mode, which the forms/streaming milestone and the agent layer will use. |
| ID coordination | Mirrored computation: both builds independently hash `(posix-relative-path + '#' + exportName)`. No artifact passes between builds. |
| `definePageData` reconciliation | Untouched. Docs position actions as the mutation/on-demand path, `pageData` as initial-render data. |
| Package placement | Inside `@beatzball/litro` (no new package). New subpath exports. |

## 3. Corrections to the source RFC

The draft RFC (authored outside this repo) used conventions that do not exist in Litro. Anywhere the RFC and this spec disagree, this spec wins:

- **No `.litro` page files, no async-function pages.** Pages are `.ts`/`.tsx` files exporting a default component class; server data comes from a named `pageData = definePageData(...)` export. The RFC's §3.2 example translates to calling the action inside a `definePageData` fetcher (or any server-side code path).
- **No `litro.config.ts` / `defineConfig` / `notFound()` export.** Config is `nitro.config.ts` + `vite.config.ts`; adapter selection via `LITRO_ADAPTER` env var.
- **The framework ships no server route handlers today** — consumers own `server/routes/[...].ts`. Hence the auto-registration decision above.

## 4. Architecture

```
                     posts/posts.server.ts
                    (real module, real types)
                      │                 │
        ┌─────────────┘                 └──────────────┐
        │ Nitro build (server)                          │ Vite build (client)
        ▼                                               ▼
  plugins/actions.ts (build:before)              vite/actions.ts
  - scan **/*.server.ts                          - intercept *.server.ts imports
  - generate #litro/action-manifest              - parse exports (es-module-lexer)
  - push handler into nitro.options.handlers     - emit stub module per export
        │                                               │
        ▼                                               ▼
  POST /__litro/action/:id   ◄──── HTTP (seroval) ────  callAction(id, args)
  - lookup id → lazy import
  - validate (Standard Schema) if defineAction
  - call handler / plain fn
  - serialize result / forward error

  SSR path: server code imports the real module directly — no transform, no HTTP.
```

### 4.1 Action IDs

`id = hash(relPath + '#' + exportName)` where `relPath` is the module path relative to the project root, posix-normalized. Hash: SHA-256, hex, truncated to 12 chars. Properties:

- **Stable** across rebuilds (survives deploys; a client on a stale bundle still resolves).
- **Opaque** — source paths do not leak into URLs.
- Computed identically and independently by both plugins; a shared `hashActionId(relPath, exportName)` util lives in framework `src/actions/` and is unit-tested for stability (snapshot of known inputs → known ids).

Renaming a file or export intentionally changes the id (it is a different contract). Collision handling: the scanner errors at build time if two actions produce the same id.

### 4.2 Server side — Nitro build plugin (`packages/framework/src/plugins/actions.ts`)

Sibling of the existing page scanner (`plugins/pages.ts`), registered the same way in `nitro.config.ts` at `build:before`:

1. Scan the project for `**/*.server.{ts,tsx,js,mjs}` excluding `node_modules` and output dirs.
2. Parse each module's exports (es-module-lexer). Generate the `#litro/action-manifest` virtual module:
   ```ts
   export const actions = {
     'a1b2c3d4e5f6': { load: () => import('/abs/path/posts/posts.server.ts'), name: 'getPost' },
     // ...
   };
   ```
   Also write a physical stub (like `server/stubs/page-manifest.ts`) so tsc resolves the virtual module.
3. Register the runtime handler at `POST /__litro/action/:id` with **no consumer route file**. ⚠️ **Spike question 1 — the mechanism is unproven.** No existing code pushes into `nitro.options.handlers`; vite-dev middleware is registered via a static `handlers` array in each consumer's `nitro.config.ts` pointing at a consumer-owned file, and the repo documents (playground `nitro.config.ts:96-101`, framework `plugins/vite-dev.ts:25-38`) that the dev server reads handler arrays *before* `build:before` fires — which is exactly why an earlier `devHandlers`-push approach failed. The spike must determine which works in both dev and build:
   - (a) `nitro.options.handlers.push(...)` from the actions plugin at `build:before` (or an earlier hook if one is available to config-invoked plugins);
   - (b) fallback: a static `handlers` entry in `nitro.config.ts` pointing at a framework-exported handler (`@beatzball/litro/actions/handler`) — still no consumer-owned file, one config line, added to templates/playgrounds like the existing vite-dev entry.
4. Scope the `/_litro/**` immutable-cache route rule so it does not apply to `/__litro/action/**`. Note: this rule is copy-pasted across 10+ consumer configs (all playgrounds, docs-ssr, benchmark apps) and the create-litro templates — v1 applies the carve-out only to apps that adopt actions (playground + playground-elena); create-litro templates get wired in milestone 2 (forms), which touches the templates anyway. Until then the docs' setup section covers manual wiring.

Dev-mode behavior matches the page scanner: adding a brand-new `.server.ts` file mid-session follows whatever rescan/restart semantics `pages.ts` already has; we do not build new watcher machinery in v1.

### 4.3 Runtime handler (`packages/framework/src/actions/handler.ts`)

Request lifecycle for `POST /__litro/action/:id`:

1. **CSRF gate (default-on):** require the `x-litro-action: 1` header; if `Sec-Fetch-Site` is present it must be `same-origin` or `none`; if `Origin` is present it must match the request host. Cross-origin form posts cannot set custom headers, so this closes classic CSRF without session/token infrastructure. (Token machinery arrives with the forms milestone, which actually needs it.) Failure → 403.
2. **Lookup:** id → manifest entry; unknown → 404.
3. **Deserialize** the request body with seroval → args array (plain function) or input value (defineAction).
4. **Dispatch:**
   - `defineAction` export → validate input against its Standard Schema (failure → 400 with the validator's issues array), then `handler(input, { event })`.
   - Plain async function export → call with the args array spread.
5. **Respond:** result serialized with seroval, `content-type: text/javascript; charset=utf-8` (seroval's native output) or a JSON envelope — implementation picks one and the stub matches it.
6. **Errors:** thrown errors become a structured error payload: `{ name, message, status }` (+ stack in dev only). H3 errors keep their `statusCode`. The client throws `LitroActionError` reconstructed from the payload. No internal stack traces in production responses.

### 4.4 Client side — Vite plugin (`packages/framework/src/vite/actions.ts`)

- `resolveId`/`load`: when a module id matching `*.server.*` is imported into the client graph, resolve to a virtual stub module instead of the real file. The filter must test the **resolved** filename, not the raw specifier — repo convention imports `./posts.server.js`, which Vite resolves to `posts.server.ts`.
- The plugin reads the real file once with es-module-lexer to enumerate export names, then emits:
  ```ts
  import { callAction } from '@beatzball/litro/actions/client';
  export const getPost = (...args) => callAction('a1b2c3d4e5f6', args);
  export const createPost = (input) => callAction('f6e5d4c3b2a1', [input]);
  ```
- Default exports are supported (`export default (...args) => callAction(...)`).
- Non-function exports from a server module (constants, types are erased anyway) are a **build error** with a message explaining that everything exported from `.server.ts` becomes an endpoint — this enforces RFC §5 point 3 at build time.
- The real module is never loaded into the client graph, so its imports (DB, secrets) are structurally absent from `dist/client/` — enforced by test (§7), not hope.
- The plugin ships as part of a `litroActionsPlugin()` export from `@beatzball/litro/vite` and is added to playground/template `vite.config.ts` files.

### 4.5 Client runtime — `callAction` (`packages/framework/src/actions/client.ts`)

```ts
export async function callAction<T>(id: string, args: unknown[]): Promise<T>;
```

Serializes args with seroval, `fetch('/__litro/action/' + id, { method: 'POST', headers: { 'x-litro-action': '1', ... }, body })`, deserializes the response, throws `LitroActionError` on non-2xx. Browser-safe module: no Node imports (respects the client-subpath export gating in `src/index.ts`).

### 4.6 `defineAction` (`packages/framework/src/actions/define.ts`, exported from `@beatzball/litro/actions`)

```ts
interface ActionContext { event: H3Event | undefined }

function defineAction<In, Out>(config: {
  input?: StandardSchemaV1<In>;
  handler: (input: In, ctx: ActionContext) => Promise<Out>;
}): (input: In) => Promise<Out>;   // callable, with config attached via symbol
```

- Returns a **callable function** so `await createPost(input)` works identically in-process during SSR: validation runs, then the handler.
- `input` accepts any Standard Schema v1 validator (Zod, Valibot, ArkType) — validated via the spec's `~standard.validate`, no Zod dependency.
- In-process `ctx.event` comes from Nitro's async context (`useEvent()`). Nothing in Litro currently enables this: adding `experimental.asyncContext: true` to Litro's presets is **new work in this milestone** (work item 2). `useEvent()` is believed available in the pinned nitropack 2.13.1 but has not been verified against the installed package — spike question 2. If unavailable at runtime, `event` is `undefined` and documented as such.
- `method` option from the RFC is deferred (everything is POST in v1).

### 4.7 What the model of use looks like (corrected RFC examples)

```ts
// posts/posts.server.ts
export async function getPost(id: string) { /* db read */ }

// pages/posts/[id].ts  — SSR: in-process
// (.js specifier per repo convention — avoids allowImportingTsExtensions, see pages.ts:65-70)
import { getPost } from '../../posts/posts.server.js';
export const pageData = definePageData(async (event) => {
  return { post: await getPost(event.context.params?.id ?? '') };  // h3 types params as optional
});
export default class PostPage extends LitroPage { /* renders from data */ }

// pages/posts/[id].ts, client-side method — browser: typed RPC (same import, stubbed by Vite)
const fresh = await getPost(this.postId);
```

Design-system guidance (RFC §6) carries over verbatim: actions are called at the page/route layer; `components/` stay presentational and receive data as props.

## 5. Security posture (v1)

- Every export of a `.server.ts` module is a public endpoint; docs state this in the first paragraph of the feature page.
- CSRF: custom-header requirement + `Sec-Fetch-Site`/`Origin` checks, default-on (§4.3).
- Validation: `defineAction` + Standard Schema is the documented default for anything touching data; plain functions are documented as "trusted-input only."
- Errors: no stacks or internal fields in production responses.
- Rate limiting: documented as composing at the Nitro middleware layer (seam documented, nothing baked in).

## 6. Deliverables

New direct dependencies of `@beatzball/litro`: `seroval` (entirely new to the workspace) and `es-module-lexer` (currently only transitive via vitest tooling).

### Spike questions — ANSWERED 2026-07-04 (empirically, playground dev + build)

1. **Handler registration mechanism:** option (a) — pushing into `nitro.options.handlers` at `build:before` — is NOT picked up by the dev server (verified: route 404 in dev, exactly the timing trap the repo documents for devHandlers). SHIPPED: option (b), a static `handlers` entry in consumer `nitro.config.ts` pointing at the generated `server/stubs/action-handler.ts` (same shape as the vite-dev entry). The plugin guarantees the stub exists before rollup compiles it.
2. **`useEvent()` / asyncContext:** works in PRODUCTION builds (verified: in-process `defineAction` call during SSR resolved `ctx.event.path === '/actions'` with `experimental.asyncContext: true` from Litro's presets). Does NOT resolve in the dev worker (`ctx.event` is `undefined` in dev) — documented limitation; HTTP calls always receive the handler's own event in both modes.
3. **Dev-mode stub serving:** confirmed — Vite dev middleware applies the actions transform identically to the production build (browser receives the stub module; RPC works in dev).

**Additional integration findings (discovered during the spike, all shipped):**
- **Endpoint moved to `POST /__litro/action/:id`** (double-underscore prefix, OUTSIDE `/_litro/`). Nitro mounts serve-placeholder middleware on the `publicAssets` baseURL `/_litro/`, which intercepts any miss under that prefix with a placeholder 404 BEFORE the router runs — in dev and prod alike. The action endpoint therefore cannot live under the static-assets prefix; the spec's earlier "coexist with the cache rule" framing understated this. Consequence: no `/_litro/**` cache-rule carve-out is needed; instead consumers add a `'/__litro/action/**': { headers: { 'cache-control': 'no-store' } }` route rule.
- **Stub writes must be idempotent:** `server/stubs/` sits inside Nitro's watched `srcDir`; unconditional rewrites on every `dev:reload` re-trigger the watcher in an infinite reload loop. The plugin now skips writes when content is unchanged.

### Work items

1. `hashActionId` util + tests.
2. Nitro plugin `plugins/actions.ts` (scan, manifest, handler registration per spike outcome, route-rule carve-out in adopting playgrounds) and `experimental.asyncContext: true` in `config/presets.ts`.
3. Runtime handler `actions/handler.ts` (CSRF, dispatch, serialization, error forwarding).
4. Vite plugin `vite/actions.ts` (stub generation, externalization, non-function-export error).
5. `defineAction` + `callAction` + `LitroActionError` + subpath exports (`@beatzball/litro/actions`, `@beatzball/litro/actions/client`, plugin export from `@beatzball/litro/vite`).
6. Playground integration: demo `.server.ts`, a page using it via `pageData` (SSR path) and a client button (RPC path); plugin wired into playground `vite.config.ts` and `nitro.config.ts`.
7. Docs (kept in lockstep, see §8): a Server Actions guide in `packages/docs-content/content/` covering define/call/validate/security, plus the design-system guidance.
8. Changeset for `@beatzball/litro` (one file, one package, per repo convention).

## 7. Testing

- **Unit (vitest, framework package):** hash stability snapshots; stub codegen (given a source file, exact stub output); handler dispatch — plain fn, defineAction happy path, validation failure → 400 + issues, unknown id → 404, missing CSRF header → 403, thrown error → structured payload without stack in prod mode; seroval round-trips for `Date`, `Map`, `Set`, `BigInt`, circular refs; loud failure for a function-valued argument.
- **E2E (Playwright, playground):** SSR page renders data fetched via in-process action call; button click performs the RPC and updates the DOM; direct `curl`-style POST without the CSRF header is rejected.
- **Externalization proof (build test):** the demo `.server.ts` contains a canary string (e.g. a fake secret constant); after `litro build`, assert the canary appears in the server bundle and is absent from every file under `dist/client/`.
- **Adapter-agnosticism smoke:** the same demo wired into one non-Lit playground (FAST or Elena) — action import + RPC works identically.

## 8. Verification protocol — independent validation at every checkpoint

Requirement from design review: documentation stays current with the code, and **no hallucinations survive in code, tests, or docs**. Enforcement is structural, not aspirational:

- **Checkpoints:** (a) after the spike (dual build + externalization + SSR direct call proven, spike questions 1–3 answered), (b) after core implementation (work items 1–6), (c) after docs (work item 7), (d) pre-PR. Checkpoint zero — this spec itself — was validated by an independent agent on 2026-07-03; one refuted claim (handler registration precedent) and four nuances were corrected in place.
- **At each checkpoint, dispatch one or more independent sub-agents that did not produce the artifact under review.** Their brief: verify every claim against the actual codebase — every API named in docs/comments exists with the stated signature and export path; every code example type-checks against real conventions (class pages, `pageData` export, `nitro.config.ts`/`vite.config.ts` — not RFC-invented surfaces); every test asserts what its name claims; every spec statement about existing Litro behavior matches the source.
- **Findings are fixed before the checkpoint passes.** A checkpoint report lists what was verified and what was corrected.
- **Docs lockstep rule:** any change to the public surface (export names, endpoint path, header names, error shape) during implementation updates the docs-content guide and this spec in the same commit — the pre-PR validation agent diffs docs claims against the final code.

## 9. Out of scope (deferred to milestone 2+)

- `formAction` and the no-JS progressive-enhancement form path (brings the CSRF token machinery).
- Streaming returns (`AsyncIterable` handlers) — seroval's streaming mode, shared with the agent layer.
- `GET` actions and cache semantics.
- The author-time lint rule ("exported server function without an input schema").
- create-litro template wiring (docs cover manual setup; templates are updated in milestone 2 alongside forms).
- `'use server'` directive support.
- Type-level `Serializable<T>` constraint.
- Migrating `LitroPage.fetchData()` onto the action machinery.

## 10. Rollout order relative to `@litro/agent`

Server Actions v1 (this spec) → Server Actions milestone 2 (forms + streaming) → `@litro/agent` prototype (§11 of the agent spec), which consumes: seroval streaming, `/_litro/*` runtime endpoints, Standard Schema validation, and the `.server.ts` boundary for agent tool modules. The agent spec's `litro.config.ts` surface must be re-drafted against the real config model (`nitro.config.ts` + env) before its own design review.
