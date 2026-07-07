# Server Actions Milestone 2 — Forms, Streaming, Templates

- **Status:** Approved design, pre-implementation
- **Date:** 2026-07-05
- **Builds on:** Server Actions v1 (PR 88, merged; spec `docs/superpowers/specs/2026-07-03-server-actions-rpc-design.md`). All v1 contracts are frozen: endpoint `POST /__litro/action/:id`, `hashActionId = sha256(relPath + '#' + exportName).slice(0,12)`, seroval JSON-data modes only (never code-eval), static `handlers` route entry, idempotent generated-file writes.
- **Scope:** (1) progressive-enhancement forms with a no-JS path, (2) streaming action returns, (3) create-litro fullstack template wiring, (4) the v1 follow-up basket. Deferred again: GET actions/caching, `'use server'` directive, lint rule, type-level `Serializable<T>`.

## 1. Decisions made during design review

| Question | Decision |
|---|---|
| M2 scope | Forms + streaming + template wiring + follow-ups. GET/directive/lint deferred. |
| Form CSRF | Origin/`Sec-Fetch-Site` checks by default for form-mode requests (form posts cannot send the `x-litro-action` header; all evergreen browsers send Origin on cross-origin form POSTs). Per-action opt-in `defineAction({ csrf: 'token' })` adds a `__Host-litro-csrf` double-submit cookie + hidden field. |
| No-JS response | Post/Redirect/Get: success → 303 to `form.redirect ?? Referer`; validation failure → 303 back to Referer with a one-shot error cookie. Handlers keep full control via `ctx.event` (escape hatch). |
| Form binding API | Plain-HTML contract (approach A): isomorphic `actionUrl(action)` attribute value + one delegated-submit client enhancer + plain hidden input for the token. Zero per-adapter code. |
| Streaming transport | `application/x-ndjson`, one seroval cross-JSON node per line (`toCrossJSONStream`/`fromCrossJSON` — present in installed seroval 1.5.4). JSON-data mode; no code-eval on either side. |

## 2. Forms

### 2.1 Authoring surface (identical in Lit, FAST, Elena)

```ts
// pages/new-post.ts — template fragment (any adapter; it is plain attribute interpolation)
import { actionUrl } from '@beatzball/litro/actions/client';
import { createPost } from '../posts/posts.server.js';

html`
  <form method="post" action=${actionUrl(createPost)}>
    <input name="title" required />
    <textarea name="body"></textarea>
    <button>Publish</button>
  </form>`;
```

- **No JS:** the browser posts form-encoded data to the action endpoint; the handler validates, runs, and 303-redirects (PRG).
- **With JS:** the form enhancer intercepts the submit, converts `FormData` to an object, performs the normal seroval RPC, and dispatches `litro:action-success` / `litro:action-error` `CustomEvent`s on the form (detail = result / `LitroActionError`). The page decides what to do with them; no framework-rendered UI.

### 2.2 `actionUrl(action)` — isomorphic id resolution

`actionUrl` reads `Symbol.for('litro.action.id')` from the function and returns `/__litro/action/<id>`; it throws a descriptive error when the stamp is missing (module not scanned / not a `.server.ts` export).

- **Client:** the Vite plugin's stub codegen attaches the id: each generated export becomes `Object.assign((...args) => callAction("<id>", args), { [ACTION_ID]: "<id>" })` (via a small `makeStub(id)` helper in `actions/client.ts` to keep codegen minimal).
- **Server:** functions cannot know their own id, and the v1 handler registry builds lazily on first request — too late for SSR of a form. The scanner therefore generates one additional file, `server/plugins/litro-actions.ts` (Nitro auto-loads `server/plugins/` at boot; confirmed by existing config comments), which imports `#litro/action-manifest` and stamps `hashActionId(relPath, exportName)` onto every exported function at startup. No new consumer wiring; the existing `playground*/server/stubs/` gitignore pattern gains a sibling entry for the generated plugin file.
- `actionUrl` lives in `actions/client.ts` (browser-safe) and is re-exported from `@beatzball/litro/actions`; the stamping helper (`stampActionIds`) lives server-side.

