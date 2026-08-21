---
'@beatzball/litro-agent': minor
---

## OpenTelemetry GenAI spans

Add OpenTelemetry GenAI spans (v0.1 milestone, item 1).

Agent turns now emit spans following the OpenTelemetry GenAI semantic
conventions: `invoke_agent <agent>` per turn, `chat <model>` per provider
round, and `execute_tool <tool>` per tool call. Tool spans are parented to
the turn rather than to the chat round that dispatched them, so a tool run
reads as a sibling of the model call, not a child of it.

Telemetry is opt-in and off by default. Configure it in `agents/_config.ts`:

```ts
import * as otel from '@opentelemetry/api';
import { defineAgentConfig } from '@beatzball/litro-agent';
import { otelTracer } from '@beatzball/litro-agent/telemetry';

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
import { defineAgentConfig } from '@beatzball/litro-agent';
import { sqliteSessionStore } from '@beatzball/litro-agent/sessions/sqlite';

export default defineAgentConfig({
  sessions: sqliteSessionStore({ path: '.litro/sessions.db' }),
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
