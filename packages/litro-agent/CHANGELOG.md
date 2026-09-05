# @beatzball/litro-agent

## 0.3.0

### Minor Changes

- df9971f: Add `@beatzball/litro-agent/mcp-app` — packages a Litro component as an MCP Apps `ui://` resource.

  `defineMcpApp()` declares the app; `buildMcpAppDocument()` server-renders the shell and returns one self-contained HTML5 document plus the `resources/*` descriptor (`text/html;profile=mcp-app`, nested `_meta.ui`).

  A `ui://` resource is a static, cached, data-free template — hosts prefetch it and reuse it across tool calls — so the shell is rendered with no data, and the inlined bridge fills it from `structuredContent` when `ui/notifications/tool-result` arrives after the `ui/initialize` handshake. The bridge also answers `ping` and `ui/resource-teardown`, reports its size so a flexible-height host can fit it, and exposes `window.litroMcp.callTool()`.

  The default fill step refuses scripting sinks (`on*`, `innerHTML`, `outerHTML`, `srcdoc`, `src`, `href`, `style`, …) and reports what it refused. `structuredContent` is server JSON and the host's default CSP permits inline event handlers, so a plain `Object.assign` onto the element would let a tool result execute code holding `window.litroMcp.callTool`.

  The descriptor carries `name` as well as `uri` — the base MCP `Resource` type requires both, and a server forwarding the descriptor into `resources/list` would otherwise emit an invalid entry.

  Packing fails if the document would load anything from outside itself, because the host's default CSP is `default-src 'none'` and such a fetch fails silently inside the iframe.

  Works with the Lit and FAST renderers — the packager routes through `ui()`, so it follows `LITRO_ADAPTER`. Elena is not supported, because `ui()` does not support it yet.

### Patch Changes

- a9345f4: `fileSessionStore` no longer breaks permanently when its session directory disappears, and can be pointed elsewhere with `LITRO_AGENT_SESSIONS_DIR`.

  The store creates `.litro/sessions` once and caches that result for the life of the process. If the directory was then removed — a cleanup script, a log rotation, a tmpfs reaper — every later `append` failed with `ENOENT` forever and the agent endpoint returned a 500 error event on every turn until the server restarted. It now recreates the directory and retries the append once.

  `LITRO_AGENT_SESSIONS_DIR` overrides the default directory (an explicit `fileSessionStore({ dir })` still wins). It exists for the case where two servers run against the same project directory and must not share session state.

- Updated dependencies [df9971f]
  - @beatzball/litro@0.15.0

## 0.2.2

### Patch Changes

- Updated dependencies [15c112d]
  - @beatzball/litro@0.14.0

## 0.2.1

### Patch Changes

- 83c8d5a: Remove the `source` export condition so consumers always resolve the compiled
  output. Publishing `source` pointed installed apps at TypeScript that Vite does
  not transpile inside `node_modules`, which produced an unparseable client
  bundle on Vite 8. No API change.
- Updated dependencies [83c8d5a]
  - @beatzball/litro@0.13.1

## 0.2.0

### Minor Changes