### 2.3 Form-mode handling in the endpoint

The handler branches on request content-type (`application/x-www-form-urlencoded` or `multipart/form-data` → form mode; everything else → v1 RPC mode, unchanged):

1. **Gates:** form mode skips the `x-litro-action` header requirement; Origin/Host (incl. `x-forwarded-host`, §5) and `Sec-Fetch-Site` gates still apply. If the action has `csrf: 'token'`, the `_litro_csrf` body field must equal the `__Host-litro-csrf` cookie (403 otherwise, or when either is absent).
2. **Target restrictions:** form mode requires a `defineAction` export **with an `input` schema** — form fields are named hostile strings and the schema is the parse boundary. Plain-function actions and schema-less `defineAction`s → 400 with a message explaining why.
3. **Input:** `readFormData(event)` (h3) → `Record<string, string | File>` (`FormData` entries; repeated names become arrays) → Standard Schema validation → handler runs with `ctx.event` as usual.
4. **Response (PRG):** success → 303 to `config.form?.redirect ?? Referer ?? '/'`. Validation failure → 303 to Referer with a one-shot `litro-form-error` cookie containing `{ actionId, issues }` (JSON, `Path=/`, `SameSite=Lax`, `Max-Age=30`, HttpOnly **off** so enhanced clients could also read it — value is already client-visible data). Unexpected handler errors → 303 with `{ actionId, message, status }` in the same cookie, no stacks.
5. **Escape hatch:** if the handler itself writes a response / calls `sendRedirect` (detected via `event.handled`), the framework sends nothing further.

New `ActionConfig` fields: `csrf?: 'origin' | 'token'` (default `'origin'`) and `form?: { redirect?: string }`.

### 2.4 Server helpers for pages

- `csrfToken(event): string` — returns the current token, minting + setting the `__Host-litro-csrf` cookie if absent (only needed by pages containing token-mode forms; used inside `definePageData` fetchers and passed to the template for `<input type="hidden" name="_litro_csrf" value=...>`).
- `getFormErrors(event): { actionId, issues?, message?, status? } | null` — reads and clears the one-shot cookie so pageData can surface validation errors after the PRG bounce.
- Both exported from a new server-only `@beatzball/litro/actions/server` subpath (they touch cookies/crypto; keeping them out of `actions/client.ts` preserves the browser-safe import graph).

### 2.5 The enhancer — `@beatzball/litro/actions/form-client`

One small browser module, explicitly imported from the app entry (`app.ts`) — opt-in, tree-shakeable, no adapter coupling:

```ts
import { enhanceForms } from '@beatzball/litro/actions/form-client';
enhanceForms(); // document-level delegated submit listener
```

Behavior: on `submit`, if `form.action` matches `/__litro/action/`, `preventDefault()`; build the input object from `FormData` (repeated names → arrays; `File` values pass through — seroval serializes Blobs); call `callAction(id, [input])`; dispatch `litro:action-success` (detail: result) or `litro:action-error` (detail: `LitroActionError`) on the form, both `bubbles: true, composed: true` so listeners work across shadow roots. Enhanced submissions are normal RPCs — the header gate applies, and the enhancer strips the `_litro_csrf` field from the input object before the call (a strict input schema would otherwise reject the unknown key; the token is only meaningful on the no-JS path).

## 3. Streaming returns

### 3.1 Authoring surface

```ts
export const tail = defineAction({
  input: jobSchema,
  async *handler({ jobId }, ctx) {
    for await (const line of logStream(jobId)) yield line;
  },
});
// client: for await (const line of await tail({ jobId })) { ... }
```

Any handler whose **result value** is an `AsyncIterable` (async generators included) streams; detection is `typeof result?.[Symbol.asyncIterator] === 'function'`. Plain values keep the v1 single-shot path byte-for-byte.

### 3.2 Transport

