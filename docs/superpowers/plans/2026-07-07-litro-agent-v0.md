# @beatzball/litro-agent v0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `@beatzball/litro-agent` v0 per `docs/superpowers/specs/2026-07-07-litro-agent-v0-design.md`: one agent + one UI tool + web surface, data/UI separation, stream + resume, and FAST as the second component lib.

**Architecture:** New workspace package wired via the actions pattern (build:before scanner → generated manifest/handler stubs → static handler entries). The turn loop appends every `SessionEvent` to a `SessionStore` BEFORE writing it to the NDJSON response (append-before-wire is the keystone). `ui()` renders design-system components server-side (Lit DSD via `@lit-labs/ssr`, FAST via the `templateRenderer` singleton) into a `UIResult` whose `data` — never its `html` — is what the model observes.

**Tech Stack:** TypeScript (NodeNext), h3 1.15, nitropack 2.13, seroval NDJSON protocol (via new `@beatzball/litro/stream` subpath), `@lit-labs/ssr` 3.3.1, `@microsoft/fast-ssr` 1.0.0-beta.39, vitest (node env; jsdom per-file), Playwright.

## Global Constraints

- **Spec wins:** `docs/superpowers/specs/2026-07-07-litro-agent-v0-design.md`. RFC file is source material only.
- **No competitor product names** in any committed content (docs, specs, comments, commit messages).
- Endpoints live at `/__litro/agent/:agent/:session` — double underscore; `/_litro/` is serve-placeholder territory.
- seroval JSON-data modes only, via `@beatzball/litro/stream` (`createStreamEncoder`/`createStreamDecoder`/`StreamChunk`/`isAsyncIterable`) — never seroval's code-eval APIs.
- `client.ts` is browser-safe: imports only `@beatzball/litro/stream` and package-local types/error modules. No h3, no node:*, no providers.
- Import specifiers use `.js` extensions (NodeNext). Package export conditions ordered `source`, `types`, `import`.
- Generated files inside Nitro's watched srcDir use content-compared writes (reload-loop hazard).
- `defineTool` REQUIRES `input` (Standard Schema v1) — unlike actions, tools are always model-callable.
- The model observes `UIResult.data` only; `html` never enters provider messages (enforced in the loop, asserted in tests).
- Session ids match `/^[A-Za-z0-9_-]{1,64}$/` (they become filenames).
- Node floor: root engines `^20.19.0 || >=22.12.0`; no APIs above it (no `node:sqlite`).
- No stacks in production payloads (`process.dev` gate, same as actions).
- One changeset per package; only published packages get changesets.
- No personal identifiers in committed content; grep before push. No emojis.
- Playground/e2e run against `packages/*/dist` — build `@beatzball/litro` AND `@beatzball/litro-agent` after source changes, before e2e.
- Commit after every task; no push/PR until the final task.

## Design decisions this plan pins (spec deferred to plan)

1. **Provider-neutral message shape** (`providers/types.ts`): `ChatMessage = { role: 'system'|'user'|'assistant'|'tool'; content: string; toolCalls?: ToolCallPart[]; toolCallId?: string }` with `ToolCallPart = { id: string; name: string; input: unknown }`. Each adapter maps this to its wire format; the loop never sees vendor shapes.
2. **`./providers/scripted` is a real subpath**, not a test fixture: a deterministic provider (`scriptedProvider(script: (req) => ProviderEvent[])`) used by unit tests, e2e, and offline demos. Justification: e2e must be deterministic without API keys.
3. **`ui()` resolver**: `@beatzball/litro-agent/ui` exports `async ui(template, opts)` that lazily imports `./lit.js` or `./fast.js` by `process.env.LITRO_ADAPTER` (default `lit`); each lib module also exports its `ui()` directly for explicit use. FAST's `ui()` accepts a template STRING (attribute interpolation only; rich props ride `hydrate.props`) and prefers `globalThis.__litro_fast_template_renderer__` (page pipeline already initialized), falling back to importing `@beatzball/litro/adapter/fast/ssr-init` (Task 1 verifies).
4. **POST body** is `serializeValue({ text })` (seroval JSON), header gate `x-litro-agent: 1` on POST; GET has no header gate (read path) but keeps Origin/`x-forwarded-host`/`Sec-Fetch-Site` gates. Gate logic is a small local util mirroring the actions handler (framework does not export its gates).
5. **Live tail**: in-process `Map<string, Set<(ev) => void>>` broadcast keyed `agent/session`. If GET finds no active turn in this process, it closes after replay (spec §10 Q3's sanctioned degrade; Task 1 records actual dev behavior).
6. **New-package versioning**: `"version": "0.0.0"` + a minor changeset → first publish 0.1.0.
7. **Root `test` script** gains litro-agent: `pnpm --filter @beatzball/litro test && pnpm --filter @beatzball/litro-agent test` (root test today only runs framework — CI runs root test).
8. **`.litro/` gets a root `.gitignore` entry** (session store writes `.litro/sessions/`; nothing ignores it today).

---

### Task 1: Spike — answer spec §10 empirically (no production code)

**Files:**
- Modify: `docs/superpowers/specs/2026-07-07-litro-agent-v0-design.md` (append answers to §10)
- Scratch files under `playground-fast/` and `playground/` created and DELETED within the task.

**Interfaces:**
- Produces: three recorded answers in spec §10 that Tasks 8, 10, 11 consume: (Q1) the exact working recipe for a detached FAST fragment render; (Q2) confirmation the scanner-on-dev-reload pattern holds for agents dirs; (Q3) whether module state is shared between two handler invocations in `litro dev` (decides if live-tail works in dev or degrades to close-after-replay).

- [ ] **Step 1: Q1 — FAST detached fragment render.** In `playground-fast/`, create a throwaway server route `server/api/spike-fast-ui.ts`:

```ts
import { defineEventHandler } from 'h3';

export default defineEventHandler(async () => {
  // Case A: page pipeline already initialized the singleton?
  const fromGlobal = (globalThis as Record<string, unknown>).__litro_fast_template_renderer__;
  // Case B: standalone init via the exposed subpath
  const { templateRenderer } = await import('@beatzball/litro/adapter/fast/ssr-init');
  const chunks: string[] = [];
  for await (const c of templateRenderer.render('<about-page></about-page>')) {
    if (typeof c === 'string') chunks.push(c);
  }
  return { hasGlobal: Boolean(fromGlobal), html: chunks.join(''), dsd: chunks.join('').includes('shadowrootmode') };
});
```

Run `pnpm --filter @beatzball/litro build && cd playground-fast && node ../packages/framework/dist/cli/index.js dev --port 3050`, then `curl -s localhost:3050/api/spike-fast-ui`. Record: does Case B render DSD standalone? Is the global set before any page render? Does double-init (`ssr-init` import after the preamble already ran fastSSR()) throw or work? Try also rendering a component tag that was imported by a page module vs one never imported (expect: unregistered tag renders as plain element — note it).

- [ ] **Step 2: Q2 — scanner freshness on dev reload.** Confirm by reading `packages/framework/src/plugins/actions.ts` (`dev:reload` hook + `nitro.options.virtual` regeneration + content-compared `writeStub`) that the identical pattern applies to an `agents/` scanner that ALSO inlines `instructions.md` content into the virtual module: the only new failure mode would be an unconditional stub write. Record: "same pattern, instructions content participates in the content comparison" (or contrary evidence).

- [ ] **Step 3: Q3 — dev module-state sharing.** In `playground/`, create throwaway `server/api/spike-state.ts`:

```ts
import { defineEventHandler } from 'h3';
let counter = 0;
export default defineEventHandler(() => ({ counter: ++counter }));
```

Run the dev server, curl it three times, record whether the counter increments across requests (shared module state in the dev worker) or resets. Then `pnpm --filter @beatzball/litro build` is NOT needed — but ALSO verify prod: `cd playground && node ../packages/framework/dist/cli/index.js build && node .output/server/index.mjs` (port via PORT env), curl three times, record. Expected: prod shares state; dev result decides live-tail-in-dev.

- [ ] **Step 4: Record answers + clean up.** Append a `### Spike answers (2026-07-07)` block under spec §10 with the three findings, each 2-4 sentences with the observed outputs. Delete both scratch files. Kill all spawned servers.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-07-07-litro-agent-v0-design.md
git commit -m "docs(agent): record spike answers for spec section 10"
```

---

### Task 2: Package scaffold + repo wiring

**Files:**
- Create: `packages/litro-agent/package.json`, `packages/litro-agent/tsconfig.json`, `packages/litro-agent/vitest.config.ts`, `packages/litro-agent/src/errors.ts`, `packages/litro-agent/src/errors.test.ts`
- Modify: `tsconfig.json` (root — add reference), `package.json` (root — extend `test` script), `.gitignore` (root — `.litro/`)

**Interfaces:**
- Produces: buildable, testable empty package `@beatzball/litro-agent@0.0.0`; `AgentError` class (message, status, cause) used by handler/loop/client tasks; `errorPayload(err, dev)` → `{ name, message, status, stack? }`.

- [ ] **Step 1: Write the failing test** — `packages/litro-agent/src/errors.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { AgentError, errorPayload } from './errors.js';

describe('AgentError', () => {
  it('carries status and serializes without stack in prod mode', () => {
    const err = new AgentError('nope', { status: 409 });
    expect(err.status).toBe(409);
    const payload = errorPayload(err, false);
    expect(payload).toEqual({ name: 'AgentError', message: 'nope', status: 409 });
  });

  it('includes stack only in dev mode and defaults unknown errors to 500', () => {
    const payload = errorPayload(new Error('boom'), true);
    expect(payload.status).toBe(500);
    expect(payload.stack).toBeTruthy();
    expect(errorPayload('weird', false)).toEqual({ name: 'Error', message: 'weird', status: 500 });
  });
});
```

- [ ] **Step 2: Create the package files.**

`packages/litro-agent/package.json`:

```json
{
  "name": "@beatzball/litro-agent",
  "version": "0.0.0",
  "type": "module",
  "types": "./dist/index.d.ts",
  "description": "Filesystem-first agent layer for Litro apps: tools that return server-rendered web components, durable NDJSON session streams, pluggable model providers. Deploys anywhere Nitro deploys.",
  "license": "Apache-2.0",
  "repository": { "type": "git", "url": "https://github.com/beatzball/litro.git", "directory": "packages/litro-agent" },
  "publishConfig": { "access": "public" },
  "keywords": ["agents", "llm", "web-components", "lit", "fast-element", "ssr", "declarative-shadow-dom", "nitro", "litro"],
  "exports": {
    ".": { "source": "./src/index.ts", "types": "./dist/index.d.ts", "import": "./dist/index.js" },
    "./ui": { "source": "./src/ui/index.ts", "types": "./dist/ui/index.d.ts", "import": "./dist/ui/index.js" },
    "./providers/openai-compatible": { "source": "./src/providers/openai-compatible.ts", "types": "./dist/providers/openai-compatible.d.ts", "import": "./dist/providers/openai-compatible.js" },
    "./providers/anthropic": { "source": "./src/providers/anthropic.ts", "types": "./dist/providers/anthropic.d.ts", "import": "./dist/providers/anthropic.js" },
    "./providers/scripted": { "source": "./src/providers/scripted.ts", "types": "./dist/providers/scripted.d.ts", "import": "./dist/providers/scripted.js" },
    "./sessions/file": { "source": "./src/sessions/file.ts", "types": "./dist/sessions/file.d.ts", "import": "./dist/sessions/file.js" },
    "./handler": { "source": "./src/runtime/handler.ts", "types": "./dist/runtime/handler.d.ts", "import": "./dist/runtime/handler.js" },
    "./plugin": { "source": "./src/plugin.ts", "types": "./dist/plugin.d.ts", "import": "./dist/plugin.js" },
    "./client": { "source": "./src/client.ts", "types": "./dist/client.d.ts", "import": "./dist/client.js" }
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "dev": "tsc -p tsconfig.json --watch",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@beatzball/litro": "workspace:^",
    "h3": "^1.15.6",
    "pathe": "^1.1.2"
  },
  "peerDependencies": {
    "@lit-labs/ssr": "^3.3.0",
    "@microsoft/fast-element": "^2.10.0",
    "@microsoft/fast-ssr": "^1.0.0-beta.1",
    "lit": "^3.2.1",
    "nitropack": "^2.13.1"
  },
  "peerDependenciesMeta": {
    "@lit-labs/ssr": { "optional": true },
    "@microsoft/fast-element": { "optional": true },
    "@microsoft/fast-ssr": { "optional": true },
    "lit": { "optional": true }
  },
  "devDependencies": {
    "@lit-labs/ssr": "^3.3.0",
    "@microsoft/fast-element": "^2.10.3",
    "@microsoft/fast-ssr": "1.0.0-beta.39",
    "lit": "^3.2.1",
    "nitropack": "^2.13.1",
    "jsdom": "^25.0.0",
    "typescript": "^5.7.3",
    "vitest": "^2.1.8"
  }
}
```

`packages/litro-agent/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist",
    "composite": true,
    "noEmitOnError": false
  },
  "references": [{ "path": "../framework" }],
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

