# litro-agent

Filesystem-first AI agents for [Litro](https://github.com/beatzball/litro), with tools that can return server-rendered components.

- **A directory is an agent** — `agents/<name>/agent.ts` becomes a durable endpoint; files in `tools/` become its tools
- **Durable by construction** — every event is written to the session log *before* it reaches the HTTP stream, so turns survive a client disconnect and a reconnect can replay from any point
- **Tools can return UI** — a tool returns both `data` for the model and server-rendered `html` for the page. The model never sees the html
- **Streaming** — turns stream as NDJSON `SessionEvent`s over a single endpoint
- **No SDK dependency** — providers are thin adapters this package owns; OpenTelemetry, when used, is passed in by your app rather than depended on

Requires `@beatzball/litro`. Agents are wired into the Litro server by a Nitro plugin, so this package is not usable standalone.

---

## Installation

```bash
npm install @beatzball/litro-agent
# or
pnpm add @beatzball/litro-agent
```

Wiring an app takes a few edits to `nitro.config.ts`, `package.json`, and `.gitignore`. The [Agents guide](https://litro.dev/docs/agents) walks through them; `create-litro` template wiring is not in yet.

---

## Directory convention

```
agents/
  _config.ts            <- optional runtime config (sessions, telemetry)
  demo/
    agent.ts            <- default export: defineAgent({ ... })
    instructions.md     <- system prompt
    tools/
      get-weather.ts    <- filename is the tool name
```

Each agent becomes one endpoint:

```
POST /__litro/agent/<agent>/<session>    run a turn, stream the events
GET  /__litro/agent/<agent>/<session>    replay from ?from=<seq>, then live-tail
```

---

## Defining an agent

```ts
// agents/demo/agent.ts
import { defineAgent } from '@beatzball/litro-agent';
import { anthropic } from '@beatzball/litro-agent/providers/anthropic';

export default defineAgent({
  model: anthropic({ model: 'claude-sonnet-5' }),
  instructions: './instructions.md',
});
```

Tools declare an input schema using any [Standard Schema](https://standardschema.dev) validator. The schema is required — it is what the model is handed and what the input is validated against before `execute` runs.

```ts
// agents/demo/tools/get-weather.ts
import { defineTool } from '@beatzball/litro-agent';

export default defineTool({
  description: 'Look up the current weather for a city',
  input: citySchema,
  async execute({ city }) {
    return { city, tempC: 21, summary: 'sunny' };
  },
});
```

---

## UI tools

A tool can return a rendered component instead of plain data. `ui()` server-renders it and returns both halves:

```ts
import { defineTool } from '@beatzball/litro-agent';
import { ui } from '@beatzball/litro-agent/ui';
import { html } from 'lit';
import { WeatherCard } from '../../../components/weather-card.js';

void WeatherCard; // named import + void: bare side-effect imports get tree-shaken

export default defineTool({
  description: 'Show the weather as a card',
  input: citySchema,
  async execute({ city }) {
    const tempC = 21;
    const summary = 'sunny';
    return ui(html`<weather-card .city=${city} .tempC=${tempC}></weather-card>`, {
      data: { city, tempC, summary },
    });
  },
});
```

**The model observes `data`; the `html` streams to the page and is never shown to the model.** That separation is enforced in the runtime — for direct returns, generator returns, and nested results alike — and it holds in traces too.

The renderer follows `LITRO_ADAPTER`: Lit (Declarative Shadow DOM via `@lit-labs/ssr`) or FAST. The component must be registered server-side. Elena is not supported yet.

---

## Providers

| Import | Use |
|---|---|
| `@beatzball/litro-agent/providers/anthropic` | Anthropic models |
| `@beatzball/litro-agent/providers/openai-compatible` | OpenAI, or any compatible endpoint — Ollama, LM Studio, vLLM |
| `@beatzball/litro-agent/providers/scripted` | Deterministic canned responses for tests and demos |

API keys are read from the environment only. `openaiCompatible` takes an optional `system` name so a local endpoint is not mislabelled as OpenAI in telemetry.

---

## Sessions

A session is an append-only log. The default store writes JSONL under `.litro/sessions/`; `.litro/` holds conversation data and must be gitignored. Point the default store somewhere else with `fileSessionStore({ dir })`, or with the `LITRO_AGENT_SESSIONS_DIR` environment variable when you cannot reach the config — two servers sharing one project directory each need their own.

`sqliteSessionStore` (from `@beatzball/litro-agent/sessions/sqlite`) is the alternative for deployments running more than one instance against shared storage. It adds crash-safe sequence numbers and a cross-instance turn lease. It requires **Node 22.5+**, which is why it sits behind its own subpath — Node 20 users are unaffected and keep the JSONL store.

---

## Telemetry

Agent turns can emit OpenTelemetry spans following the GenAI semantic conventions: `invoke_agent` per turn, `chat` per provider round, `execute_tool` per tool call.

**Off unless you supply a tracer**, and your app brings OpenTelemetry rather than this package depending on it:

```ts
// agents/_config.ts
import * as otel from '@opentelemetry/api';
import { defineAgentConfig } from '@beatzball/litro-agent';
import { otelTracer } from '@beatzball/litro-agent/telemetry';

export default defineAgentConfig({
  telemetry: { tracer: otelTracer(otel) },
});
```

Prompt and completion content is not recorded by default. Even with capture enabled, a UI tool's rendered html is never recorded — only its `data`.

---

## Client

`@beatzball/litro-agent/client` is browser-safe — it imports the isomorphic wire protocol and type-only shapes, never H3 or a Node built-in.

```ts
import { agentSession, hydrateUIResult } from '@beatzball/litro-agent/client';
```

---

## Documentation

Full guide, security model, and the deferred-feature list: **[litro.dev/docs/agents](https://litro.dev/docs/agents)**

## License

Apache-2.0