- Response: `content-type: application/x-ndjson`, `cache-control: no-store`, one line per chunk. Each line is `JSON.stringify` of a seroval **cross-JSON** node from a single `toCrossJSONStream`-style session (shared reference space across chunks), wrapped as `{ n: <node> }`; the final line is `{ done: true }`; a mid-stream handler throw emits `{ err: <ActionErrorPayload> }` then ends. The exact seroval cross-API composition (`toCrossJSON` per yielded value with a shared `refs` map is the fallback if `toCrossJSONStream`'s callback shape fits poorly) is an implementation detail the plan pins down against the installed 1.5.4 typings — both APIs are confirmed present.
- The h3 handler returns a `ReadableStream` (h3 1.15 sends web streams natively); backpressure via the stream controller.
- `callAction` inspects `content-type`: ndjson → returns an `AsyncIterable<unknown>` that parses lines incrementally (`TextDecoderStream` + line splitter), revives each `{ n }` via `fromCrossJSON` with a shared `refs` map, throws a reconstructed `LitroActionError` on `{ err }`, completes on `{ done }`. JSON → v1 behavior unchanged.
- Type flow needs no new surface: `defineAction<In, AsyncIterable<T>>` callables resolve to the iterable in-process; over HTTP `callAction`'s return is the same iterable shape.
- Form mode never streams (PRG responses only); a streaming action invoked in form mode → 400.

## 4. create-litro template wiring (fullstack recipe)

`packages/create-litro/recipes/fullstack/template/` gains the five v1 wiring edits (actionsPlugin in `build:before`, static handlers entry, `/__litro/action/**` no-store route rule, `#litro/action-manifest` imports mapping, `litroActionsPlugin()` in vite config), the `server/stubs/` + generated-plugin gitignore entries, and a minimal `actions/demo.server.ts` + form on an existing page demonstrating both paths. The 11ty-blog and starlight recipes stay untouched (content-site recipes; actions add server surface their deploy targets may not want). create-litro scaffolding tests updated accordingly.

## 5. Follow-up basket (from v1 reviews)

1. **`x-forwarded-host`:** the Origin/Host gate compares against `x-forwarded-host` (first value) when present, else `host` — matches deployments behind proxies that rewrite Host. Documented caveat: only enable trust of that header at the platform level (Nitro presets already do).
2. **`.mjs` specifier rewrite:** `toRelativeImportSpecifier` in `plugins/actions.ts` no longer rewrites `.mjs` → `.js` (only `.ts`/`.tsx` rewrite).
3. **Docs sentences:** production error payloads echo raw handler `Error.message` (shape responses deliberately); `.server.ts` modules outside the project root are stubbed client-side but never registered (silent 404) — keep actions inside the app; `experimental.asyncContext` on edge presets requires runtime AsyncLocalStorage support (e.g. Cloudflare `nodejs_compat`).
4. **Docs guide update:** forms section (both paths, CSRF modes, PRG flow), streaming section, template-recipe note. The forms section must include a complete worked error-handling example — the same pattern as the playground `/forms` page: the action's schema rejects, the 303 bounce, `getFormErrors(event)` in `pageData`, and the template rendering `issues` with the form repopulated via `defaultValues` passed through pageData; plus one paragraph on the enhanced path (`litro:action-error` event) so both failure surfaces are documented side by side — same lockstep + independent fact-check rules as v1 (spec §8 of the v1 design carries over verbatim as this milestone's verification protocol, including the personal-identifier pre-push grep).

## 6. Testing

- **Units (vitest):** form-mode branching (content-type detection, schema requirement, field→object conversion incl. repeats/Files), CSRF token mint/compare (`__Host-` cookie attributes), PRG responses (303 targets, one-shot cookie set/clear), `actionUrl` stamp resolution + missing-stamp error, stub codegen with attached ids, streaming serializer round-trip (multi-chunk, Date-in-chunk, mid-stream error, shared refs), `callAction` ndjson parsing.
- **E2E (playground):** a `/forms` demo page — no-JS submit via `request.post` with form content-type (303 + effect), enhanced submit via Playwright (event detail assertions), token-mode action (missing/wrong token → 403), streaming demo (`for await` over ≥3 chunks with a revived Date, mid-stream error surfaces as `LitroActionError`).
- **E2E error-redirect round trip (explicit requirement):** the playground `/forms` page is itself the worked error example — its `pageData` calls `getFormErrors(event)` and renders the issues above the form. One spec drives the FULL no-JS failure loop with a cookie-jar request context: POST invalid form data → assert 303 → follow the redirect with the returned cookie → assert the re-rendered page HTML contains the validation message → GET once more and assert the error is gone (one-shot cookie cleared). A second spec covers the enhanced-path failure: submit invalid data with JS enabled and assert the `litro:action-error` event detail carries the same issues (no navigation).
- **Template:** create-litro test scaffolds the fullstack recipe and asserts the wiring files.
- **Checkpoints:** independent adversarial validation after core (A), full-suite regression (B), docs fact-check + changeset (C), final whole-branch review — identical protocol to v1.