`packages/litro-agent/vitest.config.ts` (framework's source-condition variant):

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    conditions: ['source', 'module', 'import', 'default'],
  },
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    environment: 'node',
  },
});
```

`packages/litro-agent/src/errors.ts`:

```ts
/**
 * Typed error surface for @beatzball/litro-agent. Mirrors the actions error
 * discipline: structured payloads, stacks only in dev.
 */
export interface AgentErrorPayload {
  name: string;
  message: string;
  status: number;
  stack?: string;
}

export class AgentError extends Error {
  status: number;

  constructor(message: string, opts: { status?: number; cause?: unknown } = {}) {
    super(message, opts.cause !== undefined ? { cause: opts.cause } : undefined);
    this.name = 'AgentError';
    this.status = opts.status ?? 500;
  }
}

export function errorPayload(err: unknown, dev: boolean): AgentErrorPayload {
  const e = err instanceof Error ? err : new Error(String(err));
  const status = err instanceof AgentError ? err.status : 500;
  return { name: e.name, message: e.message, status, ...(dev ? { stack: e.stack } : {}) };
}
```

- [ ] **Step 3: Repo wiring.** Root `tsconfig.json` `references` gains `{ "path": "./packages/litro-agent" }` (after litro-router). Root `package.json` `"test"` becomes `"pnpm --filter @beatzball/litro test && pnpm --filter @beatzball/litro-agent test"`. Root `.gitignore` gains a block:

```
# Agent session logs (runtime data, never committed)
.litro/
```

- [ ] **Step 4: Install + verify RED→GREEN.** Run `pnpm install` (links the new package), then `pnpm --filter @beatzball/litro-agent test` — expect the errors test to PASS (implementation written with it), and `pnpm --filter @beatzball/litro-agent build` clean. Run `pnpm test` from root — both packages' suites run.

- [ ] **Step 5: Commit**

```bash
git add packages/litro-agent tsconfig.json package.json .gitignore pnpm-lock.yaml
git commit -m "feat(agent): scaffold @beatzball/litro-agent workspace package"
```

---

### Task 3: Framework `./stream` subpath

**Files:**
- Create: `packages/framework/src/stream.ts`, `packages/framework/src/__tests__/stream.test.ts`, `.changeset/litro-stream-subpath.md`
- Modify: `packages/framework/package.json` (exports)

**Interfaces:**
- Produces: `@beatzball/litro/stream` exporting `createStreamEncoder`, `createStreamDecoder`, `serializeValue`, `deserializeValue`, `isAsyncIterable`, and types `StreamChunk`, `StreamEncoder` — byte-identical behavior to the actions serializer (they ARE the same functions).

- [ ] **Step 1: Write the failing test** — `packages/framework/src/__tests__/stream.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import * as stream from '../stream.js';
import * as serialize from '../actions/serialize.js';

