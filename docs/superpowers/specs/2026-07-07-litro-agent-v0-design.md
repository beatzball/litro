# `@beatzball/litro-agent` v0 — Design

- **Status:** Draft — pending user review, then design review
- **Date:** 2026-07-07
- **Source RFC:** `docs/superpowers/specs/2026-07-07-litro-agent-rfc-v0.md` (authored outside this repo). Where the RFC and this spec disagree, this spec wins — same treatment the Server Actions RFC received.
- **Scope:** the RFC's §11 vertical slice, items 1–4: one agent + one UI tool + web surface; data/UI separation; stream + resume; second component lib (FAST). OpenTelemetry moves to v0.1 (first deferral in line). Skills, MCP, presets, subagents, non-web surfaces, sqlite/postgres stores, scheduled runs, and evals are spec'd here as contracts but deferred.
- **Builds on:** Server Actions v1 + M2 (both shipped): seroval NDJSON stream protocol, Standard Schema validation, `.server.ts` externalization discipline, the consumer wiring pattern, and every timing/prefix lesson recorded in their specs.

## 0. Positioning (why this exists)

Agent frameworks today split into hosted-platform stacks — polished, but the convenience and the lock-in are the same surface — and open frameworks that are portable but have no UI story. Litro's agent layer takes the open side's posture (filesystem-first, no proprietary runtime, deploy anywhere Nitro deploys) and adds the one capability only a web-component UI framework can offer: **tools that return server-rendered design-system components** — the same elements the app's pages render, streamed as Declarative Shadow DOM and hydrated in place. The model reasons over structured data; humans see components; neither leaks into the other's channel.

## 1. Decisions made during design review

| Question | Decision |
|---|---|
| Package home | New workspace package `packages/litro-agent`, npm `@beatzball/litro-agent`. Not a framework subpath (keeps agent deps out of core); not `@litro/*` (scope not owned). |
| v0 implementation scope | RFC §11 items 1–4, with FAST as the second lib. OTel → v0.1. |
| Providers | TWO adapters day one — `openai-compatible` and `anthropic` — to force the provider interface neutral. Self-owned thin adapters; no multi-provider SDK dependency. |
| Session store default | JSONL file store (`.litro/sessions/<id>.jsonl`), zero dependencies, any Node floor. `node:sqlite` (Node 22.5+) becomes the first alternative adapter in v0.1. |
| Skill composition | Plain `import skill from './skills/x/SKILL.md'` via a rollup loader + ambient `declare module '*/SKILL.md'` types. No nonstandard import attributes. Spec-level only; implementation deferred past v0. |
| Integration | The actions pattern: `build:before` scanner plugin + generated manifest/handler stubs (content-compared writes) + static handler entries in consumer `nitro.config.ts`. |
| Naming in docs | No competitor product names in any committed documentation. |

## 2. Corrections to the source RFC

The RFC used conventions that do not exist in Litro or that collide with shipped decisions. Anywhere they disagree, this spec wins:

1. **No `litro.config.ts`, `defineConfig`, `plugins: []`, `components: "lit"`, or `nitro: { preset }`** (RFC §3). Config is `nitro.config.ts` + `vite.config.ts`; the component lib is selected by `LITRO_ADAPTER` env. The agents plugin is wired like the actions plugin (§4 below). Runtime options (session store, telemetry) move to an optional `agents/_config.ts` (§4.3) — they are runtime concerns the handler needs, not build-plugin options.
2. **Endpoint prefix is `/__litro/`, not `/_litro/`** (RFC §2). `/_litro/` is the publicAssets baseURL; Nitro mounts serve-placeholder middleware there that answers misses before the router runs — the exact trap that moved actions to `/__litro/action/:id`.
3. **No `.litro` page files** (RFC §2). Pages are `.ts`/`.tsx` component classes.
4. **Standard Schema, not zod** (RFC §5). `defineTool.input` accepts any Standard Schema v1 validator, matching `defineAction`. zod works because it conforms, not because it is depended on.
5. **No `with { type: "skill" }` import attributes** (RFC §4/§7). Three toolchains (Nitro rollup, dev transform, tsc) would each need custom support. Plain `.md` imports through a loader keep the same ergonomics.
6. **Access guards are h3-native** (RFC §4). `defineAccess((event) => ...)` throws `createError({ statusCode: 401 })`, not a `Response`.
7. **Package is `@beatzball/litro-agent`** (RFC §0). The `agents/` directory name stands.
8. **`ui()` resolves through `LITRO_ADAPTER`** (RFC §5). Per-lib renderer modules live in this package (`ui/lit.ts`, `ui/fast.ts`); the `UIResult` contract is the shared shape. (Folding renderers into the framework's `FrameworkAdapter` interface is an explicit later option; v0 avoids touching framework core.)
9. **The session stream rides the shipped NDJSON protocol** (RFC §8) — `{ n: <seroval cross-JSON node> }` / `{ err }` / `{ done: true }` lines with shared reference space, exactly as actions stream. One framework addition: `@beatzball/litro` exposes `createStreamEncoder`/`createStreamDecoder`/`StreamChunk` under a new public subpath `./stream` (re-exports from the existing actions serializer) so agents and actions share one wire protocol.
10. **Import specifiers use `.js` extensions** in examples (NodeNext repo convention), not `.ts`.

## 3. Package layout

```
packages/litro-agent/            npm: @beatzball/litro-agent
  src/
    index.ts                     defineAgent, defineTool, defineAccess (+ types)
    ui/index.ts                  ui(), UIResult; renderer resolved by LITRO_ADAPTER
    ui/lit.ts                    @lit-labs/ssr render + collectResult
    ui/fast.ts                   @microsoft/fast-ssr
    providers/types.ts           Provider, ProviderEvent, ChatMessage, ToolSpec
    providers/openai-compatible.ts
    providers/anthropic.ts
    sessions/types.ts            SessionStore, SessionEvent
    sessions/file.ts             JSONL store (default)
    runtime/loop.ts              turn loop (provider stream -> tool dispatch -> log)
    runtime/handler.ts           createAgentHandler(entries, config) — POST + GET
    plugin.ts                    agentsPlugin(nitro) — scanner + codegen
    client.ts                    BROWSER-SAFE: agentSession(), hydrateUIResult()
```

Subpath exports mirror the framework style (`source`/`types`/`import` conditions): `.`, `./ui`, `./providers/openai-compatible`, `./providers/anthropic`, `./sessions/file`, `./handler`, `./plugin`, `./client`.

`client.ts` imports only `@beatzball/litro/stream` and its own types — the browser-safety rule from actions applies verbatim.

## 4. Consumer wiring (the config-surface redraft)

Follows the actions pattern; scaffolded apps get it pre-wired eventually, manual setup is enumerated one-time edits.

### 4.1 `nitro.config.ts`

```ts
import agentsPlugin from '@beatzball/litro-agent/plugin';
// handlers (static entries — build:before pushes never reach the dev server):
{ route: '/__litro/agent/:agent/:session', method: 'post', handler: resolve('./server/stubs/agent-handler.ts') },
{ route: '/__litro/agent/:agent/:session', method: 'get',  handler: resolve('./server/stubs/agent-handler.ts') },
// build:before, after actionsPlugin:
await agentsPlugin(nitro);
// routeRules:
'/__litro/agent/**': { headers: { 'cache-control': 'no-store' } },
```

### 4.2 Generated files (content-compared writes — the reload-loop rule applies)

- `server/stubs/agent-manifest.ts` + `#litro/agent-manifest` virtual: one entry per `agents/*/agent.ts` — `{ name, module, access, instructions, tools: [{ name, module }] }`. Tool names come from filenames under `agents/<name>/tools/`. `instructions.md` is read at build time and inlined into the manifest (no runtime fs read; works on every preset).
- `server/stubs/agent-handler.ts`: imports `createAgentHandler` + the manifest + the config module.
- Consumer `package.json` imports map gains `"#litro/agent-manifest"`.
- No boot-time runtime plugin is needed in v0 (nothing stamps ids); if one becomes necessary, it ships as a committed file — the `server/plugins/` scan-before-build lesson.

### 4.3 Runtime config: `agents/_config.ts` (optional)

```ts
import { defineAgentConfig } from '@beatzball/litro-agent';
import { fileSessionStore } from '@beatzball/litro-agent/sessions/file';

export default defineAgentConfig({
  sessions: fileSessionStore({ dir: '.litro/sessions' }),   // this IS the default; file optional
});
```

The scanner generates a `#litro/agent-config` virtual module (plus physical stub, like the manifest) that re-exports `agents/_config.ts` when the file exists and exports built-in defaults otherwise; the handler stub imports that. Telemetry config lands here in v0.1.

### 4.4 App directory

```
agents/
  concierge/
    agent.ts            defineAgent + optional `export const access`
    instructions.md     inlined at build time
    tools/
      get-weather.ts    default-exports defineTool; tool name = filename
```

`_`-prefixed directories (`agents/_shared/`, `agents/_config.ts`) are never scanned as agents.

## 5. Runtime surface

### 5.1 `defineAgent` / `defineAccess`

```ts
export default defineAgent({
  model: openaiCompatible({ baseURL: process.env.LLM_URL, model: 'qwen3' }),
  instructions: './instructions.md',   // build-time inlined; a literal string also accepted
  tools: [getWeather],                 // optional; scanner-discovered tools merge in
});
export const access = defineAccess((event) => {
  if (!event.context.user) throw createError({ statusCode: 401 });
});
```

Explicit `tools` and scanner-discovered `tools/` merge (explicit wins on name conflict) — filesystem-first with an explicit escape hatch. `skills`/`extends`/`mcp`/`subagents` are reserved config keys, typed but rejected at runtime in v0 with a "deferred" error message.

### 5.2 `defineTool`

```ts
export default defineTool({
  description: 'Get current weather for a city and show it as a card.',
  input: weatherSchema,                       // Standard Schema v1
  async execute({ city }, ctx) {              // ctx = { event, session: { id, seq } }
    const data = await fetchWeather(city);
    return ui(html`<weather-card .city=${city} .current=${data.current}></weather-card>`, { data });
  },
});
```

Return shapes:
- **plain value** — appended as `tool-result`; the model observes it (serialized to text/JSON for the provider).
- **`UIResult`** — appended as `ui` event; the model observes only `UIResult.data` (structural rule enforced in the loop, not by convention).
- **async generator** — each yield appends `tool-progress`; the return value is the `tool-result`. Same AsyncIterable convention as streaming actions.

Input is validated before `execute` (400-equivalent tool error on failure, fed back to the model as an error result). Tool JSON Schema for providers is converted from the Standard Schema where the vendor exposes it, else falls back to a permissive object schema with the description carrying the contract (v0 honesty; schema conversion depth is a v0.1 work item).

### 5.3 `ui()` / `UIResult`

Contract exactly as the RFC:

```ts
interface UIResult {
  type: 'ui';
  html: string;                                   // DSD (Lit/FAST) or light-DOM (Elena, later)
  data?: unknown;                                 // what the model observes; text-surface fallback
  hydrate?: { modules?: string[]; props?: Record<string, unknown> };
}
```

`@beatzball/litro-agent/ui` picks the renderer by `LITRO_ADAPTER` (`lit` default, `fast` in v0; `elena` later — no DSD/hydration there by design, `hydrate` stays absent). `hydrate.modules` is optional: when the page already loads the design system, elements upgrade automatically and only `props` re-bind. Templates must bind data through typed props/attributes — `unsafeHTML` of model- or user-supplied strings is a spec rule violation, not a caveat.

### 5.4 Provider interface

```ts
interface Provider {
  stream(req: { system: string; messages: ChatMessage[]; tools: ToolSpec[] }): AsyncIterable<ProviderEvent>;
}
type ProviderEvent =
  | { type: 'text-delta'; text: string }
  | { type: 'tool-call'; id: string; name: string; input: unknown }
  | { type: 'done'; usage?: { inputTokens?: number; outputTokens?: number } }
  | { type: 'provider-error'; message: string; status?: number };
```

`providers/openai-compatible` speaks the chat/completions wire shape (hosted APIs, gateways, and local runtimes in one adapter; `baseURL` + `apiKey?` + `model` options, `OPENAI_API_KEY` fallback). `providers/anthropic` speaks the Messages API (`ANTHROPIC_API_KEY` fallback). Both are thin fetch+SSE/stream parsers with no SDK dependency. The scripted test provider (§8) implements the same interface.

### 5.5 Session log and store

```ts
interface SessionEvent { seq: number; ts: number; kind: SessionEventKind; payload: unknown }
type SessionEventKind =
  | 'message'        // user or assistant text (assistant text accumulates from text-deltas at turn end;
                     //   deltas themselves stream as 'text-delta' events but only the final message persists)
  | 'text-delta'     // streamed, persisted for resume fidelity
  | 'tool-call' | 'tool-progress' | 'tool-result'
  | 'ui'             // UIResult
  | 'error' | 'turn-end';

interface SessionStore {
  append(sessionId: string, event: Omit<SessionEvent, 'seq'>): Promise<SessionEvent>; // assigns seq
  read(sessionId: string, fromSeq?: number): AsyncIterable<SessionEvent>;
}
```

Default store: one append-only `.litro/sessions/<id>.jsonl`, monotonic `seq`, fsync per append in v0 (correctness first; batching is a later knob). Session ids are caller-chosen opaque strings validated as `[A-Za-z0-9_-]{1,64}` (they become filenames — path traversal is rejected at the handler).

**Ordering rule (the keystone):** every event is appended to the store *before* it is written to the HTTP stream. The log is the source of truth; the response is a tail of it. Kill-mid-render resume and reconnect-from-seq are consequences, not features.

### 5.6 Turn loop and endpoints

`POST /__litro/agent/:agent/:session` — body `{ text: string }` (seroval-encoded, same gates as actions RPC: header + Origin/x-forwarded-host + Sec-Fetch-Site; then the agent's `access` guard). Acquires a per-session in-process lock (concurrent POST → 409). Appends the user `message`, then loops: provider stream → append `text-delta`s → on `tool-call`: append, validate, dispatch, append `tool-progress`/`tool-result`/`ui` → feed the result (or `UIResult.data`) back to the provider → repeat until `done` → append assistant `message` + `turn-end`. Response: NDJSON stream of `SessionEvent`s from this turn.

`GET /__litro/agent/:agent/:session?from=<seq>` — same gates minus the header (it is a read; Origin gates still apply) plus `access`. Streams stored events from `seq`, then live-tails an in-flight turn via an in-process broadcast, closing at `turn-end`. This is the reconnect path.

In-process lock scope is one Node process — documented v0 limitation (multi-instance deployments need a store-level lease; that lands with the sqlite/postgres adapters).

### 5.7 Client

```ts
import { agentSession, hydrateUIResult } from '@beatzball/litro-agent/client';
const s = agentSession('concierge', sessionId);
for await (const ev of s.send('what is the weather in lisbon?')) {
  if (ev.kind === 'ui') await hydrateUIResult(container, ev.payload as UIResult);
}
// s.resume(lastSeq) — reconnect stream, same event shape
```

Thin wrapper over the shared NDJSON reader; `resume` retries with backoff. `hydrateUIResult` injects DSD, dynamically imports `hydrate.modules` if present, re-binds `props` — the hydrate-support import-order rule from the app entry applies and is documented.

### 5.8 Skills: the sharing contract (spec'd here, implemented v0.1+)

Skills are deferred past v0, but their sharing semantics are part of this design's contract so later implementation cannot drift (RFC §7, corrected for the no-import-attributes decision):

- **On disk, a skill is a standard Agent Skill folder** — `SKILL.md` with frontmatter `name` + `description`, optional `scripts/`/`references/`/`assets/`. Nothing Litro-specific; a skill authored elsewhere drops in unchanged and a Litro skill runs in any skills-compatible runtime.
- **Three scope levels, mapped to the filesystem, resolved by skill `name` with local-first precedence** (local overrides shared overrides global):

```
my-litro-app/
  skills/                       GLOBAL — every agent loads these implicitly
    design-system/
  agents/
    _shared/skills/
      house-style/              SHARED — composed by explicit import from any agent
    concierge/skills/
      plan-trip/                LOCAL — this agent only, explicit import
```

- **Implicit only where a singleton is provably wanted:** global `skills/` load into every agent automatically (the design-system skill is the motivating case — exactly one, everywhere). Shared and local skills are composed by explicit import (`import planTrip from './skills/plan-trip/SKILL.md'` through the loader), so every non-global capability an agent has is traceable to a line in its `agent.ts`.
- **Bundles via `defineAgentPreset`:** a preset packages model + instructions + tools + skills once; agents `extends` it and add local specialization.
- **Distribution:** because a skill is a standard folder, it publishes as an npm package and remains installable from cross-tool skill registries — one artifact for in-repo, cross-repo, and public sharing.
- **The CEM-backed design-system skillset** is the flagship global skill: `SKILL.md` + a component-usage `references/catalog.md` + the Custom Elements Manifest projection in `assets/elements.json`. It teaches every agent which components exist and what props they take — the reliability substrate that makes §5.3's UI tools trustworthy rather than hopeful.

v0 ships none of this; it ships the reserved config keys (§5.1) and the `_`-prefix scanner exclusion (§4.4) so the hierarchy lands without breaking changes.

## 6. Security posture

- Both endpoints run the full actions gate stack, then the per-agent `access` guard. Sessions are only as private as the guard makes them — the docs lead with this.
- Tool inputs cross a trust boundary twice: model-generated (validate with the schema before `execute`) and, transitively, user-influenced. Standard Schema validation is mandatory for tools (a `defineTool` without `input` is a build error, unlike actions — tools are always model-callable).
- `UIResult.html` renders only from typed template bindings. The turn loop never feeds HTML to the provider.
- No stacks or internals in production events (`error` payloads follow the actions dev-only-stack rule).
- Session files contain conversation data; `.litro/` is gitignored by scaffolding and documented as sensitive.

## 7. Error handling

- Pre-stream: unknown agent/session-id-invalid/409/guard failures → plain JSON errors in the actions payload shape.
- In-stream: tool throw → `tool-result` with `{ error: { message } }` (the model sees it and can react); provider failure → `error` + `turn-end` events; the session stays resumable — a failed turn never corrupts the log.
- Client: `{ err }` NDJSON lines raise typed errors from the reader; `resume` after any failure replays from the last seen `seq`.

## 8. Testing

- **Unit (vitest, litro-agent package):** JSONL store (append/read/fromSeq/monotonic seq/concurrent-append ordering, malformed-line tolerance); both provider adapters against local mock HTTP servers speaking each wire shape (streaming chunks, tool-call deltas, error frames — no live keys); `ui()` per lib (DSD snapshot, `data` separation, hydrate passthrough); turn loop with a **scripted provider** (deterministic: emits scripted text/tool-call sequences) covering multi-tool turns, tool errors, provider failure mid-turn, the append-before-wire ordering, and the 409 lock.
- **E2E (playground):** `agents/demo/` + scripted provider + a demo card component. Specs map 1:1 to the RFC §11 exit criteria:
  1. send message → streamed text renders; card arrives as DSD, upgrades, props re-bind — no flash, no re-fetch.
  2. the same tool's `data` renders a sensible text fallback (assert model-side observation contains no HTML).
  3. kill the dev server mid-stream → restart → `resume(lastSeq)` replays and completes; a dropped client reconnects without restarting the turn.
  4. the same demo on the FAST playground passes 1–2 (proves `UIResult` is not secretly Lit-shaped).
- **Checkpoints:** identical protocol to v1/M2 — independent validation agents after core, full-suite regression, docs fact-check, final whole-branch review; personal-identifier sweep before every push.

## 9. Deferred (v0.1+), in priority order

1. OpenTelemetry spans (GenAI semantic conventions) via `agents/_config.ts`.
2. `node:sqlite` session store (Node 22.5+; store-level lease → multi-instance locking).
3. Skills: the full §5.8 contract — `.md` loader + ambient types, the global/shared/local scope hierarchy with local-first precedence, `defineAgentPreset`, npm/registry distribution, and the CEM-backed design-system skillset.
4. MCP client (`agents/<name>/mcp/`).
5. Standard-Schema→JSON-Schema conversion depth; provider tool-schema fidelity.
6. Elena `UIResult` renderer (light-DOM, no hydrate).
7. Subagents, additional surfaces, scheduled runs, eval suites.
8. create-litro template wiring + docs guide (docs land with v0 implementation per the lockstep rule; template wiring follows once the surface settles, mirroring the actions sequencing).

## 10. Open questions for the spike (answer empirically before core implementation)

1. Does `@microsoft/fast-ssr` render a detached template fragment cleanly outside the page pipeline (the `ui/fast.ts` path), or does it need the DI/registry setup the FAST adapter does for pages? (The Elena registry lesson suggests verifying, not assuming.)
2. Manifest inlining of `instructions.md`: confirm the build:before scanner can read agent dirs on dev reload without watcher loops (content-compared virtual regeneration, same as actions).
3. Live-tail GET: verify an in-process broadcast (emitter keyed by session) composes with Nitro dev worker isolation — dev may run handlers in a worker where module state is per-instance; if so, GET-tail in dev degrades to store-poll and that is acceptable v0 behavior. Document whichever holds.

### Spike answers (2026-07-07)

**Q1 — FAST detached fragment render.** `@microsoft/fast-ssr`'s `templateRenderer.render()` works cleanly outside the page pipeline: rendering `<page-about></page-about>` (the actual registered tag from `playground-fast/pages/about.ts`) via a *second*, independently-constructed `templateRenderer` (imported via `@beatzball/litro/adapter/fast/ssr-init`, which calls `fastSSR()` again) produced byte-identical DSD output — `<page-about><template shadowrootmode="open" shadowroot="open">...` — to rendering through the page pipeline's `globalThis.__litro_fast_template_renderer__` singleton. Double-init does **not** throw; `fastSSR()` and the DOM-shim install are idempotent enough that two independent `templateRenderer` instances coexist and both render correctly, because custom-element registration lives on the global `customElements` registry, not on the renderer instance — so `ui/fast.ts` can safely do its own standalone `ssr-init` import without caring whether the page pipeline already ran. One correction to the probe's assumption: rendering an *unregistered* tag name (`<about-page>`, guessed instead of the real `page-about`) does **not** throw — it silently round-trips as a plain unrendered element (`<about-page></about-page>`, no DSD, no `shadowrootmode`), which is a dangerous-to-debug failure mode `ui/fast.ts` and its tests must guard against explicitly (e.g. assert `dsd === true` / non-empty shadow template after render, not just absence of an error). Separately — and unexpected — `hasGlobal` was already `true` on the very first request to a plain `/api/*` route with no prior page visit, meaning Nitro's dev server eagerly imports the page manifest (and thus runs the FAST preamble) at startup while building its route table, not lazily on first page render; `ui/fast.ts` should not assume it needs to trigger a page render first to get a warm singleton, and can rely on its own `ssr-init` import regardless.

**Q2 — scanner freshness on dev reload.** Confirmed by reading `packages/framework/src/plugins/actions.ts`: `writeStub()` (lines ~126-139) reads the existing file and skips the write entirely when content is byte-identical, specifically to prevent `server/stubs/` (inside Nitro's watched `srcDir`) from re-triggering `dev:reload` and looping forever; the virtual module (`nitro.options.virtual['#litro/action-manifest']`) is reassigned unconditionally on every `dev:reload` since virtual-module reassignment doesn't touch the filesystem and can't trigger the watcher. The identical pattern applies to an `agents/` scanner one-for-one, **provided** the generator function inlines `instructions.md`'s actual file content into the generated string (not e.g. a last-modified timestamp or hash-of-path) — since `writeStub`'s comparison is a plain string equality check, any non-deterministic or metadata-only content in the generated stub (timestamps, absolute paths that vary by machine) would defeat the content comparison and reintroduce the reload loop. No contrary evidence found; this is the one new failure mode to guard against explicitly in the agents plugin's manifest generator.

**Q3 — dev module-state sharing.** Confirmed shared in both dev and production. Dev (`litro dev --port 3051`, three sequential `curl localhost:3051/api/spike-state`): `{"counter":1}`, `{"counter":2}`, `{"counter":3}` — module-level `let counter = 0` persisted across requests, i.e. `litro dev`'s Nitro dev server does **not** isolate handler invocations into per-request workers; it's a single long-lived process/module graph, same as the actions/page manifest singletons rely on. Production (`node ../packages/framework/dist/cli/index.js build` then `PORT=3053 node dist/server/server/index.mjs` — note: the build output lands at `dist/server/server/index.mjs`, not `.output/server/index.mjs` as assumed in the brief/spec context; the CLI prints the actual path) gave the identical sequence: `{"counter":1}`, `{"counter":2}`, `{"counter":3}`. This confirms an in-process `EventEmitter`-keyed-by-session broadcast for live-tail GET will work identically in dev and prod — no store-poll degradation is needed for v0's single-process deployment model; the documented limitation is scope-to-one-process (already called out in §5.6), not a dev/prod split.

## Implementation deviations

Deltas discovered while implementing Tasks 1–16; each stands as a one-line correction to the design above.

- The shared NDJSON wire protocol ships under a new `@beatzball/litro/stream` framework subpath (`createStreamEncoder`/`createStreamDecoder`/`serializeValue`/`deserializeValue`), which both the agent runtime handler and the browser client import — realizing §2.9's "new public subpath `./stream`".
- The client's internal turn generator is named `postTurnStream`, not `sendStream`: this browser module also lands in Nitro's server bundle (agent-client-importing pages are SSR'd), where unimport auto-injects h3's `sendStream` and collides with a same-named local `async function*` declaration — so the auto-import name is avoided entirely.
- The `ACCESS_GUARD` symbol sketched during design was dropped before publish: `access` is resolved as a plain named export off the agent module, so no symbol tag was needed.
- Spike Q1 answer holds in code: FAST detached-fragment render works via a standalone `@beatzball/litro/adapter/fast/ssr-init` renderer (registration lives on the global `customElements` registry, so double-init is safe), guarded by a registry-based check that throws on an unregistered tag rather than silently round-tripping it as a plain element.
- Spike Q3 answer holds in code: the live-tail broadcast uses shared module state (a `Set` lock registry plus a `Map` broadcast registry) and works identically in dev and prod — no store-poll fallback.
- The playground demo's scripted provider branches on the request shape (the last message's role — `user` vs `tool`) rather than the per-instance turn counter, so the weather/UI path is deterministic on every session, not just the first the process sees.
- Durability is realized as specified: a POST client disconnecting mid-turn flips a `clientGone` flag that skips writes to the dead response stream while the turn keeps appending to the store and broadcasting to live tails, so the persisted log always completes and a reconnecting client replays via `?from=`.
- The FAST UI renderer's component DOM-shim/registration imports carry an intra-file import-ordering requirement (the `ssr-init` install must resolve before a tag's registration is checked), documented at its call site.