- 040f4b6: ## OpenTelemetry GenAI spans

  Add OpenTelemetry GenAI spans (v0.1 milestone, item 1).

  Agent turns now emit spans following the OpenTelemetry GenAI semantic
  conventions: `invoke_agent <agent>` per turn, `chat <model>` per provider
  round, and `execute_tool <tool>` per tool call. Tool spans are parented to
  the turn rather than to the chat round that dispatched them, so a tool run
  reads as a sibling of the model call, not a child of it.

  Telemetry is opt-in and off by default. Configure it in `agents/_config.ts`:

  ```ts
  import * as otel from "@opentelemetry/api";
  import { defineAgentConfig } from "@beatzball/litro-agent";
  import { otelTracer } from "@beatzball/litro-agent/telemetry";

  export default defineAgentConfig({
    telemetry: { tracer: otelTracer(otel) },
  });
  ```

  The package takes no dependency on `@opentelemetry/api` — the namespace is
  passed in, so the runtime always uses the same api singleton the app
  registered its SDK against. Any object matching the exported `AgentTracer`
  interface works just as well. With no tracer configured every span hook
  short-circuits to a shared no-op before building any attributes.

  Prompt, completion and tool payloads are NOT recorded unless
  `captureContent: true` is set, matching the semantic conventions' opt-in
  stance on content capture. A `UIResult`'s `html` is never recorded even
  then — the rule that keeps rendered markup out of the model channel now
  also keeps it out of traces. Span errors carry a semconv `error.type` and
  a message, never a stack.

  Also additive, in support of the above:

  - `Provider` gains an optional `info: { system, model }` used for
    `gen_ai.provider.name` / `gen_ai.request.model`; the built-in
    openai-compatible, anthropic and scripted providers populate it, and the
    attributes are omitted entirely for a provider that does not.
  - `openaiCompatible()` accepts a `system` option so an adapter pointed at a
    non-OpenAI compatible endpoint (Ollama, vLLM, ...) is not mislabelled in
    traces.
  - The turn loop now reads the `done` provider event's `usage` field, which
    was previously accepted by the type and discarded. Token counts appear
    per round on `chat` spans and summed on the `invoke_agent` span.

  No behaviour changes: the session log, the NDJSON wire stream, and the
  event sequence are byte-identical whether telemetry is on or off.

  ## `node:sqlite` session store

  Add a `node:sqlite` session store with a cross-instance turn lease (v0.1
  milestone, item 2).

  `@beatzball/litro-agent/sessions/sqlite` is an alternative to the default
  JSONL store, for apps running more than one instance:

  ```ts
  // agents/_config.ts
  import { defineAgentConfig } from "@beatzball/litro-agent";
  import { sqliteSessionStore } from "@beatzball/litro-agent/sessions/sqlite";

  export default defineAgentConfig({
    sessions: sqliteSessionStore({ path: ".litro/sessions.db" }),
  });
  ```

  What it adds over the JSONL store:

  - **Crash-safe sequence numbers.** `seq` is computed as `MAX(seq)+1` inside
    the same `BEGIN IMMEDIATE` transaction as the insert, so there is no
    in-memory counter to lose on restart and two writers can never mint the
    same seq. WAL mode lets replays and live tails read while a turn appends;
    `synchronous = FULL` keeps the durability promise that makes
    append-before-wire meaningful.
  - **A real turn lease.** `SessionStore` gains two OPTIONAL methods,
    `acquireLease` and `isLeased`. A store that implements them upgrades the
    runtime's per-process turn lock to a cross-instance one — without it, two
    app instances each pass their own local check and run concurrent turns on
    one session. The holder renews on a heartbeat; losing the lease stops the
    heartbeat but never aborts an in-flight turn, per the durability
    contract. A lease only lapses if an instance stalls or dies for a full
    TTL, at which point another instance may recover the session.
  - **A store-poll live tail.** A `GET` that reconnects while the turn is
    running on a DIFFERENT instance cannot reach that instance's in-process
    broadcast, so it polls the store instead — checking the lease before each
    drain, so a turn that ends between two polls is never truncated. Without
    this, multi-instance would be a half-claim: the lock would be honest but
    reconnects would silently return a partial log.

  Requires **Node 22.5+** (`node:sqlite`), which is why it lives behind its
  own subpath and is never in the default import graph — the package's
  `engines` range still admits Node 20, where the default JSONL store
  continues to work unchanged. Node prints its own `ExperimentalWarning` for
  `node:sqlite`.

  Known limitations, deliberate for this milestone: `DatabaseSync` is
  synchronous, so an append briefly blocks the event loop (correctness first,
  matching the JSONL store's fsync-per-append); and the default
  `fileSessionStore` implements no lease, so it stays single-instance exactly
  as before — nothing about existing deployments changes.

## 0.1.1

### Patch Changes

- e576f80: Bump `nitropack` from `^2.13.1` to `^2.13.4`, resolving Medium-severity advisories GHSA-5w89-w975-hf9q and GHSA-9phm-9p8f-hw5m.
- fbcbe21: Session store hygiene: `fileSessionStore` no longer pays a `mkdir` syscall on every single `append()` call (cached once per store instance, with retry-on-failure preserved), and its internal per-session promise-chain registry now drops an entry once it settles and nothing has chained onto it since, instead of retaining one for every distinct session id for the lifetime of the process.
- Updated dependencies [141513a]
- Updated dependencies [e576f80]
- Updated dependencies [16d2705]
  - @beatzball/litro@0.13.0

## 0.1.0

### Minor Changes

- 97e80be: Initial release: filesystem-first agent layer for Litro apps. `agents/<name>/` directories become durable session endpoints (`POST|GET /__litro/agent/:agent/:session`) streaming NDJSON session events. Tools (`defineTool`, Standard Schema input) can return `UIResult`s — server-rendered design-system components (Lit DSD or FAST) whose `data` is what the model observes while the HTML streams to the surface. Includes openai-compatible, anthropic, and scripted providers; JSONL session store with reconnect/replay (`resume(fromSeq)`); browser client with `hydrateUIResult`; Nitro build plugin following the Server Actions wiring pattern.

### Patch Changes

- Updated dependencies [97e80be]
  - @beatzball/litro@0.12.0