describe('@beatzball/litro/stream subpath', () => {
  it('re-exports the actions serializer functions (same identities)', () => {
    expect(stream.createStreamEncoder).toBe(serialize.createStreamEncoder);
    expect(stream.createStreamDecoder).toBe(serialize.createStreamDecoder);
    expect(stream.serializeValue).toBe(serialize.serializeValue);
    expect(stream.deserializeValue).toBe(serialize.deserializeValue);
    expect(stream.isAsyncIterable).toBe(serialize.isAsyncIterable);
  });

  it('round-trips a Date through the NDJSON line protocol', () => {
    const enc = stream.createStreamEncoder();
    const dec = stream.createStreamDecoder();
    const chunk = dec(enc.value({ at: new Date('2026-07-07T00:00:00.000Z') }).slice(0, -1));
    expect(chunk.kind).toBe('value');
    expect((chunk as { value: { at: Date } }).value.at).toBeInstanceOf(Date);
  });
});
```

- [ ] **Step 2: Run to verify FAIL** (`../stream.js` missing): `pnpm --filter @beatzball/litro exec vitest run src/__tests__/stream.test.ts`

- [ ] **Step 3: Implement.** `packages/framework/src/stream.ts`:

```ts
/**
 * @beatzball/litro/stream — the framework's NDJSON stream wire protocol,
 * shared by Server Actions and @beatzball/litro-agent. One line per chunk:
 *   { n: <seroval cross-JSON node> } | { err: <payload> } | { done: true }
 * Browser-safe (re-exports the isomorphic actions serializer).
 */
export {
  serializeValue,
  deserializeValue,
  createStreamEncoder,
  createStreamDecoder,
  isAsyncIterable,
} from './actions/serialize.js';
export type { StreamChunk, StreamEncoder } from './actions/serialize.js';
```

Add to `packages/framework/package.json` exports (after `"./actions/form-client"`, mirroring order `source`/`types`/`import`):

```json
    "./stream": {
      "source": "./src/stream.ts",
      "types": "./dist/stream.d.ts",
      "import": "./dist/stream.js"
    },
```

- [ ] **Step 4: Changeset** — `.changeset/litro-stream-subpath.md`:

```md
---
'@beatzball/litro': patch
---

Expose the NDJSON stream wire protocol (`createStreamEncoder`, `createStreamDecoder`, `serializeValue`, `deserializeValue`, `isAsyncIterable`) as a public `@beatzball/litro/stream` subpath so Server Actions and the agent layer share one protocol.
```

- [ ] **Step 5: Verify GREEN + full framework suite + build:** `pnpm --filter @beatzball/litro test && pnpm --filter @beatzball/litro build`

- [ ] **Step 6: Commit**

```bash
git add packages/framework/src/stream.ts packages/framework/src/__tests__/stream.test.ts packages/framework/package.json .changeset/litro-stream-subpath.md
git commit -m "feat(framework): expose NDJSON stream protocol as @beatzball/litro/stream"
```

---

### Task 4: Core types + define* helpers

**Files:**
- Create: `packages/litro-agent/src/providers/types.ts`, `packages/litro-agent/src/sessions/types.ts`, `packages/litro-agent/src/index.ts`
- Test: `packages/litro-agent/src/index.test.ts`

**Interfaces (Produces — later tasks rely on these exact names):**

```ts
// providers/types.ts
export interface ToolCallPart { id: string; name: string; input: unknown }
export interface ChatMessage { role: 'system' | 'user' | 'assistant' | 'tool'; content: string; toolCalls?: ToolCallPart[]; toolCallId?: string }
export interface ToolSpec { name: string; description: string; parameters: Record<string, unknown> }  // JSON Schema
export type ProviderEvent =
  | { type: 'text-delta'; text: string }
  | { type: 'tool-call'; id: string; name: string; input: unknown }
  | { type: 'done'; usage?: { inputTokens?: number; outputTokens?: number } }
  | { type: 'provider-error'; message: string; status?: number };
export interface ProviderRequest { system: string; messages: ChatMessage[]; tools: ToolSpec[] }
export interface Provider { stream(req: ProviderRequest): AsyncIterable<ProviderEvent> }

// sessions/types.ts
export type SessionEventKind = 'message' | 'text-delta' | 'tool-call' | 'tool-progress' | 'tool-result' | 'ui' | 'error' | 'turn-end';
export interface SessionEvent { seq: number; ts: number; kind: SessionEventKind; payload: unknown }
export interface SessionStore {
  append(sessionId: string, event: Omit<SessionEvent, 'seq'>): Promise<SessionEvent>;
  read(sessionId: string, fromSeq?: number): AsyncIterable<SessionEvent>;
}

// index.ts
export const TOOL_CONFIG: unique symbol-ish  // Symbol.for('litro.agent.tool')
export const AGENT_CONFIG                    // Symbol.for('litro.agent.agent')
export const ACCESS_GUARD                    // Symbol.for('litro.agent.access')
defineTool<In>(config: ToolConfig<In>): ToolDefinition            // throws AgentError if !config.input
defineAgent(config: AgentConfig): AgentDefinition                 // throws on non-empty skills/extends/mcp/subagents (deferred keys)
defineAccess(fn: (event: H3Event) => void | Promise<void>): AccessGuard
defineAgentConfig(config: { sessions?: SessionStore }): AgentRuntimeConfig
```

`ToolConfig<In> = { description: string; input: StandardSchemaV1<unknown, In>; execute(input: In, ctx: ToolContext): unknown }` with `ToolContext = { event: H3Event | undefined; session: { id: string; seq: number } }`. `AgentConfig = { model: Provider; instructions: string; tools?: ToolDefinition[]; skills?: never[]; extends?: never; mcp?: never[]; subagents?: never[] }`. `StandardSchemaV1` is imported as a type from `@beatzball/litro/actions`. `UIResult` (defined in Task 8's `ui/index.ts`) is re-exported from `index.ts` as a type once Task 8 lands — Task 8 adds that line.

- [ ] **Step 1: Failing tests** — `packages/litro-agent/src/index.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { defineTool, defineAgent, defineAccess, defineAgentConfig, TOOL_CONFIG, AGENT_CONFIG } from './index.js';
import type { StandardSchemaV1 } from '@beatzball/litro/actions';

const echoSchema: StandardSchemaV1<unknown, { text: string }> = {
  '~standard': {
    version: 1,
    vendor: 'litro-agent-test',
    validate(value) {
      const v = value as { text?: unknown } | null;
      if (typeof v?.text !== 'string') return { issues: [{ message: 'text required' }] };
      return { value: { text: v.text } };
    },
  },
};

describe('defineTool', () => {
  it('attaches config under TOOL_CONFIG and preserves description/input', () => {
    const tool = defineTool({ description: 'echo', input: echoSchema, async execute(input) { return input.text; } });
    const cfg = (tool as Record<symbol, unknown>)[TOOL_CONFIG] as { description: string };
    expect(cfg.description).toBe('echo');
  });

  it('throws AgentError when input schema is missing', () => {
    expect(() => defineTool({ description: 'bad' } as never)).toThrow(/input schema/i);
  });
});

describe('defineAgent', () => {
  const model = { async *stream() { yield { type: 'done' as const } } };

  it('attaches config under AGENT_CONFIG', () => {
    const agent = defineAgent({ model, instructions: 'be helpful' });
    const cfg = (agent as Record<symbol, unknown>)[AGENT_CONFIG] as { instructions: string };
    expect(cfg.instructions).toBe('be helpful');
  });

  it('rejects deferred config keys with an actionable error', () => {
    expect(() => defineAgent({ model, instructions: 'x', skills: [{}] } as never)).toThrow(/deferred/i);
    expect(() => defineAgent({ model, instructions: 'x', mcp: [{}] } as never)).toThrow(/deferred/i);
  });
});