## 7. Out of scope (milestone 3+)

GET actions and cache semantics; `'use server'` directive; author-time lint rule; `Serializable<T>` typing; server re-render form responses; file-upload size limits/streaming multipart (v2 accepts what `readFormData` buffers); `LitroPage.fetchData` migration onto actions.

## Implementation deviations

Recorded per the lockstep rule — where the shipped code differs from or refines this design, with rationale.

1. **seroval streaming composition uses per-yield `toCrossJSON(value, { refs })` with a shared refs map on both sides**, not `toCrossJSONStream`. The stream-callback shape of `toCrossJSONStream` targets embedded async values inside one root, which is the wrong fit for an explicit per-yield loop; per-value cross-JSON is the spec-sanctioned fallback and preserves cross-chunk object identity via the shared refs map.
2. **Client NDJSON parsing uses a `ReadableStreamDefaultReader` + `TextDecoder` line buffer, not `TextDecoderStream`.** The semantics are equivalent, and a manual reader/decoder loop is testable under vitest where `TextDecoderStream` piping is awkward.
3. **`enhanceForms(root = document)` takes an optional root and returns a detach function, and is idempotent per root (WeakSet guard).** `submit` events are `composed: false`, so shadow-root forms need `enhanceForms(this.renderRoot)`; the detach return lets components clean up on disconnect, and the idempotency guard makes a duplicate call on the same root a safe no-op.
4. **The Vite actions plugin serves throwing stubs for `@beatzball/litro/actions/server` in client builds.** Page modules import that server-only module for `definePageData` helpers, so it enters the client graph; stubbing keeps `node:crypto` out of the browser bundle while preserving the import for type resolution.
5. **The generated runtime plugin `server/plugins/litro-actions.ts` default-exports a plain function**, not a `defineNitroPlugin(...)` call. Nitro auto-loads a default-exported function from `server/plugins/`, so avoiding the `defineNitroPlugin` import keeps the generated file dependency-free and identical across setups.
6. **`formDataToObject` strips the `_litro_csrf` field on both paths, including the server.** The token is transport metadata; a strict input schema would reject it as an unknown key on the no-JS path, so stripping it server-side keeps the schema the sole parse boundary.
7. **Error responses split by cause: misconfiguration (plain-function target, schema-less `defineAction`, streaming result on a form post → 400) and CSRF-token failure (403) respond as plain JSON errors, while validation failures and handler throws PRG-bounce with the one-shot cookie.** The former are developer errors or attack traffic with no end-user flow to redirect into; the latter are legitimate user submissions that must re-render the page with their issues.
8. **`isFormContentType` matches the content-type essence** (the part before `;`, trimmed and lowercased, compared exactly) rather than a substring match. This hardens against misclassification via header parameters (e.g. `text/plain; x="multipart/form-data"`).
9. **`readFormData` failures are curated to a 400 `LitroActionError('Malformed form request body')`**, mirroring the RPC path's malformed-body 400 rather than surfacing h3's raw parser error.
10. **Consumer wiring is six one-time edits, not five** — the five v1 edits plus a committed `server/plugins/litro-actions.ts`. Nitro scans `server/plugins/` before the `build:before` hook writes files, so a build-time-generated stamp plugin would be missing on a project's first-ever dev run and `actionUrl()` would throw until restart; the `create-litro` fullstack template therefore ships the file committed (its content is static), and manual setups create it by hand while the actions plugin keeps it fresh thereafter.
