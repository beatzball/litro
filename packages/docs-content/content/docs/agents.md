---
title: Agents
description: Build filesystem-first agents whose tools return server-rendered web components — the model reasons over data, humans see components.
date: 2026-07-14
---

# Agents

`@beatzball/litro-agent` is a filesystem-first agent layer for Litro apps. Agents live under `agents/<name>/` as plain files: an `agent.ts` that picks a model provider and a set of tools, an `instructions.md` inlined at build time, and a `tools/` directory. Nothing proprietary runs behind the scenes — the whole surface is a build-time scanner plus two Nitro route handlers, so an agent deploys anywhere Nitro deploys. The distinctive capability is that **a tool can return a server-rendered web component** — the same Declarative Shadow DOM elements the app's pages render, streamed over the session and hydrated in place. The model reasons over structured `data`; the human sees a component; neither channel leaks into the other.

This is the v0 surface. It ships one JSONL session store, two live providers (plus a scripted one for tests), and the Lit and FAST renderers. Skills, MCP, subagents, OpenTelemetry, and alternate session stores are specified but deferred — see [Limitations](#limitations).

## Setup

The package is not scaffolded by `create-litro` yet, so wire it by hand. The edits mirror the Server Actions pattern; the playground (`playground/`) carries the exact, tested wiring reproduced below.

### nitro.config.ts

Import the plugin, declare the two static route handlers (POST and GET share one stub), register the plugin inside `hooks['build:before']` after the actions plugin, and add the route rule:

```ts
import { resolve } from 'node:path';
import { defineNitroConfig } from 'nitropack/config';
import type { Nitro } from 'nitropack';
import agentsPlugin from '@beatzball/litro-agent/plugin';

export default defineNitroConfig({
  handlers: [
    {
      route: '/__litro/agent/:agent/:session',
      method: 'post',
      handler: resolve('./server/stubs/agent-handler.ts'),
    },
    {
      route: '/__litro/agent/:agent/:session',
      method: 'get',
      handler: resolve('./server/stubs/agent-handler.ts'),
    },
  ],
  hooks: {
    'build:before': async (nitro: Nitro) => {
      await agentsPlugin(nitro);
    },
  },
  routeRules: {
    '/__litro/agent/**': {
      headers: { 'cache-control': 'no-store' },
    },
  },
});
```

Both `handlers` entries must be declared statically. The dev server reads handler configuration before `build:before` fires, so a route pushed programmatically from the plugin would not appear during development. The plugin generates `server/stubs/agent-handler.ts` before Rollup compiles it; declaring the route statically ensures both the dev server and the production build see it. POST starts a turn; GET replays and live-tails one — they carry different methods but resolve to the same handler.

The `/__litro/agent/**` route rule marks the session stream `cache-control: no-store`. The endpoint lives outside the `/_litro/` static-asset prefix, so no carve-out of the immutable-cache rule is needed.

### package.json

Add the `"imports"` field so Node and Rollup can resolve the two package subpaths the generated handler stub imports:

```json
{
  "imports": {
    "#litro/agent-manifest": "./server/stubs/agent-manifest.ts",
    "#litro/agent-config": "./server/stubs/agent-config.ts"
  }
}
```

`#litro/agent-manifest` is the generated list of agents (one entry per `agents/*/agent.ts`, with each `instructions.md` inlined and each tool module referenced); `#litro/agent-config` re-exports `agents/_config.ts` if present, or `null` otherwise. The handler stub feeds both into `createAgentHandler`.

### LITRO_ADAPTER

The `ui()` renderer is selected by the `LITRO_ADAPTER` environment variable — `lit` by default, `fast` for FAST Element. It is the same variable that selects the page adapter, so an app already targeting one adapter needs nothing extra.

### agents/_config.ts (optional)

Runtime config is optional and takes two keys: `sessions` (see [Sessions and durability](#sessions-and-durability)) and `telemetry` (see [Telemetry](#telemetry)). The default session store is the JSONL file store and telemetry is off, so an app that wants the defaults writes no config file at all. To configure the store explicitly (or swap in a custom `SessionStore`):

```ts
import { defineAgentConfig } from '@beatzball/litro-agent';
import { fileSessionStore } from '@beatzball/litro-agent/sessions/file';

export default defineAgentConfig({
  sessions: fileSessionStore({ dir: '.litro/sessions' }), // this IS the default; the whole file is optional
});
```

### .gitignore

The scanner writes `server/stubs/` on every build and dev restart — gitignore it. Session logs land under `.litro/`; that directory holds conversation data and must be gitignored too (the playground's repo-root `.gitignore` already ignores both `playground*/server/stubs/` and `.litro/`).

## Directory convention

```
agents/
  demo/
    agent.ts            defineAgent + optional `export const access`
    instructions.md     inlined into the manifest at build time
    tools/
      get-weather.ts    default-exports defineTool; tool name = filename
```

The scanner globs `agents/*/agent.ts`. A tool's name is its filename without extension (`tools/get-weather.ts` → `get-weather`). Directories whose name starts with `_` are never scanned as agents — `agents/_shared/` and the `agents/_config.ts` runtime-config file are both excluded. An agent directory with no `instructions.md` inlines an empty string; one with no `tools/` directory simply has no filesystem-discovered tools.

## defineAgent and defineAccess

`agent.ts` default-exports a `defineAgent` call. `model` is a provider; `instructions` is either a relative path the build inlines (`'./instructions.md'`) or a literal string. Tools are discovered from the agent's `tools/` directory only (filename = tool name) — there is no explicit `tools` array on `defineAgent`; passing a non-empty one throws a "deferred" error at definition time.

```ts
import { defineAgent, defineAccess } from '@beatzball/litro-agent';
import { openaiCompatible } from '@beatzball/litro-agent/providers/openai-compatible';
import { createError } from 'h3';

export default defineAgent({
  model: openaiCompatible({ baseURL: process.env.LLM_URL!, model: 'qwen3' }),
  instructions: './instructions.md',
});

export const access = defineAccess((event) => {
  if (!event.context.user) throw createError({ statusCode: 401 });
});
```

`access` is an optional named export. It runs on every request to the agent — both POST and GET — after the CSRF gate stack and before the turn. It receives the live `H3Event`; throw an h3 `createError` to reject. That error propagates unmodified (the runtime only reshapes its own `AgentError` instances), so the status code you choose is the status the client sees.

The `tools`, `skills`, `extends`, `mcp`, and `subagents` config keys are reserved and typed, but a non-empty value for any of them throws a "deferred past v0" error at definition time. They exist so the deferred features (see [Limitations](#limitations)) can land without a breaking change.

## Tools

A tool default-exports a `defineTool` call. An `input` schema is **required** — every tool is model-callable and its input is hostile, so validation is mandatory (unlike Server Actions, `defineTool` with no `input` throws immediately). The `input` field accepts any [Standard Schema v1](https://github.com/standard-schema/standard-schema) validator; `StandardSchemaV1` is re-exported from `@beatzball/litro-agent` for hand-rolled validators.

```ts
import { defineTool, type StandardSchemaV1 } from '@beatzball/litro-agent';
import { ui } from '@beatzball/litro-agent/ui';
import { html } from 'lit';
import { DemoWeatherCard } from '../../../components/demo-weather-card.js';
void DemoWeatherCard; // keep the @customElement side effect from being tree-shaken

interface GetWeatherInput { city: string }

const getWeatherSchema: StandardSchemaV1<unknown, GetWeatherInput> = {
  '~standard': {
    version: 1,
    vendor: 'my-app',
    validate(value) {
      const v = value as Record<string, unknown> | null;
      if (!v || typeof v !== 'object') return { issues: [{ message: 'Expected an object' }] };
      if (typeof v.city !== 'string' || v.city.trim() === '') {
        return { issues: [{ message: 'city is required' }] };
      }
      return { value: { city: v.city.trim() } };
    },
  },
};

export default defineTool({
  // Name the argument in the description: in v0 the provider receives a
  // permissive object schema, so the description carries the parameter
  // contract (see "Tool calling and model support" below).
  description: 'Get the current weather for a city. Argument: { city: string } — the city name, e.g. "Lisbon".',
  input: getWeatherSchema,
  async execute({ city }, ctx) {
    const data = { city, tempC: 21, summary: 'sunny' };
    return ui(
      html`<demo-weather-card .city=${city} .tempC=${data.tempC} .summary=${data.summary}></demo-weather-card>`,
      { data },
    );
  },
});
```

The input is validated before `execute` runs; a validation failure becomes a tool error fed back to the model. `execute` receives the validated input and a `ctx` of `{ event, session }` — `event` is the live `H3Event` for the request, and `session` is `{ id, seq }` (the session id plus the seq of the tool-call event). Because a tool only ever runs inside the POST/GET handler, `ctx.event` is always the live request event in v0 (the type is `H3Event | undefined` for forward-compatibility, but it is never actually undefined here).

`execute` can return one of three shapes:

- **A plain value** — appended as a `tool-result` event; the model observes it (serialized to JSON for the provider).
- **A `UIResult`** (from `ui()`) — appended as a `ui` event; the model observes only `UIResult.data`, never the HTML. See [UI tools](#ui-tools).
- **An async generator** — each `yield` appends a `tool-progress` event; the generator's return value becomes the `tool-result`. Same async-iterable convention as streaming Server Actions.

Return a `UIResult` **directly** from `execute` — a `UIResult` buried inside a plain object or array is a loud tool error, not a rendered component, because its HTML would otherwise leak into the model channel.

### Tool calling and model support

Two things govern whether a tool actually gets called, and they are independent:

- **The model must support tool calling.** Tools are invoked by the model, not by Litro. A provider or model without tool-calling support will stream a normal reply and never emit a `tool-call` — so you get prose and no tool result, and that is the model, not the framework. Most hosted models support it; among local runtimes only some models do (check your runtime's tool-calling support before expecting a tool to fire). A stronger description cannot make a non-tool model call a tool.
- **In v0, the tool `description` carries the parameter contract.** The framework hands the provider a permissive object schema rather than a generated JSON Schema (deeper conversion is a [v0.1 work item](#limitations)), so the model relies on the `description` to know what arguments to pass. Name the arguments explicitly:

  ```ts
  // Weak — a capable model may still guess the shape, but smaller models are unreliable:
  description: 'Looks up the current weather for a city.'
  // Strong — states the argument, so tool-capable models call it reliably:
  description: 'Get the current weather for a city. Argument: { city: string } — the city name.'
  ```

  Reinforce it in the agent's `instructions.md` ("Always call `get-weather` when asked about weather; pass the city as `{ city }`."). This reliability lever only helps among tool-capable models — it is not a substitute for the first point.

## UI tools

`ui()` server-renders a framework template to a `UIResult` and picks the renderer from `LITRO_ADAPTER` at call time (importing `@beatzball/litro-agent/ui` never drags SSR machinery into a graph that doesn't use it). The shape:

```ts
interface UIResult {
  type: 'ui';
  html: string;                                   // Declarative Shadow DOM
  data?: unknown;                                 // what the model observes
  hydrate?: { modules?: string[]; props?: Record<string, unknown> };
}
```

**The core rule: the model sees `data`, never `html`.** The turn loop feeds `UIResult.data` back to the provider and streams the full `UIResult` (HTML included) to the browser as a `ui` event. The HTML never enters a chat message. This is enforced in the loop, not left to convention. It follows that you must bind data through typed props and attributes — passing model- or user-supplied strings through `unsafeHTML` (or otherwise into raw markup) is a rule violation, not a caveat.

Per-adapter notes:

- **Lit** (`LITRO_ADAPTER=lit`, the default): pass a Lit `html` `TemplateResult`. Property bindings (`.city=${city}`) render through `@lit-labs/ssr` to Declarative Shadow DOM.
- **FAST** (`LITRO_ADAPTER=fast`): pass an HTML **string** template with **kebab-case attributes** (HTML parsers lowercase attribute names). `@microsoft/fast-ssr` renders it to DSD. Unlike the Lit tagged-template path, which escapes interpolations through typed bindings, this FAST string template is **not** auto-escaped — never interpolate untrusted or model-supplied strings directly into it; pass them as attribute values that the component renders through its own typed properties.

In both cases **the component must be registered server-side before `ui()` renders it** — import the component module (and reference an export, as with `void DemoWeatherCard` above, so Rollup does not tree-shake the side-effect-only import) so its `@customElement` definition runs. The FAST renderer additionally guards this explicitly: an unregistered tag would otherwise silently round-trip as a plain, unrendered element, so it throws instead.

`hydrate` is optional. `hydrate.modules` is a list of module specifiers the client dynamically imports to upgrade the element; when the page already loads the design system, elements upgrade automatically and only `hydrate.props` need re-binding. See [Client](#client) for how `hydrateUIResult` consumes it.

## Providers

A provider is a thin `fetch`-based streaming adapter — no vendor SDK. Two speak live wire formats; a third is deterministic for tests. **Put API keys in the environment, never in the config file.**

### openai-compatible

```ts
import { openaiCompatible } from '@beatzball/litro-agent/providers/openai-compatible';

const model = openaiCompatible({
  baseURL: 'http://localhost:11434/v1',   // any server speaking the chat/completions wire format
  model: 'qwen3',
  // apiKey?: falls back to process.env.OPENAI_API_KEY; the auth header is
  //          only sent when a key resolves, so local runtimes need none.
});
```

Streams over `${baseURL}/chat/completions`. Works against any endpoint speaking that wire format, hosted or local. `apiKey` falls back to `OPENAI_API_KEY`; an optional `headers` map is merged into the request.

### anthropic

```ts
import { anthropic } from '@beatzball/litro-agent/providers/anthropic';

const model = anthropic({
  model: 'claude-sonnet-4-5',
  // apiKey?:   falls back to process.env.ANTHROPIC_API_KEY (throws if neither is set)
  // baseURL?:  defaults to https://api.anthropic.com
  // maxTokens?: defaults to 4096
});
```

Streams over `${baseURL}/v1/messages`. `apiKey` falls back to `ANTHROPIC_API_KEY`; a missing key throws lazily on the first stream.

### scripted

For tests and demos with no network and no keys. The script is a plain function of the request and a 1-based per-instance turn counter; it returns the events to yield. Branch on the shape of the request (the last message's role) rather than the turn counter when you need a per-request decision, since the counter is per-provider-instance:

```ts
import { scriptedProvider, type ScriptedEvent } from '@beatzball/litro-agent/providers/scripted';

const model = scriptedProvider((req) => {
  const last = req.messages[req.messages.length - 1];
  if (last?.role === 'user' && /weather/i.test(String(last.content))) {
    return [
      { type: 'text-delta', text: 'Checking the weather' },
      { type: 'tool-call', id: 'call_1', name: 'get-weather', input: { city: 'Lisbon' } },
      { type: 'done' },
    ];
  }
  return [{ type: 'text-delta', text: 'How can I help?' }, { type: 'done' }];
});
```

A `{ type: 'delay', ms }` pseudo-event is script-only — the provider awaits it to simulate latency and never yields it.

## Sessions and durability

A session is an append-only JSONL log at `.litro/sessions/<id>.jsonl`, one `SessionEvent` per line with a monotonic `seq`. Session ids are caller-chosen opaque strings validated as `[A-Za-z0-9_-]{1,64}` — they become filenames, so path traversal is rejected at the handler.

The directory is `.litro/sessions` relative to the server's working directory. Override it with `fileSessionStore({ dir })`, or — when you cannot touch the config, such as a second server started against the same project — with the `LITRO_AGENT_SESSIONS_DIR` environment variable. Two servers sharing one project directory need separate session directories: they write to the same files otherwise.

**The keystone ordering rule:** every event is appended to the store *before* it is written to the HTTP stream. The log is the source of truth; the response is a tail of it. Two consequences fall out for free:

- **Turns survive client disconnect.** A POST client that drops mid-turn does not abort the turn — the runtime keeps appending to the store and running to completion. The persisted log stays complete.
- **Reconnect from a seq.** A fresh GET (or the client's `resume`) replays the stored log from `?from=<seq>` and, if a turn is still in flight, live-tails it until `turn-end`.

A concurrent POST for the same agent/session returns 409. **How far that guarantee reaches depends on the store you pick:**

- **`fileSessionStore` (the default)** — the turn lock is in-process, one Node process. Two instances behind a load balancer would each pass their own local check and run concurrent turns on one session.
- **`sqliteSessionStore`** — adds a store-level lease, so the lock holds across instances. See [Multi-instance sessions](#multi-instance-sessions).

### Multi-instance sessions

`sqliteSessionStore` is an alternative to the default JSONL store, built for deployments running more than one instance against shared storage.

```ts
// agents/_config.ts
import { defineAgentConfig } from '@beatzball/litro-agent';
import { sqliteSessionStore } from '@beatzball/litro-agent/sessions/sqlite';

export default defineAgentConfig({
  sessions: sqliteSessionStore({ path: '.litro/sessions.db' }),
});
```

It creates its parent directory if it does not exist, so the path above works on a fresh clone even though `.litro/` is gitignored.

**Requires Node 22.5+**, since `node:sqlite` does not exist before that. It lives behind its own subpath and is never in the package's default import graph, so Node 20 users are unaffected and keep the JSONL store. Node prints an `ExperimentalWarning` for `node:sqlite`; that is Node's notice, not this package's.

What it gives you over the default:

- **Crash-safe sequence numbers.** `seq` is computed as `MAX(seq)+1` inside the same transaction as the insert, so there is no in-memory counter to lose on restart and no way for two writers to mint the same seq.
- **A cross-instance turn lease**, renewed on a heartbeat for the life of a turn and released in a `finally`.
- **A live tail that still works across instances.** A GET reconnecting while the turn runs on a *different* instance cannot reach that instance's in-process broadcast, so it polls the store until the turn ends.

**A lost lease does not abort the turn.** If an instance stalls past the lease TTL and another takes the lease over, the first stops renewing but runs its turn to completion. Aborting mid-turn would break the append-before-wire rule above, which is what makes the persisted log trustworthy in the first place.

One deliberate trade: `node:sqlite`'s `DatabaseSync` is synchronous, so each append briefly blocks the event loop — the same call the JSONL store makes with an fsync per append. An async driver is a later addition.

## Telemetry

Agent turns can emit OpenTelemetry spans following the [GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/). **Telemetry is off unless you supply a tracer**, and when it is off every hook short-circuits to a shared no-op — no allocation, no attribute building.

```ts
// agents/_config.ts
import * as otel from '@opentelemetry/api';
import { defineAgentConfig } from '@beatzball/litro-agent';
import { otelTracer } from '@beatzball/litro-agent/telemetry';

export default defineAgentConfig({
  telemetry: { tracer: otelTracer(otel) },
});
```

**Your app brings OpenTelemetry; this package does not depend on it.** You pass the `@opentelemetry/api` namespace in rather than the package importing it. That guarantees the runtime uses the same api singleton your SDK registered against — a duplicated copy is the classic reason spans silently vanish — and it means no peer dependency to resolve and no dynamic import in a server bundle. Any object matching the exported `AgentTracer` interface works, so a custom tracer needs no OpenTelemetry at all.

Three spans per turn:

| Span | When | Notable attributes |
|---|---|---|
| `invoke_agent <agent>` | once per turn | `gen_ai.agent.name`, `gen_ai.conversation.id` (the session id), `litro.agent.turn.rounds`, summed token usage |
| `chat <model>` | once per provider round | `gen_ai.provider.name`, `gen_ai.request.model`, `gen_ai.usage.input_tokens` / `output_tokens`, `litro.agent.round` |
| `execute_tool <tool>` | once per tool call | `gen_ai.tool.name`, `gen_ai.tool.call.id`, `litro.agent.tool.ui` |

Tool spans are parented to the **turn**, not to the chat round that dispatched them — a tool run is a sibling of the model call, not a child of it.

### Content capture

Prompt and completion text is **not** recorded by default, per the semantic conventions' opt-in stance on content capture:

```ts
telemetry: { tracer: otelTracer(otel), captureContent: true, maxContentLength: 8192 }
```

**Even with capture on, a UI tool's rendered `html` is never recorded** — only its `data`. That is the same rule that keeps html out of the model's view, applied to traces: the html is stripped at the top level, when nested, and in the tool result fed back into the next round's captured messages.

Errors carry the semantic-convention `error.type` and a message, never a stack.

## Client

`@beatzball/litro-agent/client` is browser-safe — it imports only the isomorphic NDJSON wire protocol and type-only shapes, never H3 or any Node built-in.

```ts
import { agentSession, hydrateUIResult } from '@beatzball/litro-agent/client';

for await (const ev of agentSession('demo', sessionId).send('what is the weather in lisbon?')) {
  if (ev.kind === 'text-delta') {
    // (ev.payload as { text: string }).text
  } else if (ev.kind === 'ui') {
    await hydrateUIResult(uiSlotEl, ev.payload as Parameters<typeof hydrateUIResult>[1]);
  }
}
```

`agentSession(agent, id)` returns `{ send, resume }`. `send(text)` starts a turn (POST) and yields the turn's `SessionEvent`s. `resume(fromSeq = 0)` replays from `fromSeq` and live-tails an in-flight turn (GET `?from=`), retrying once with backoff on a mid-stream network error.

`hydrateUIResult(host, uiResult)` injects the DSD into `host`, dynamically imports any `hydrate.modules`, and re-binds `hydrate.props` onto the first child. It uses `setHTMLUnsafe` to parse the `<template shadowrootmode>` markup where available and falls back to `innerHTML` in environments without it (jsdom, pre-DSD browsers), where the nested shadow trees simply do not attach.

## Security

Both endpoints run the full Server Actions CSRF gate stack, then the per-agent `access` guard:

- **`Sec-Fetch-Site`** — if present, must be `same-origin` or `none`.
- **`Origin` / host** — if `Origin` is present, its host must match the request host (the first comma-separated `x-forwarded-host` value is preferred over `Host` for proxied deployments).
- **`x-litro-agent: 1`** — required on **POST only**. GET is a read and carries no custom header, but still passes the site and origin gates plus the `access` guard.

Any gate failure returns 403. Beyond the gates:

- **Tool inputs are hostile.** They are model-generated and, transitively, user-influenced. Standard Schema validation before `execute` is mandatory — that is why `defineTool` requires an `input` schema.
- **Session privacy is the guard's job.** A session is only as private as the `access` guard makes it. There is no built-in ownership check; if a session must belong to a user, enforce it in `access`.
- **`UIResult.html` renders only from typed template bindings.** Never `unsafeHTML` a model- or user-supplied string. The loop never feeds HTML to the provider.
- **`.litro/` is sensitive.** Session files contain conversation data — gitignore the directory and treat it as private.
- **Only stacks are dev-only.** Error payloads follow the actions dev-only-stack rule: `stack` is stripped when not in dev, but `name` and `message` are always sent — an uncaught, non-`AgentError` throw's raw message reaches the client even in production. Throw `AgentError` with a curated message for anything user-facing; don't rely on production hiding a raw throw's message.

## Limitations

The following are specified but deferred (in priority order, mirroring the design spec). OpenTelemetry spans and the `node:sqlite` store were on this list and shipped in 0.2.0 — see [Telemetry](#telemetry) and [Multi-instance sessions](#multi-instance-sessions).

1. **Skills.** The sharing contract is fully specified (a skill is a standard Agent Skill folder; three scope levels — global `skills/`, shared `agents/_shared/skills/`, local `agents/<name>/skills/` — resolved by skill name with local-first precedence; `defineAgentPreset` bundles; npm/registry distribution; a CEM-backed design-system skillset). v0 ships only the reserved `skills`/`extends` config keys and the `_`-prefix scanner exclusion so the hierarchy lands without a breaking change.
2. **MCP client** (`agents/<name>/mcp/`).
3. **Standard-Schema → JSON-Schema conversion depth.** v0 hands providers a permissive object schema and leans on the tool `description` for the contract; deeper conversion is a v0.1 work item.
4. **Elena `UIResult` renderer** (light-DOM, no hydration).
5. **Subagents, additional surfaces, scheduled runs, and eval suites.**
6. **`create-litro` template wiring** — until then, wire agents by hand per [Setup](#setup).

`ui()` throws for any adapter other than `lit` or `fast` in v0.