describe('defineAccess / defineAgentConfig', () => {
  it('are identity wrappers that brand their values', () => {
    const guard = defineAccess(() => undefined);
    expect(typeof guard).toBe('function');
    const cfg = defineAgentConfig({});
    expect(cfg).toEqual({});
  });
});
```

- [ ] **Step 2: RED:** `pnpm --filter @beatzball/litro-agent exec vitest run src/index.test.ts`

- [ ] **Step 3: Implement** the three files exactly per the Interfaces block. Deferred-key check in `defineAgent`:

```ts
for (const key of ['skills', 'extends', 'mcp', 'subagents'] as const) {
  const v = (config as Record<string, unknown>)[key];
  if (v !== undefined && (!Array.isArray(v) || v.length > 0)) {
    throw new AgentError(`defineAgent: "${key}" is deferred past v0 — see the design spec's deferral list.`, { status: 500 });
  }
}
```

`defineTool` throws `new AgentError('defineTool: an input schema is required — every tool is model-callable and its input is hostile.', { status: 500 })` when `config.input` is missing. Both helpers `Object.assign` a marker: tools are plain objects `{ [TOOL_CONFIG]: config }`; agents `{ [AGENT_CONFIG]: config }`; `defineAccess(fn)` returns `fn` unchanged (branding not needed — the scanner keys off the export name `access`).

- [ ] **Step 4: GREEN + build:** `pnpm --filter @beatzball/litro-agent test && pnpm --filter @beatzball/litro-agent build`

- [ ] **Step 5: Commit** — `git add packages/litro-agent/src && git commit -m "feat(agent): core types and define helpers"`

---

### Task 5: JSONL session store

**Files:**
- Create: `packages/litro-agent/src/sessions/file.ts`
- Test: `packages/litro-agent/src/sessions/file.test.ts`

**Interfaces:**
- Consumes: `SessionStore`, `SessionEvent` (Task 4).
- Produces: `fileSessionStore(opts?: { dir?: string }): SessionStore` — default dir `.litro/sessions`; one `<id>.jsonl` per session; `append` assigns monotonic `seq` starting at 1 and serializes writes per session (in-process promise chain); `read` streams parsed lines with `seq >= fromSeq` (default 0), silently skipping malformed lines. Also exports `validateSessionId(id: string): void` (throws `AgentError` 400 unless `/^[A-Za-z0-9_-]{1,64}$/`).

- [ ] **Step 1: Failing tests** — `packages/litro-agent/src/sessions/file.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'pathe';
import { fileSessionStore, validateSessionId } from './file.js';

let dir: string;
beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), 'litro-agent-store-')); });
afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

async function collect<T>(it: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const v of it) out.push(v);
  return out;
}

describe('fileSessionStore', () => {
  it('assigns monotonic seq starting at 1 and persists to <id>.jsonl', async () => {
    const store = fileSessionStore({ dir });
    const a = await store.append('s1', { ts: 1, kind: 'message', payload: { role: 'user', text: 'hi' } });
    const b = await store.append('s1', { ts: 2, kind: 'turn-end', payload: null });
    expect([a.seq, b.seq]).toEqual([1, 2]);
    const raw = await readFile(join(dir, 's1.jsonl'), 'utf-8');
    expect(raw.trim().split('\n')).toHaveLength(2);
  });

  it('read streams from fromSeq inclusive and preserves order', async () => {
    const store = fileSessionStore({ dir });
    for (let i = 0; i < 5; i++) await store.append('s1', { ts: i, kind: 'text-delta', payload: String(i) });
    const events = await collect(store.read('s1', 3));
    expect(events.map((e) => e.seq)).toEqual([3, 4, 5]);
  });

  it('seq survives process restart (re-derived from the file)', async () => {
    const first = fileSessionStore({ dir });
    await first.append('s1', { ts: 1, kind: 'message', payload: 'a' });
    const second = fileSessionStore({ dir });   // fresh instance = fresh process
    const ev = await second.append('s1', { ts: 2, kind: 'message', payload: 'b' });
    expect(ev.seq).toBe(2);
  });

  it('serializes concurrent appends (no interleaved lines, strictly increasing seq)', async () => {
    const store = fileSessionStore({ dir });
    await Promise.all(Array.from({ length: 20 }, (_, i) => store.append('s1', { ts: i, kind: 'text-delta', payload: i })));
    const events = await collect(store.read('s1'));
    expect(events.map((e) => e.seq)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });

  it('tolerates malformed lines and reads an absent session as empty', async () => {
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'bad.jsonl'), '{"seq":1,"ts":1,"kind":"message","payload":"ok"}\nnot-json\n{"seq":3,"ts":3,"kind":"turn-end","payload":null}\n');
    const store = fileSessionStore({ dir });
    const events = await collect(store.read('bad'));
    expect(events.map((e) => e.seq)).toEqual([1, 3]);
    expect(await collect(store.read('missing'))).toEqual([]);
  });
});

describe('validateSessionId', () => {
  it('accepts [A-Za-z0-9_-]{1,64} and rejects traversal/oversize', () => {
    expect(() => validateSessionId('abc_DEF-123')).not.toThrow();
    for (const bad of ['../etc', 'a/b', '', 'x'.repeat(65), 'a.b']) {
      expect(() => validateSessionId(bad)).toThrow(/session id/i);
    }
  });
});
```

- [ ] **Step 2: RED**, then **Step 3: Implement.** Core mechanics: module holds `chains = new Map<string, Promise<void>>()` and `seqs = new Map<string, number>()` per store instance; `append` chains onto the session's promise; first append per session (or after restart) initializes `seq` by reading the existing file's last valid line. Events are written as `JSON.stringify({ seq, ts, kind, payload }) + '\n'` via `appendFile` (payload is plain JSON in the log; seroval wraps only the WIRE, not the store — record this comment). `read` uses `readFile` + line split (v0: whole-file read is fine; streaming read is a store-adapter concern later — comment it). `validateSessionId` regex as specified.

- [ ] **Step 4: GREEN + build**, **Step 5: Commit** — `git commit -m "feat(agent): JSONL file session store"`

---

### Task 6: openai-compatible provider

**Files:**
- Create: `packages/litro-agent/src/providers/openai-compatible.ts`
- Test: `packages/litro-agent/src/providers/openai-compatible.test.ts`

**Interfaces:**
- Consumes: `Provider`, `ProviderEvent`, `ProviderRequest`, `ChatMessage`, `ToolSpec` (Task 4).
- Produces: `openaiCompatible(opts: { baseURL: string; model: string; apiKey?: string; headers?: Record<string, string> }): Provider`. `apiKey` falls back to `process.env.OPENAI_API_KEY`; auth header only sent when a key exists (local runtimes need none).

**Wire mapping (implement exactly):** POST `${baseURL}/chat/completions` with `{ model, stream: true, messages, tools }`. Outbound: `system` → `{ role: 'system', content }` first message; `ChatMessage` assistant with `toolCalls` → `{ role: 'assistant', content, tool_calls: [{ id, type: 'function', function: { name, arguments: JSON.stringify(input) } }] }`; `tool` role → `{ role: 'tool', tool_call_id: toolCallId, content }`. `ToolSpec` → `{ type: 'function', function: { name, description, parameters } }`. Inbound SSE (`data: <json>` lines, terminated by `data: [DONE]`): `choices[0].delta.content` → `text-delta`; `choices[0].delta.tool_calls[*]` accumulate by `index` (`id`, `function.name`, concatenated `function.arguments`) and flush as `tool-call` events (JSON.parse the arguments; on parse failure emit `provider-error`) when `finish_reason` arrives or the stream ends; final `usage` (when present on the last chunk) → `done`. Non-2xx response → single `provider-error` with status and body excerpt, then end.

- [ ] **Step 1: Failing tests** — spin a real `node:http` server per test that speaks SSE (the harness pattern used by the actions tests). Cover: (a) text-delta streaming across multiple SSE chunks; (b) a tool call split across argument deltas assembles into one `tool-call` with parsed input; (c) `[DONE]` without usage yields `done`; (d) HTTP 401 yields `provider-error` with status 401; (e) no auth header sent when no key, `Bearer` header when `apiKey` given (assert via captured request headers). Write the mock server helper inline in the test file:

```ts
function sseServer(chunks: string[], status = 200, capture?: { headers?: Record<string, unknown> }) {
  const server = createServer((req, res) => {
    if (capture) capture.headers = { ...req.headers };
    res.writeHead(status, { 'content-type': 'text/event-stream' });
    for (const c of chunks) res.write(`data: ${c}\n\n`);
    res.end();
  });
  return new Promise<{ url: string; close(): void }>((resolve) =>
    server.listen(0, () => resolve({
      url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`,
      close: () => server.close(),
    })),
  );
}
```

(For the tool-call case the chunks are the standard incremental `delta.tool_calls` frames: first frame carries `{ index: 0, id: 'call_1', function: { name: 'get-weather', arguments: '' } }`, following frames carry `{ index: 0, function: { arguments: '{"city":' } }` etc., then a frame with `finish_reason: 'tool_calls'`, then `[DONE]`.)

- [ ] **Step 2: RED**, **Step 3: Implement** (fetch + manual SSE line parser over `res.body` with TextDecoder — same reader pattern as the actions client), **Step 4: GREEN + build**, **Step 5: Commit** — `git commit -m "feat(agent): openai-compatible provider adapter"`

---

### Task 7: anthropic provider

**Files:**
- Create: `packages/litro-agent/src/providers/anthropic.ts`
- Test: `packages/litro-agent/src/providers/anthropic.test.ts`

**Interfaces:**
- Produces: `anthropic(opts: { model: string; apiKey?: string; baseURL?: string; maxTokens?: number }): Provider`. `apiKey` falls back to `process.env.ANTHROPIC_API_KEY` (throw `AgentError` at stream time if absent); `baseURL` default `https://api.anthropic.com`; `maxTokens` default 4096.

**Wire mapping (implement exactly):** POST `${baseURL}/v1/messages`, headers `x-api-key`, `anthropic-version: 2023-06-01`, body `{ model, max_tokens, stream: true, system, messages, tools }`. Outbound: `system` goes in the top-level `system` field (never as a message); assistant `toolCalls` → content blocks `[{ type: 'text', text }, { type: 'tool_use', id, name, input }]`; `tool` role → user message with `[{ type: 'tool_result', tool_use_id: toolCallId, content }]`; `ToolSpec` → `{ name, description, input_schema: parameters }`. Inbound SSE events by `event:` type: `content_block_delta` with `delta.type === 'text_delta'` → `text-delta`; `content_block_start` with `content_block.type === 'tool_use'` opens an accumulator (id, name), `input_json_delta.partial_json` concatenates, `content_block_stop` flushes `tool-call` (parse the JSON; `{}` when empty); `message_delta` carries `usage.output_tokens`; `message_stop` → `done` with accumulated usage; `error` event or non-2xx → `provider-error`.

- [ ] **Step 1: Failing tests** — same `sseServer` harness shape as Task 6 but emitting `event: <type>\ndata: <json>\n\n` frames. Cover: text streaming, tool_use assembly across `input_json_delta` frames, usage on `message_delta`+`message_stop` → `done`, 400 error body → `provider-error`, missing key → `AgentError` (assert `.rejects` on first iteration), system-in-body + tool_result mapping (capture the request BODY and assert the outbound JSON shapes for a `ProviderRequest` containing an assistant toolCalls message and a tool result message).

- [ ] **Step 2: RED**, **Step 3: Implement**, **Step 4: GREEN + build**, **Step 5: Commit** — `git commit -m "feat(agent): anthropic provider adapter"`

---

### Task 8: scripted provider + ui()/UIResult

**Files:**
- Create: `packages/litro-agent/src/providers/scripted.ts`, `packages/litro-agent/src/ui/index.ts`, `packages/litro-agent/src/ui/lit.ts`, `packages/litro-agent/src/ui/fast.ts`
- Test: `packages/litro-agent/src/providers/scripted.test.ts`, `packages/litro-agent/src/ui/lit.test.ts`, `packages/litro-agent/src/ui/fast.test.ts` (SEPARATE file — the FAST DOM shim pollutes globals; vitest per-file isolation contains it)
- Modify: `packages/litro-agent/src/index.ts` (add `export type { UIResult } from './ui/index.js';`)

**Interfaces:**
- Produces:

```ts
// providers/scripted.ts
export type ScriptedEvent = ProviderEvent | { type: 'delay'; ms: number };  // delay is consumed by the provider itself (awaited), never emitted
scriptedProvider(script: (req: ProviderRequest, turn: number) => ScriptedEvent[]): Provider  // turn = 1-based call count

// ui/index.ts
export interface UIResult {
  type: 'ui';
  html: string;
  data?: unknown;
  hydrate?: { modules?: string[]; props?: Record<string, unknown> };
}
export function isUIResult(v: unknown): v is UIResult;
export async function ui(template: unknown, opts?: { data?: unknown; hydrate?: UIResult['hydrate'] }): Promise<UIResult>;
// resolver: LITRO_ADAPTER 'lit' (default) → ./lit.js, 'fast' → ./fast.js, 'elena' → AgentError('deferred')

// ui/lit.ts:  uiLit(template: TemplateResult, opts?) — render() + collectResult() deep import '@lit-labs/ssr/lib/render-result.js'
// ui/fast.ts: uiFast(template: string, opts?)       — templateRenderer.render(string); prefers globalThis.__litro_fast_template_renderer__, else imports '@beatzball/litro/adapter/fast/ssr-init' (per Task 1's recorded answer)
```

- [ ] **Step 1: Failing tests.**

`scripted.test.ts`: script returning `[{type:'text-delta',...},{type:'done'}]` streams those events in order; `turn` increments across calls; the request is passed through (assert the script sees `req.messages`); a `{ type: 'delay', ms: 30 }` entry pauses at least that long between the surrounding events and is never yielded to the consumer (assert with timestamps and the emitted event list).

`lit.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { html } from 'lit';
import { uiLit } from './lit.js';

describe('uiLit', () => {
  it('renders a template to a string and carries data/hydrate through', async () => {
    const r = await uiLit(html`<span>${'weather'}</span>`, { data: { t: 21 }, hydrate: { props: { t: 21 } } });
    expect(r.type).toBe('ui');
    expect(r.html).toContain('weather');
    expect(r.data).toEqual({ t: 21 });
    expect(r.hydrate?.props).toEqual({ t: 21 });
  });

  it('escapes interpolated strings (no unsafe HTML injection)', async () => {
    const r = await uiLit(html`<span>${'<img src=x onerror=1>'}</span>`);
    expect(r.html).not.toContain('<img');
  });
});
```

`fast.test.ts` (import order per ssr-init discipline: dom shim + fastSSR BEFORE the element definition):

```ts
import { describe, it, expect } from 'vitest';
import '@microsoft/fast-ssr/install-dom-shim.js';
import fastSSR from '@microsoft/fast-ssr';

const { templateRenderer } = fastSSR({ renderMode: 'async' });
(globalThis as Record<string, unknown>).__litro_fast_template_renderer__ = templateRenderer;

const { FASTElement, customElement, html: fastHtml } = await import('@microsoft/fast-element');
@customElement({ name: 'spike-card', template: fastHtml`<p>fast-card-content</p>` })
class SpikeCard extends FASTElement {}
void SpikeCard;

const { uiFast } = await import('./fast.js');

describe('uiFast', () => {
  it('renders a tag string to DSD via the shared templateRenderer', async () => {
    const r = await uiFast('<spike-card></spike-card>', { data: { ok: true } });
    expect(r.html).toContain('shadowrootmode');
    expect(r.html).toContain('fast-card-content');
    expect(r.data).toEqual({ ok: true });
  });
});
```

(If Task 1 recorded a different working recipe for detached FAST renders, follow THAT recipe here and in `ui/fast.ts` — the spike answer is authoritative.)

Resolver test (append to `scripted.test.ts` or a small `ui/index.test.ts`): with `LITRO_ADAPTER` unset, `ui(html`...`)` produces the Lit path result; with `LITRO_ADAPTER=elena`, it rejects with `/deferred/`. Use `vi.stubEnv` + `vi.resetModules()`.

- [ ] **Step 2: RED**, **Step 3: Implement** the four source files per the Interfaces block. `ui/index.ts` resolver:

```ts
export async function ui(template: unknown, opts: UiOpts = {}): Promise<UIResult> {
  const adapter = process.env.LITRO_ADAPTER ?? 'lit';
  if (adapter === 'lit') return (await import('./lit.js')).uiLit(template as never, opts);
  if (adapter === 'fast') return (await import('./fast.js')).uiFast(template as never, opts);
  throw new AgentError(`ui(): the "${adapter}" renderer is deferred past v0.`, { status: 500 });
}
```

- [ ] **Step 4: GREEN + build**, **Step 5: Commit** — `git commit -m "feat(agent): scripted provider and UIResult renderers (lit, fast)"`

---

### Task 9: Turn loop

**Files:**
- Create: `packages/litro-agent/src/runtime/loop.ts`
- Test: `packages/litro-agent/src/runtime/loop.test.ts`

**Interfaces:**
- Consumes: Tasks 4, 5, 8 exports.
- Produces:

```ts
export interface TurnDeps {
  agent: { name: string; config: AgentConfig; tools: Map<string, ToolDefinition> };
  store: SessionStore;
  sessionId: string;
  event: H3Event | undefined;
  emit: (ev: SessionEvent) => void;        // wire callback — called AFTER append resolves
  maxToolRounds?: number;                   // default 8 — runaway guard
}
export async function runTurn(deps: TurnDeps, userText: string): Promise<void>;
```

**Behavior (implement exactly):**
1. `append+emit` user `message` (`payload: { role: 'user', text }`).
2. Build provider request: `system` = agent instructions; `messages` reconstructed from the CURRENT turn only in v0 plus prior `message` events replayed from the store (`kind === 'message'` → user/assistant `ChatMessage`s; tool events of past turns are NOT replayed — conversation memory is message-level in v0, comment this).
3. Iterate `provider.stream(req)`: `text-delta` → append+emit each; accumulate text. `tool-call` → append+emit `tool-call` `{ id, name, input }`; look up tool (unknown tool → `tool-result` with `{ error: { message } }` fed back, no throw); validate input via the Standard Schema (`~standard.validate`); invalid → error tool-result fed back; valid → run `execute(input, { event, session: { id, seq } })`. Result handling: `isUIResult(result)` → append+emit `ui` (full UIResult) AND feed the provider a tool message whose content is `JSON.stringify(result.data ?? null)` — **the html string must never appear in any ChatMessage** ; async iterable → each yield append+emit `tool-progress`, return value (generator's return) is the tool-result; plain value → `tool-result` with the value, fed back as `JSON.stringify`. Tool `execute` throw → append+emit `tool-result` `{ error: { message } }` (no stack), fed back.
4. After tool results, call the provider again with the extended messages (assistant message carrying `toolCalls` + tool messages) — loop until a stream finishes with `done` and no pending tool calls, or `maxToolRounds` is exhausted (then append `error` "tool round limit").
5. `provider-error` event → append+emit `error` `{ message, status }`, then `turn-end`; return (session stays resumable).
6. On clean finish: append+emit assistant `message` (accumulated text), then `turn-end`.

- [ ] **Step 1: Failing tests** with `scriptedProvider` + `fileSessionStore` in a temp dir. Cases (assert BOTH the emitted sequence and the persisted log — they must be identical, and every emit must come after its append: instrument `emit` to read the store's file length at call time):
  - plain text turn → events `message(user), text-delta×n, message(assistant), turn-end`;
  - one tool round: script turn 1 emits `tool-call` for `echo` then `done`; script turn 2 emits `text-delta` + `done`; assert `tool-call`, `tool-result` events and that turn-2's request contains the tool message with the JSON result and the assistant `toolCalls` message;
  - UIResult tool: assert a `ui` event with `html`, and that NO ChatMessage in any provider request contains the string `shadowroot` or the html (script captures requests); model sees `data` JSON;
  - async-generator tool → `tool-progress` events then `tool-result`;
  - tool throw and unknown tool → error-shaped `tool-result`, loop continues, turn completes;
  - invalid tool input (schema reject) → error tool-result mentioning validation;
  - provider-error mid-turn → `error` + `turn-end`, no throw;
  - maxToolRounds: script always returns a tool-call → loop stops with `error` payload matching /round limit/.

- [ ] **Step 2: RED**, **Step 3: Implement `runTurn`** (~150 lines), **Step 4: GREEN + build**, **Step 5: Commit** — `git commit -m "feat(agent): turn loop with append-before-wire ordering"`

---

### Task 10: HTTP handler (gates, lock, POST stream, GET tail)

**Files:**
- Create: `packages/litro-agent/src/runtime/handler.ts`
- Test: `packages/litro-agent/src/runtime/handler.test.ts`

**Interfaces:**
- Consumes: `runTurn` (Task 9), `fileSessionStore`/`validateSessionId` (Task 5), `createStreamEncoder`/`deserializeValue` from `@beatzball/litro/stream`, `AGENT_CONFIG`/`TOOL_CONFIG` (Task 4).
- Produces:

```ts
export interface AgentManifestEntry {
  name: string;
  module: Record<string, unknown>;          // agent.ts namespace (default = AgentDefinition, access? = guard)
  instructions: string;                     // inlined at build time
  tools: Array<{ name: string; module: Record<string, unknown> }>;  // default = ToolDefinition
}
export function createAgentHandler(entries: AgentManifestEntry[], runtimeConfig?: AgentRuntimeConfig | null): EventHandler;
```

**Behavior:** Route params `:agent`, `:session`. Gates in order: (1) Sec-Fetch-Site must be absent/`same-origin`/`none`; (2) Origin (when present) must match `x-forwarded-host` first value ?? `host`; (3) POST only: `x-litro-agent` header must equal `'1'`; (4) `validateSessionId`; (5) unknown agent → 404; (6) agent's `access` guard runs (its `createError` propagates via h3). Store = `runtimeConfig?.sessions ?? fileSessionStore()`. Instructions from the manifest override `config.instructions` when the config value is a `./`-relative path (the build inlined it); a literal string config stands.

POST: body `deserializeValue` → `{ text }` (malformed → 400). Per-process lock `Map<'agent/session', true>` → 409 when held. Response: `ReadableStream` NDJSON; `runTurn` runs with `emit` enqueuing `encoder.value(ev)`; broadcast each event to the tail registry; on completion enqueue `encoder.done()` and close; `runTurn` throw → `encoder.error(errorPayload(err, dev))` then close. Lock released in `finally`.

GET: `?from=<int >= 0>` (default 0). Replay `store.read(session, from)` as NDJSON lines; then if the lock is held, subscribe to the broadcast until a `turn-end` event flows, else `done()` + close.

- [ ] **Step 1: Failing tests** — real-server harness (createApp + router `.post`/`.get` on `/__litro/agent/:agent/:session`, `createAgentHandler` with a scripted-provider demo agent and a temp-dir store). Cases: missing header on POST → 403; cross-site Sec-Fetch-Site → 403 (both methods); Origin/x-forwarded-host mismatch → 403, first-value match passes; bad session id → 400; unknown agent → 404; access guard (agent whose `access` throws `createError({statusCode:401})`) → 401 on both methods; happy POST → ndjson lines decode (via `createStreamDecoder`) to the Task-9 event sequence ending `turn-end` then protocol `done`; concurrent second POST during a slow scripted turn (script awaits a deferred) → 409; GET from=0 replays everything; GET from=N replays suffix; GET during active turn live-tails to completion (start slow POST, GET mid-turn, assert it receives the later events); malformed POST body → 400.

- [ ] **Step 2: RED**, **Step 3: Implement** (~170 lines), **Step 4: GREEN + build**, **Step 5: Commit** — `git commit -m "feat(agent): HTTP handler with gates, session lock and reconnect tail"`

---

### Task 11: Nitro build plugin (scanner + codegen)

**Files:**
- Create: `packages/litro-agent/src/plugin.ts`
- Test: `packages/litro-agent/src/plugin.test.ts`

**Interfaces:**
- Produces: `export default async function agentsPlugin(nitro: Nitro): Promise<void>` — mirrors the actions plugin exactly:
  1. Scan `agents/*/agent.ts` under rootDir (skip `_`-prefixed dirs); per agent scan `agents/<name>/tools/*.ts` (tool name = filename minus extension) and read `agents/<name>/instructions.md` if present (inlined as a JSON string).
  2. Generate `#litro/agent-manifest` virtual + physical `server/stubs/agent-manifest.ts` (absolute imports for the virtual, relative `.js` for the stub — copy `toRelativeImportSpecifier` semantics: rewrite `.ts|.tsx` only). Manifest shape: `export const agentEntries = [{ name, module: _agent0, instructions: <inlined-or-empty string>, tools: [{ name, module: _agent0_tool0 }] }]`.
  3. Generate `#litro/agent-config` virtual + stub `server/stubs/agent-config.ts`: re-export of `agents/_config.ts` default when the file exists, else `export default null;`.
  4. Generate `server/stubs/agent-handler.ts`: imports `createAgentHandler` from `@beatzball/litro-agent/handler`, `agentEntries`, `agentConfig`, default-exports `createAgentHandler(agentEntries, agentConfig)`.
  5. All writes via a content-compared `writeStub` (copy the 12-line helper from the actions plugin — do NOT import framework plugin internals).
  6. `dev:reload` hook re-runs the scan. No `nitro.options.handlers` push (static entries in consumer config — the dev-server timing rule).

- [ ] **Step 1: Failing tests** — mirror `packages/framework/src/plugins/__tests__/actions.test.ts` conventions (mkdtemp root, `mockNitro()` with `{ options: { rootDir, virtual: {} }, hooks: { hook: vi.fn() }, logger: { info: vi.fn() } }`). Plant `agents/demo/agent.ts`, `agents/demo/instructions.md` (content `Be brief.`), `agents/demo/tools/get-weather.ts`, `agents/_shared/skills/x/SKILL.md`, `agents/_config.ts`. Assert: virtual manifest contains `name: "demo"`, `instructions: "Be brief."`, tool entry `get-weather`; `_shared` NOT scanned as an agent; stub file uses relative `.js` specifiers; config stub re-exports `_config`; without `_config.ts` the stub exports null; second run leaves mtimes unchanged (idempotent); handler stub imports `@beatzball/litro-agent/handler`.

- [ ] **Step 2: RED**, **Step 3: Implement**, **Step 4: GREEN + build**, **Step 5: Commit** — `git commit -m "feat(agent): nitro build plugin — agent scanner and codegen"`

---

### Task 12: Browser client

**Files:**
- Create: `packages/litro-agent/src/client.ts`
- Test: `packages/litro-agent/src/client.test.ts` (`@vitest-environment jsdom`)

**Interfaces:**
- Consumes: `createStreamDecoder`, `serializeValue` from `@beatzball/litro/stream`; `SessionEvent` type; `UIResult` type. NOTHING else (browser-safety).
- Produces:

```ts
export function agentSession(agent: string, sessionId: string, opts?: { base?: string }): {
  send(text: string): AsyncIterable<SessionEvent>;      // POST, header x-litro-agent: 1
  resume(fromSeq?: number): AsyncIterable<SessionEvent>; // GET ?from=, retries once on network error with backoff from last seen seq
};
export async function hydrateUIResult(host: HTMLElement, result: UIResult): Promise<void>;
// host.setHTMLUnsafe when available else innerHTML (DSD needs setHTMLUnsafe in modern browsers — note + feature-detect);
// dynamic-import hydrate.modules; Object.assign(host.firstElementChild, hydrate.props)
```

- [ ] **Step 1: Failing tests** — fetchMock pattern from the actions client tests; NDJSON Response bodies built with `createStreamEncoder`. Cases: send() posts serialized `{ text }` with the header and yields decoded events; resume() passes `?from=`; resume() retries after a mid-stream network error and continues from last seq+1 (fetchMock first returns a stream that errors after 2 events, second call asserts `from=2`); `{ err }` line raises; hydrateUIResult injects html (jsdom lacks setHTMLUnsafe → innerHTML fallback path is what's tested — note DSD limitation in a comment), imports modules (mock via `hydrate.modules: []` + props assignment asserted on a stub element).

- [ ] **Step 2: RED**, **Step 3: Implement**, **Step 4: GREEN + build + browser-safety grep** (`grep -n "from 'h3'\|node:" src/client.ts` → no hits), **Step 5: Commit** — `git commit -m "feat(agent): browser session client and UIResult hydration"`

---

### Task 13: Checkpoint A — independent core validation

- [ ] **Step 1: Battery:** `pnpm --filter @beatzball/litro-agent test && pnpm --filter @beatzball/litro-agent build && pnpm --filter @beatzball/litro test && pnpm --filter @beatzball/litro build && pnpm --filter @beatzball/litro-router test`
- [ ] **Step 2: Dispatch independent validation subagent(s)** (did not write the code) verifying against the spec: every §3/§5 export exists with the stated signature/subpath; append-before-wire holds in loop+handler (code trace + test evidence); the model-never-sees-html rule is enforced and tested; gates match §5.6; browser-safe import graph of client.ts; content-compared writes in plugin.ts; deferred keys rejected; seroval JSON-mode only (`grep -rn 'crossSerialize|fromJSON|toJSON' packages/litro-agent/src` — only via @beatzball/litro/stream); test integrity (10 most safety-critical tests assert what they claim); pristine test output.
- [ ] **Step 3: Fix findings, re-run battery, commit** — `git commit -m "fix(agent): checkpoint A findings"` (skip if none).

---

### Task 14: Playground (Lit) integration

**Files:**
- Create: `playground/agents/demo/agent.ts`, `playground/agents/demo/instructions.md`, `playground/agents/demo/tools/get-weather.ts`, `playground/components/demo-weather-card.ts`, `playground/pages/agent.ts`
- Modify: `playground/nitro.config.ts`, `playground/package.json` (imports map)

**Interfaces:**
- Produces (contract with Task 15 e2e): page `/agent` with ids `#chat-input`, `#chat-send`, `#chat-log` (text events append `<p class="chat-text">`), `#ui-slot` (UIResult hydrates here), `#fallback-data` (renders `JSON.stringify(ev.payload.data)` for `ui` events — the text-surface fallback assertion), `#session-id` (shows the generated session id). Agent name `demo`; tool `get-weather` returns `ui()` with `data: { city, tempC: 21, summary: 'sunny' }`; `<demo-weather-card>` renders `.city`/`.tempC`/`.summary` props with element id `weather-card-root` inside its shadow DOM.

Wiring edits (exact):
- `playground/nitro.config.ts`: `import agentsPlugin from '@beatzball/litro-agent/plugin';` — via workspace dep? Playground imports framework from `../packages/framework/dist/...`; use `import agentsPlugin from '../packages/litro-agent/dist/plugin.js';` (same convention as the framework plugin imports). Handlers: the two `/__litro/agent/:agent/:session` entries (post + get) → `resolve('./server/stubs/agent-handler.ts')`; `build:before` gains `await agentsPlugin(nitro);` after actionsPlugin; route rule `'/__litro/agent/**': { headers: { 'cache-control': 'no-store' } }`.
- `playground/package.json` imports map gains `"#litro/agent-manifest": "./server/stubs/agent-manifest.ts"` and `"#litro/agent-config": "./server/stubs/agent-config.ts"`; deps gain `"@beatzball/litro-agent": "workspace:^"`.
- Root `.gitignore`: `playground*/server/stubs/` already covers the generated stubs — verify, no edit expected.

`playground/agents/demo/agent.ts` (scripted provider — deterministic, no keys):

```ts
import { defineAgent } from '@beatzball/litro-agent';
import { scriptedProvider } from '@beatzball/litro-agent/providers/scripted';

const model = scriptedProvider((req, turn) => {
  const last = req.messages[req.messages.length - 1];
  if (turn === 1 && /weather/i.test(String(last?.content ?? ''))) {
    return [
      { type: 'text-delta', text: 'Checking the weather' },
      { type: 'tool-call', id: 'call_1', name: 'get-weather', input: { city: 'Lisbon' } },
      { type: 'done' },
    ];
  }
  return [
    { type: 'text-delta', text: 'Here is the ' },
    { type: 'text-delta', text: 'weather card.' },
    { type: 'done' },
  ];
});

export default defineAgent({ model, instructions: './instructions.md' });
```

`tools/get-weather.ts`: `defineTool` + hand-rolled Standard Schema `{ city: string }` (copy the playground actions schema pattern) + `ui(html`<demo-weather-card .city=${city} .tempC=${21} .summary=${'sunny'}></demo-weather-card>`, { data: { city, tempC: 21, summary: 'sunny' } })` — import `ui` from `@beatzball/litro-agent/ui`, `html` from `lit`, and `../../components/demo-weather-card.js` for the side-effect registration.

`pages/agent.ts`: Lit page (follow `pages/forms.ts` conventions) that on `#chat-send` click generates/reuses a session id, iterates `agentSession('demo', id).send(input.value)`, appending text-deltas to `#chat-log`, calling `hydrateUIResult(uiSlot, ev.payload)` for `ui` events and writing `JSON.stringify(payload.data)` into `#fallback-data`.

- [ ] **Step 1: Apply all files/edits.** **Step 2: Build both packages** (`pnpm --filter @beatzball/litro build && pnpm --filter @beatzball/litro-agent build`), `pnpm install`. **Step 3: Smoke** — dev server on 3051: `curl -s -X POST localhost:3051/__litro/agent/demo/smoke1 -H 'x-litro-agent: 1' -H 'content-type: application/json' --data "$(node --input-type=module -e "const{serializeValue}=await import('./packages/framework/dist/actions/serialize.js');console.log(serializeValue({text:'weather please'}))")"` → NDJSON lines incl. a `ui` event with `shadowrootmode`; `curl 'localhost:3051/__litro/agent/demo/smoke1?from=0'` replays. Kill server. **Step 4: Commit** — `git commit -m "feat(playground): agent demo — scripted provider, UI tool, chat page"`

---

### Task 15: E2E — items 1–3 (Lit playground)

**Files:**
- Create: `e2e/playground/agent.spec.ts`, `e2e/playground/agent-resume.spec.ts`

**Specs:**

`agent.spec.ts` (uses the standard playground project fixture, port 3030):
- item 1: goto `/agent`, wait `page-agent:not([hidden])`, fill `#chat-input` with "what's the weather in lisbon", click `#chat-send`; expect `#chat-log` to contain "Checking the weather"; expect `#ui-slot demo-weather-card` to be visible with shadow text containing "Lisbon" and "21"; expect a followup text "weather card." (second turn NOT auto-run in v0 — the tool result feeds back within ONE POST turn, so the final text arrives in the same stream).
- item 2: expect `#fallback-data` to contain `"tempC":21` and NOT contain `shadowroot` (data channel is clean of HTML).
- raw transport: `request.post('/__litro/agent/demo/e2e-raw' , { headers: { 'x-litro-agent': '1' }, data: serializeValue({ text: 'weather now' }) })` → NDJSON body has `ui` event line and terminal `{"done":true}`; `request.get('/__litro/agent/demo/e2e-raw?from=0')` replays the same events; missing header → 403.

`agent-resume.spec.ts` (item 3 — OWN server lifecycle, serial, absolute URLs on port 3052; does NOT use the fixture baseURL):
- `test.describe.configure({ mode: 'serial' })`; spawn `node ../packages/framework/dist/cli/index.js dev --port 3052` in `playground/` via `child_process.spawn`, poll until ready.
- Start a POST (slow turn: send text "weather slowly" — extend the demo script: when text contains "slowly", the scripted provider inserts an event only after a 1500ms delay via an async scripted extension: give `scriptedProvider` support for `{ type: 'delay', ms }` pseudo-event consumed by the provider itself — add this in Task 8 to `scripted.ts` and its test). Read the first 2 NDJSON lines, then `proc.kill('SIGKILL')`.
- Restart the server (same command), `GET /__litro/agent/demo/<sid>?from=<lastSeq+1>` → replayed/remaining events include the persisted prefix; assert the log survived (at minimum the user message and first deltas are replayed from `from=0`) and the stream terminates cleanly (`{"done":true}`) — the turn itself is dead (documented: v0 resumes the LOG, not handler execution; assert exactly that behavior).
- Kill server in `afterAll`, `rm -rf playground/.litro` cleanup in `beforeAll`.

- [ ] **Step 1: Write both specs** (complete code per above). **Step 2: Run** `pnpm exec playwright test --project=playground` — all green incl. pre-existing. **Step 3: Commit** — `git commit -m "test(e2e): agent chat, data separation, raw transport, kill-resume"`

---

### Task 16: FAST playground integration + e2e — item 4

**Files:**
- Create: `playground-fast/agents/demo/agent.ts`, `playground-fast/agents/demo/instructions.md`, `playground-fast/agents/demo/tools/get-weather.ts`, `playground-fast/components/demo-weather-card.ts` (FAST element), `playground-fast/pages/agent.ts` (FAST page)
- Modify: `playground-fast/nitro.config.ts`, `playground-fast/package.json`
- Create: `e2e/playground-fast/agent.spec.ts`

Same wiring as Task 14 (playground-fast has NO actions wiring — agents wiring stands alone; same handler entries/route rule/imports-map/build:before edits, plus `"@beatzball/litro-agent": "workspace:^"`). The FAST tool uses `ui` from `@beatzball/litro-agent/ui` with a template STRING: `ui(`<demo-weather-card city="${city}" temp-c="21" summary="sunny"></demo-weather-card>`, { data: {...} })` — attributes (FAST SSR path), kebab-case attrs mapping to the element's attr-backed properties. The FAST page follows `playground-fast/pages/index.ts` conventions.

`e2e/playground-fast/agent.spec.ts` (project playground-fast, port 3038): item-1 subset (send → text streams → card visible with DSD content) + item-2 (`#fallback-data` clean of HTML). No resume spec here.

- [ ] **Step 1: Apply files/edits; build; smoke** (dev on 3038 via the project's normal command, curl POST as Task 14). **Step 2: Run** `pnpm exec playwright test --project=playground-fast` — green incl. pre-existing. **Step 3: Commit** — `git commit -m "feat(playground-fast): agent demo proves UIResult is not Lit-shaped"`

---

### Task 17: Checkpoint B — full-suite regression

- [ ] Run: `pnpm --filter @beatzball/litro build && pnpm --filter @beatzball/litro-agent build && pnpm test && pnpm test:e2e && pnpm test:e2e:preview && pnpm test:docs` — all green. Fix regressions via systematic-debugging; commit fixes.

---

### Task 18: Docs guide + spec lockstep

**Files:**
- Create: `packages/docs-content/content/docs/agents.md`
- Modify: `docs/server/starlight.config.js` (sidebar: `{ label: 'Agents', slug: 'agents' }` under Features, after Server Actions)
- Modify: `docs/superpowers/specs/2026-07-07-litro-agent-v0-design.md` (record any implementation deviations discovered in Tasks 1–16 in an `## Implementation deviations` section)

Guide sections (all claims verified against shipped code; the Task 20 fact-check agent diffs them): What agents are (positioning, one paragraph, no competitor names) · Setup (wiring edits incl. handler entries/route rule/imports map, `agents/_config.ts`, `.litro/` gitignore note) · Directory convention (`agents/<name>/`, `_`-prefix exclusion) · `defineAgent`/`defineAccess` · Tools (`defineTool`, Standard Schema requirement, three return shapes) · UI tools (`ui()`, UIResult, the model-sees-data rule, per-adapter notes incl. FAST string templates, hydrate contract + `setHTMLUnsafe` note) · Providers (openai-compatible, anthropic, scripted; env keys) · Sessions (JSONL store, ids, reconnect via `resume`, v0 single-instance lock limitation) · Client (`agentSession`, `hydrateUIResult`) · Security (gates, access guard, hostile tool input, session privacy, `.litro/` sensitivity) · Limitations/deferred (mirrors spec §9 incl. skills §5.8 pointer).

- [ ] **Step 1: Write guide + sidebar entry. Step 2: Spec deviations section. Step 3:** `pnpm test:docs` green. **Step 4: Commit** — `git commit -m "docs: agents guide; record v0 implementation deviations"`

---

### Task 19: Changeset (litro-agent initial release)

- [ ] Create `.changeset/litro-agent-initial.md`:

```md
---
'@beatzball/litro-agent': minor
---

Initial release: filesystem-first agent layer for Litro apps. `agents/<name>/` directories become durable session endpoints (`POST|GET /__litro/agent/:agent/:session`) streaming NDJSON session events. Tools (`defineTool`, Standard Schema input) can return `UIResult`s — server-rendered design-system components (Lit DSD or FAST) whose `data` is what the model observes while the HTML streams to the surface. Includes openai-compatible, anthropic, and scripted providers; JSONL session store with reconnect/replay (`resume(fromSeq)`); browser client with `hydrateUIResult`; Nitro build plugin following the Server Actions wiring pattern.
```

(The `@beatzball/litro` `./stream` changeset landed in Task 3.) Verify single-package frontmatter + ignore-list non-membership; commit — `git commit -m "chore: changeset for @beatzball/litro-agent initial release"`

---

### Task 20: Checkpoint C + final whole-branch review

- [ ] **Step 1: Docs fact-check agent** (independent): every claim in `agents.md` vs shipped code — exports/subpaths/signatures, endpoint paths, header name, event kinds, store paths, gate behavior, per-adapter ui() input types; plus changeset claims; plus spec-deviation section accuracy.
- [ ] **Step 2: Whole-branch review** (strongest tier): security of the complete surface (gates, access guard ordering, session-id filename safety, hostile tool inputs, UIResult injection paths, data-channel HTML leakage), cross-task contract drift, spec-vs-code, no competitor names (`grep -rniE 'flue|vercel|eve[^n]' <changed files>` — mind false positives like "even"/"event": review hits manually), leftover debris.
- [ ] **Step 3: Final battery** (Task 17 command set) — all green.
- [ ] **Step 4: Personal-identifier sweep** (log + full branch diff, `<author-name-pattern>|/Users/` — must be clean).
- [ ] **Step 5: Fix findings; commit; hand off** to superpowers:finishing-a-development-branch. PR body: no bare `#N`, standard footer.
