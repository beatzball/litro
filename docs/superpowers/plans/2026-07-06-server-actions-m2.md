# Server Actions Milestone 2 — Forms, Streaming, Templates: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Server Actions Milestone 2: progressive-enhancement forms with a no-JS path, streaming action returns, create-litro fullstack template wiring, and the v1 follow-up basket — per the approved design `docs/superpowers/specs/2026-07-05-server-actions-m2-design.md`.

**Architecture:** Forms reuse the existing `POST /__litro/action/:id` endpoint: the handler branches on request content-type (form-encoded → PRG flow with one-shot error cookie; everything else → v1 RPC unchanged). Streaming detects an `AsyncIterable` handler result and responds with NDJSON lines of seroval cross-JSON nodes that `callAction` revives incrementally. A generated Nitro runtime plugin stamps action ids onto server-side exports so the isomorphic `actionUrl()` works during SSR.

**Tech Stack:** TypeScript (NodeNext), h3 1.15, nitropack 2.13, Vite 8, seroval 1.5.4 (JSON-data modes only), vitest (node env; jsdom via per-file annotation), Playwright.

## Global Constraints

- **Frozen v1 wire contracts:** endpoint `POST /__litro/action/:id` (double underscore); `hashActionId = sha256(relPath + '#' + exportName).slice(0, 12)`; `x-litro-action: 1` header gate for RPC mode; error payload shape `{ name, message, status, issues?, stack? (dev only) }`.
- **seroval JSON-data modes only** (`toJSON`/`fromJSON`, `toCrossJSON`/`fromCrossJSON`). NEVER the code-eval pair (`serialize`/`deserialize`, `crossSerialize*`) — the server deserializes hostile input.
- **seroval + NodeNext:** seroval's `dist/types/index.d.ts` uses directory re-exports tsc cannot follow; every seroval symbol used must be declared in `packages/framework/src/actions/seroval-types.d.ts`.
- **Generated files inside Nitro's watched srcDir** (`server/stubs/`, `server/plugins/`) MUST use the content-compared `writeStub()` write or dev reload-loops forever.
- **Import specifiers in framework/playground source use `.js` extensions** (NodeNext), e.g. `import { hashActionId } from './hash.js'`.
- **`actions/client.ts`, `actions/form-client.ts`, `actions/form-data.ts`, `actions/serialize.ts`, `actions/error.ts` are browser-safe:** no Node-only imports (`node:crypto`, `h3` value imports, `nitropack`).
- **Vite actions plugin:** do NOT add `enforce: 'pre'` (transform must receive transpiled JS).
- **One changeset file per package.** Only `@beatzball/litro` and `@beatzball/create-litro` get changesets (docs packages are ignored).
- **No bare `#N` references** in commit messages or PR bodies (GitHub auto-links); write "PRD item N" / escape as `\#N`.
- **No personal identifiers** (`zaidalbaker`, `/Users/...`) in any committed content; grep before every push.
- **No emojis** anywhere.
- Playground e2e runs against `packages/framework/dist/` — run `pnpm --filter @beatzball/litro build` after framework changes before any playground/e2e step.
- Commit after every task; do not push or open a PR until the final task.

## Design decisions this plan pins (spec deferred or missed them — reflect back into the spec in Task 15)

1. **seroval streaming composition:** per-yield `toCrossJSON(value, { refs })` with one shared `refs: Map<unknown, number>` per response; client revives each line via `fromCrossJSON(node, { refs })` with a shared `refs: Map<number, unknown>`. (`toCrossJSONStream`'s `onParse` callback shape targets async values *inside* one value — wrong fit for a per-yield loop; the spec explicitly sanctions this fallback.) Verified against installed seroval 1.5.4 typings: `toCrossJSON<T>(source: T, options?: { refs?: Map<unknown, number> }): SerovalNode`, `fromCrossJSON<T>(source: SerovalNode, options: { refs?: Map<number, unknown> }): T`.
2. **Client NDJSON parsing** uses a `ReadableStreamDefaultReader` + `TextDecoder` line buffer (not `TextDecoderStream` — same incremental behavior, testable under vitest node/jsdom).
3. **`enhanceForms(root = document)` takes an optional root.** `submit` events are `composed: false` — they never cross shadow-root boundaries, so a document-level listener cannot see forms inside Lit shadow DOM. Components rendering forms in shadow roots call `enhanceForms(this.renderRoot)`; `app.ts`-level `enhanceForms()` covers light-DOM forms. It returns a detach function.
4. **The Vite actions plugin stubs `@beatzball/litro/actions/server` in client builds.** Page modules are client-bundled, and the spec's own worked example imports `getFormErrors`/`csrfToken` (node:crypto) at page level. A `resolveId`/`load` pair replaces the module with throwing stubs client-side (same precedent as the `litro:content` browser stub).
5. **The generated runtime plugin default-exports a plain function** (`export default function () { ... }`) — Nitro calls plugins as functions; no reliance on `defineNitroPlugin` auto-import.
6. **`formDataToObject` strips `_litro_csrf` on BOTH paths** (enhancer and server). The spec only says the enhancer strips it, but a strict input schema would also reject the unknown key on the no-JS path.
7. **PRG vs plain-error split in form mode:** misconfiguration (plain-function target, schema-less `defineAction`, streaming result) and CSRF-token failure respond with plain JSON errors (400/403) — developer errors / attack traffic. Validation failures and handler throws PRG-bounce with the one-shot cookie — end-user flows.

---

### Task 1: Stream chunk protocol (seroval cross-JSON typings + encoder/decoder)

**Files:**
- Modify: `packages/framework/src/actions/seroval-types.d.ts`
- Modify: `packages/framework/src/actions/serialize.ts`
- Test: `packages/framework/src/actions/__tests__/stream-serialize.test.ts` (create)

**Interfaces:**
- Consumes: seroval 1.5.4 `toCrossJSON`/`fromCrossJSON` (via typings added here); `ActionErrorPayload` from `./error.js`.
- Produces: `createStreamEncoder(): { value(v: unknown): string; error(p: ActionErrorPayload): string; done(): string }` — each returns one full NDJSON line ending in `\n`. `createStreamDecoder(): (line: string) => StreamChunk` where `StreamChunk = { kind: 'value'; value: unknown } | { kind: 'error'; payload: ActionErrorPayload } | { kind: 'done' }`. `isAsyncIterable(value: unknown): value is AsyncIterable<unknown>`. All exported from `serialize.ts` (browser-safe).

- [ ] **Step 1: Write the failing test**

Create `packages/framework/src/actions/__tests__/stream-serialize.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  createStreamEncoder,
  createStreamDecoder,
  isAsyncIterable,
  type StreamChunk,
} from '../serialize.js';

describe('stream chunk encoder/decoder', () => {
  it('round-trips multiple chunks, reviving rich values like Date', () => {
    const enc = createStreamEncoder();
    const dec = createStreamDecoder();
    const d = new Date('2026-07-06T00:00:00.000Z');
    const lines = [enc.value({ i: 1, at: d }), enc.value({ i: 2 }), enc.done()];
    for (const line of lines) {
      expect(line.endsWith('\n')).toBe(true);
      expect(line.slice(0, -1)).not.toContain('\n');
    }
    const chunks = lines.map((l) => dec(l.slice(0, -1)));
    expect(chunks[0].kind).toBe('value');
    const first = (chunks[0] as { kind: 'value'; value: { i: number; at: Date } }).value;
    expect(first.at).toBeInstanceOf(Date);
    expect(first.at.toISOString()).toBe('2026-07-06T00:00:00.000Z');
    expect((chunks[1] as { kind: 'value'; value: { i: number } }).value.i).toBe(2);
    expect(chunks[2]).toEqual({ kind: 'done' });
  });

  it('shares references across chunks (same object twice revives to one identity)', () => {
    const enc = createStreamEncoder();
    const dec = createStreamDecoder();
    const shared = { tag: 'shared' };
    const c1 = dec(enc.value({ first: shared }).slice(0, -1)) as { kind: 'value'; value: { first: unknown } };
    const c2 = dec(enc.value({ second: shared }).slice(0, -1)) as { kind: 'value'; value: { second: unknown } };
    expect(c1.value.first).toBe(c2.value.second);
  });

  it('encodes and decodes error lines', () => {
    const enc = createStreamEncoder();
    const dec = createStreamDecoder();
    const chunk: StreamChunk = dec(
      enc.error({ name: 'LitroActionError', message: 'boom', status: 500 }).slice(0, -1),
    );
    expect(chunk).toEqual({
      kind: 'error',
      payload: { name: 'LitroActionError', message: 'boom', status: 500 },
    });
  });

  it('isAsyncIterable detects async generators and rejects plain values', async () => {
    async function* gen() {
      yield 1;
    }
    expect(isAsyncIterable(gen())).toBe(true);
    expect(isAsyncIterable([1, 2])).toBe(false);
    expect(isAsyncIterable(null)).toBe(false);
    expect(isAsyncIterable(Promise.resolve(1))).toBe(false);
    expect(isAsyncIterable('str')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @beatzball/litro exec vitest run src/actions/__tests__/stream-serialize.test.ts`
Expected: FAIL — `createStreamEncoder` is not exported.

- [ ] **Step 3: Extend the seroval typings**

In `packages/framework/src/actions/seroval-types.d.ts`, add inside the existing `declare module 'seroval' { ... }` block (keep the existing `SerovalJSON`/`toJSON`/`fromJSON` declarations):

```ts
  /** Opaque cross-JSON node produced by toCrossJSON(); safe for JSON.stringify.
   *  Same NodeNext workaround as SerovalJSON above: seroval's directory
   *  re-exports hide these symbols from tsc even though they exist at runtime. */
  export type SerovalNode = unknown;
  export function toCrossJSON<T>(source: T, options?: { refs?: Map<unknown, number> }): SerovalNode;
  export function fromCrossJSON<T>(source: SerovalNode, options: { refs?: Map<number, unknown> }): T;
```

- [ ] **Step 4: Implement the encoder/decoder in `serialize.ts`**

Append to `packages/framework/src/actions/serialize.ts` (existing `serializeValue`/`deserializeValue` unchanged; extend the imports):

```ts
import { toJSON, fromJSON, toCrossJSON, fromCrossJSON, type SerovalNode } from 'seroval';
import type { ActionErrorPayload } from './error.js';
```

```ts
/**
 * Streaming wire protocol (application/x-ndjson): one JSON object per line.
 *   { n: <seroval cross-JSON node> }   — one yielded value
 *   { err: <ActionErrorPayload> }      — mid-stream handler throw; stream ends
 *   { done: true }                     — clean end of stream
 * Encoder and decoder each hold a shared seroval refs map for the lifetime of
 * one response, so object identity is preserved across chunks. Cross-JSON is
 * a plain-data AST — no code is evaluated on either side.
 */
export type StreamChunk =
  | { kind: 'value'; value: unknown }
  | { kind: 'error'; payload: ActionErrorPayload }
  | { kind: 'done' };

export interface StreamEncoder {
  value(v: unknown): string;
  error(p: ActionErrorPayload): string;
  done(): string;
}

export function createStreamEncoder(): StreamEncoder {
  const refs = new Map<unknown, number>();
  return {
    value: (v) => `${JSON.stringify({ n: toCrossJSON(v, { refs }) })}\n`,
    error: (p) => `${JSON.stringify({ err: p })}\n`,
    done: () => `${JSON.stringify({ done: true })}\n`,
  };
}

export function createStreamDecoder(): (line: string) => StreamChunk {
  const refs = new Map<number, unknown>();
  return (line) => {
    const parsed = JSON.parse(line) as { n?: SerovalNode; err?: ActionErrorPayload; done?: boolean };
    if (parsed.err !== undefined) return { kind: 'error', payload: parsed.err };
    if (parsed.done === true) return { kind: 'done' };
    return { kind: 'value', value: fromCrossJSON(parsed.n, { refs }) };
  };
}

export function isAsyncIterable(value: unknown): value is AsyncIterable<unknown> {
  return (
    typeof (value as { [Symbol.asyncIterator]?: unknown } | null | undefined)?.[
      Symbol.asyncIterator
    ] === 'function'
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @beatzball/litro exec vitest run src/actions/__tests__/stream-serialize.test.ts`
Expected: PASS (all 4 tests).

- [ ] **Step 6: Verify no regressions and commit**

Run: `pnpm --filter @beatzball/litro test && pnpm --filter @beatzball/litro build`
Expected: all unit tests pass; tsc emits without errors.

```bash
git add packages/framework/src/actions/seroval-types.d.ts packages/framework/src/actions/serialize.ts packages/framework/src/actions/__tests__/stream-serialize.test.ts
git commit -m "feat(actions): NDJSON stream chunk protocol on seroval cross-JSON"
```

---

### Task 2: Streaming responses in the HTTP handler

**Files:**
- Modify: `packages/framework/src/actions/define.ts` (handler return type widening)
- Modify: `packages/framework/src/actions/handler.ts`
- Test: `packages/framework/src/actions/__tests__/handler.test.ts` (extend)
- Test: `packages/framework/src/actions/__tests__/define.test.ts` (extend)

**Interfaces:**
- Consumes: `createStreamEncoder`, `isAsyncIterable` from Task 1.
- Produces: `POST /__litro/action/:id` responds `content-type: application/x-ndjson; charset=utf-8`, `cache-control: no-store`, body = NDJSON lines, whenever the dispatched result is an `AsyncIterable`. Single-shot responses byte-for-byte unchanged. `ActionConfig.handler` type becomes `(input: In, ctx: ActionContext) => Out | Promise<Out>` so `async *handler(){}` (returns `AsyncGenerator`, not `Promise`) type-checks with `Out = AsyncIterable<T>`.

- [ ] **Step 1: Write the failing tests**

In `packages/framework/src/actions/__tests__/define.test.ts`, add:

```ts
it('accepts an async-generator handler; in-process call resolves to the iterable', async () => {
  const streamy = defineAction({
    async *handler() {
      yield 1;
      yield 2;
    },
  });
  const iterable = await streamy(undefined as never);
  const got: unknown[] = [];
  for await (const v of iterable) got.push(v);
  expect(got).toEqual([1, 2]);
});
```

In `packages/framework/src/actions/__tests__/handler.test.ts`, add to the demo module object (next to the existing exports fed into `ActionModuleEntry`):

```ts
async function* streamCount(): AsyncGenerator<{ i: number; at: Date }> {
  yield { i: 1, at: new Date('2026-07-06T00:00:00.000Z') };
  yield { i: 2, at: new Date('2026-07-06T00:00:01.000Z') };
  yield { i: 3, at: new Date('2026-07-06T00:00:02.000Z') };
}
const sharedRef = { tag: 'shared' };
async function* streamShared(): AsyncGenerator<Record<string, unknown>> {
  yield { first: sharedRef };
  yield { second: sharedRef };
}
async function* streamFail(): AsyncGenerator<string> {
  yield 'ok';
  throw new Error('mid-stream boom');
}
```

Register them in the module map and compute ids with the existing pattern (`hashActionId('actions/demo.server', 'streamCount')` etc.). Then add a describe block (reuse the existing `base`, `serializeValue`, header conventions):

```ts
import { createStreamDecoder } from '../serialize.js';

function rpcHeaders() {
  return { 'content-type': 'application/json', 'x-litro-action': '1' };
}

async function postStream(id: string) {
  const res = await fetch(`${base}/__litro/action/${id}`, {
    method: 'POST',
    headers: rpcHeaders(),
    body: serializeValue([]),
  });
  const lines = (await res.text()).split('\n').filter((l) => l.length > 0);
  const dec = createStreamDecoder();
  return { res, chunks: lines.map(dec) };
}

describe('streaming responses', () => {
  it('streams AsyncIterable results as NDJSON with a done line', async () => {
    const { res, chunks } = await postStream(ID_STREAM_COUNT);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/x-ndjson');
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(chunks).toHaveLength(4);
    const first = chunks[0] as { kind: 'value'; value: { i: number; at: Date } };
    expect(first.value.i).toBe(1);
    expect(first.value.at).toBeInstanceOf(Date);
    expect(chunks[3]).toEqual({ kind: 'done' });
  });

  it('preserves object identity across chunks (shared refs)', async () => {
    const { chunks } = await postStream(ID_STREAM_SHARED);
    const a = (chunks[0] as { kind: 'value'; value: { first: unknown } }).value.first;
    const b = (chunks[1] as { kind: 'value'; value: { second: unknown } }).value.second;
    expect(a).toBe(b);
  });

  it('a mid-stream throw emits an err line (no stack outside dev) and ends the stream', async () => {
    const { res, chunks } = await postStream(ID_STREAM_FAIL);
    expect(res.status).toBe(200);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toEqual({ kind: 'value', value: 'ok' });
    const err = chunks[1] as { kind: 'error'; payload: { message: string; status: number; stack?: string } };
    expect(err.payload.message).toBe('mid-stream boom');
    expect(err.payload.status).toBe(500);
    expect(err.payload.stack).toBeUndefined();
  });

  it('single-shot responses are unchanged (content-type application/json)', async () => {
    const res = await fetch(`${base}/__litro/action/${ID_ADD}`, {
      method: 'POST',
      headers: rpcHeaders(),
      body: serializeValue([2, 3]),
    });
    expect(res.headers.get('content-type')).toContain('application/json');
  });
});
```

(Adapt `ID_ADD` / existing plain-action name to what the test file already defines.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @beatzball/litro exec vitest run src/actions/__tests__/handler.test.ts src/actions/__tests__/define.test.ts`
Expected: FAIL — define.test type/runtime failure on generator handler; handler streaming tests get a single-shot JSON body (seroval serializes the iterable as an opaque object) instead of NDJSON.

- [ ] **Step 3: Widen the handler type in `define.ts`**

In `ActionConfig`, change:

```ts
  handler: (input: In, ctx: ActionContext) => Promise<Out>;
```

to:

```ts
  /** May return a Promise (single-shot) or an AsyncIterable/async generator
   *  (streamed as NDJSON over HTTP; resolves to the iterable in-process). */
  handler: (input: In, ctx: ActionContext) => Out | Promise<Out>;
```

`runAction`'s `return config.handler(input, ctx);` needs no change (async function awaits; awaiting an `AsyncIterable` returns it — not thenable).

- [ ] **Step 4: Implement the streaming branch in `handler.ts`**

Extend the serialize import and add a stream-response helper:

```ts
import {
  serializeValue,
  deserializeValue,
  createStreamEncoder,
  isAsyncIterable,
} from './serialize.js';
```

Above `createActionHandler`, add:

```ts
/** Streams an AsyncIterable result as NDJSON (see serialize.ts for the line
 *  protocol). Errors thrown mid-iteration become an err line — headers are
 *  already sent, so the HTTP status stays 200 and the client rethrows from
 *  the payload. h3 1.15 sends returned web ReadableStreams natively;
 *  backpressure comes from pull(). */
function streamResponse(event: H3Event, iterable: AsyncIterable<unknown>): ReadableStream<Uint8Array> {
  setResponseHeader(event, 'content-type', 'application/x-ndjson; charset=utf-8');
  setResponseHeader(event, 'cache-control', 'no-store');
  const encoder = createStreamEncoder();
  const textEncoder = new TextEncoder();
  const iterator = iterable[Symbol.asyncIterator]();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const next = await iterator.next();
        if (next.done) {
          controller.enqueue(textEncoder.encode(encoder.done()));
          controller.close();
          return;
        }
        controller.enqueue(textEncoder.encode(encoder.value(next.value)));
      } catch (err) {
        controller.enqueue(textEncoder.encode(encoder.error(toErrorPayload(err))));
        controller.close();
      }
    },
    async cancel() {
      await iterator.return?.();
    },
  });
}
```

In the dispatch block, after `const result = ...` and before the existing single-shot headers:

```ts
      if (isAsyncIterable(result)) {
        return streamResponse(event, result);
      }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @beatzball/litro exec vitest run src/actions/__tests__/handler.test.ts src/actions/__tests__/define.test.ts`
Expected: PASS, including all pre-existing handler tests.

- [ ] **Step 6: Full unit suite + build, then commit**

Run: `pnpm --filter @beatzball/litro test && pnpm --filter @beatzball/litro build`
Expected: PASS / clean emit.

```bash
git add packages/framework/src/actions/define.ts packages/framework/src/actions/handler.ts packages/framework/src/actions/__tests__/handler.test.ts packages/framework/src/actions/__tests__/define.test.ts
git commit -m "feat(actions): stream AsyncIterable handler results as NDJSON"
```

---

### Task 3: Streaming consumption in `callAction`

**Files:**
- Modify: `packages/framework/src/actions/client.ts`
- Test: `packages/framework/src/actions/__tests__/client.test.ts` (extend)

**Interfaces:**
- Consumes: `createStreamDecoder` from Task 1; `LitroActionError` from `./error.js`.
- Produces: `callAction<T>(id, args)` — when the response is ok with `content-type` containing `application/x-ndjson`, resolves to an `AsyncGenerator<unknown>` (cast to `T`) that yields revived values, throws a reconstructed `LitroActionError` on an `err` line, returns on the `done` line, and throws `LitroActionError` (status 502) if the stream ends without one. JSON responses behave exactly as v1.

- [ ] **Step 1: Write the failing tests**

Add to `packages/framework/src/actions/__tests__/client.test.ts` (reuse the existing `fetchMock` setup):

```ts
import { createStreamEncoder } from '../serialize.js';

function ndjsonResponse(body: string, splitAt?: number[]) {
  const encoder = new TextEncoder();
  const parts = splitAt?.length
    ? [0, ...splitAt, body.length].slice(0, -1).map((s, i, arr) => body.slice(s, arr[i + 1] ?? body.length))
    : [body];
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const p of parts) controller.enqueue(encoder.encode(p));
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { 'content-type': 'application/x-ndjson; charset=utf-8' },
  });
}

describe('callAction streaming', () => {
  it('yields revived chunks incrementally and completes on the done line', async () => {
    const enc = createStreamEncoder();
    const d = new Date('2026-07-06T00:00:00.000Z');
    fetchMock.mockResolvedValue(
      ndjsonResponse(enc.value({ i: 1, at: d }) + enc.value({ i: 2 }) + enc.done()),
    );
    const iterable = await callAction<AsyncIterable<{ i: number; at?: Date }>>('abc123def456', []);
    const got: { i: number; at?: Date }[] = [];
    for await (const v of iterable) got.push(v);
    expect(got.map((v) => v.i)).toEqual([1, 2]);
    expect(got[0].at).toBeInstanceOf(Date);
  });

  it('parses lines split across network chunks', async () => {
    const enc = createStreamEncoder();
    const body = enc.value({ i: 1 }) + enc.value({ i: 2 }) + enc.done();
    fetchMock.mockResolvedValue(ndjsonResponse(body, [Math.floor(body.length / 3), Math.floor((2 * body.length) / 3)]));
    const iterable = await callAction<AsyncIterable<{ i: number }>>('abc123def456', []);
    const got: number[] = [];
    for await (const v of iterable) got.push(v.i);
    expect(got).toEqual([1, 2]);
  });

  it('rethrows a mid-stream err line as LitroActionError', async () => {
    const enc = createStreamEncoder();
    fetchMock.mockResolvedValue(
      ndjsonResponse(enc.value('ok') + enc.error({ name: 'Error', message: 'mid-stream boom', status: 500 })),
    );
    const iterable = await callAction<AsyncIterable<string>>('abc123def456', []);
    const got: string[] = [];
    const err = await (async () => {
      for await (const v of iterable) got.push(v);
    })().catch((e: unknown) => e);
    expect(got).toEqual(['ok']);
    expect(err).toBeInstanceOf(LitroActionError);
    expect((err as LitroActionError).message).toBe('mid-stream boom');
  });

  it('throws 502 when the stream ends without a done line', async () => {
    const enc = createStreamEncoder();
    fetchMock.mockResolvedValue(ndjsonResponse(enc.value('partial')));
    const iterable = await callAction<AsyncIterable<string>>('abc123def456', []);
    const err = await (async () => {
      for await (const _v of iterable) {
        /* drain */
      }
    })().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(LitroActionError);
    expect((err as LitroActionError).status).toBe(502);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @beatzball/litro exec vitest run src/actions/__tests__/client.test.ts`
Expected: FAIL — streaming tests get `deserializeValue` JSON-parse errors (v1 path).

- [ ] **Step 3: Implement NDJSON consumption in `client.ts`**

Extend imports:

```ts
import { serializeValue, deserializeValue, createStreamDecoder } from './serialize.js';
```

Add below `callAction`:

```ts
/** Incremental NDJSON reader for streamed action responses. Buffers bytes,
 *  splits on newlines, revives each value line via the shared-refs decoder,
 *  rethrows err lines as LitroActionError, and returns on the done line.
 *  A stream that ends without done means the connection dropped mid-stream. */
async function* parseActionStream(
  body: ReadableStream<Uint8Array>,
  id: string,
): AsyncGenerator<unknown, void, undefined> {
  const decode = createStreamDecoder();
  const reader = body.getReader();
  const textDecoder = new TextDecoder();
  let buffer = '';

  const handleLine = (line: string): { done: boolean; value?: unknown; hasValue: boolean } => {
    const chunk = decode(line);
    if (chunk.kind === 'done') return { done: true, hasValue: false };
    if (chunk.kind === 'error') {
      throw new LitroActionError(chunk.payload.message, {
        status: chunk.payload.status,
        issues: chunk.payload.issues,
      });
    }
    return { done: false, value: chunk.value, hasValue: true };
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += done ? textDecoder.decode() : textDecoder.decode(value, { stream: true });
      let newline: number;
      while ((newline = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        if (!line.trim()) continue;
        const r = handleLine(line);
        if (r.done) return;
        if (r.hasValue) yield r.value;
      }
      if (done) {
        const rest = buffer.trim();
        if (rest) {
          const r = handleLine(rest);
          if (r.done) return;
          if (r.hasValue) yield r.value;
        }
        throw new LitroActionError(`Action ${id} stream ended unexpectedly`, { status: 502 });
      }
    }
  } finally {
    reader.releaseLock();
  }
}
```

Restructure `callAction`'s body: after the `fetch`, before reading text:

```ts
  const contentType = res.headers.get('content-type') ?? '';
  if (res.ok && contentType.includes('application/x-ndjson')) {
    if (!res.body) {
      throw new LitroActionError(`Action ${id} returned a stream response without a body`, {
        status: 502,
      });
    }
    return parseActionStream(res.body, id) as T;
  }

  const text = await res.text();
  // ... existing non-ok handling and deserializeValue return, unchanged
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @beatzball/litro exec vitest run src/actions/__tests__/client.test.ts`
Expected: PASS, including the four pre-existing v1 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/framework/src/actions/client.ts packages/framework/src/actions/__tests__/client.test.ts
git commit -m "feat(actions): callAction consumes NDJSON action streams incrementally"
```

---

### Task 4: Action id stamps — `ACTION_ID`, `makeStub`, `actionUrl`, Vite codegen

**Files:**
- Modify: `packages/framework/src/actions/client.ts`
- Modify: `packages/framework/src/actions/index.ts`
- Modify: `packages/framework/src/vite/actions.ts`
- Test: `packages/framework/src/vite/__tests__/actions-plugin.test.ts` (update exact-string assertions)
- Test: `packages/framework/src/actions/__tests__/client.test.ts` (extend)

**Interfaces:**
- Produces: `ACTION_ID = Symbol.for('litro.action.id')`, `makeStub(id: string): (...args: unknown[]) => Promise<unknown>` (callAction wrapper with `ACTION_ID` stamped), `actionUrl(action: (...args: never[]) => unknown): string` returning `/__litro/action/<id>` or throwing a descriptive error — all in `client.ts`; `actionUrl` and `ACTION_ID` re-exported from `actions/index.ts`. Vite stubs become `export const X = makeStub("<id>");` / `export default makeStub("<id>");` importing `makeStub` instead of `callAction`.

- [ ] **Step 1: Write the failing tests**

In `client.test.ts` add:

```ts
import { makeStub, actionUrl, ACTION_ID } from '../client.js';

describe('makeStub / actionUrl', () => {
  it('makeStub attaches the id and forwards calls to callAction', async () => {
    fetchMock.mockResolvedValue(okResponse({ ok: true }));
    const stub = makeStub('abc123def456');
    expect((stub as unknown as Record<symbol, unknown>)[ACTION_ID]).toBe('abc123def456');
    await stub({ text: 'hi' });
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe('/__litro/action/abc123def456');
  });

  it('actionUrl resolves the stamped id', () => {
    expect(actionUrl(makeStub('abc123def456'))).toBe('/__litro/action/abc123def456');
  });

  it('actionUrl throws a descriptive error for unstamped functions', () => {
    expect(() => actionUrl(async () => undefined)).toThrow(/no action id/);
  });
});
```

In `vite/__tests__/actions-plugin.test.ts`, update every assertion of the form
`expect(code).toContain('export const getPost = (...args) => callAction("<hash>", args);')`
to
`expect(code).toContain('export const getPost = makeStub("<hash>");')`
(same for `export default makeStub("<hash>");`), and the import assertion from
`import { callAction } from '@beatzball/litro/actions/client';` to
`import { makeStub } from '@beatzball/litro/actions/client';`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @beatzball/litro exec vitest run src/actions/__tests__/client.test.ts src/vite/__tests__/actions-plugin.test.ts`
Expected: FAIL — `makeStub` not exported; codegen still emits arrow stubs.

- [ ] **Step 3: Implement in `client.ts`**

```ts
/** Wire id stamp shared by client stubs (makeStub) and the server-side
 *  runtime plugin (stampActionIds). Symbol.for so both sides agree even if
 *  two copies of this module load. */
export const ACTION_ID = Symbol.for('litro.action.id');

/** Factory used by generated client stubs — keeps codegen to one call per
 *  export and stamps the id so actionUrl() works in the browser. */
export function makeStub(id: string): (...args: unknown[]) => Promise<unknown> {
  return Object.assign((...args: unknown[]) => callAction(id, args), { [ACTION_ID]: id });
}

/** Isomorphic: returns the endpoint URL for a scanned action export. On the
 *  client the Vite stub carries the stamp; on the server the generated
 *  server/plugins/litro-actions.ts runtime plugin stamps real exports at boot. */
export function actionUrl(action: (...args: never[]) => unknown): string {
  const id = (action as unknown as Record<symbol, unknown>)[ACTION_ID];
  if (typeof id !== 'string') {
    throw new Error(
      '[litro] actionUrl(): the given function has no action id. Only exports of ' +
        'scanned *.server.ts modules inside the project root get ids — check the ' +
        'file name/location, and that the litro actions plugins are wired up.',
    );
  }
  return `/__litro/action/${id}`;
}
```

In `actions/index.ts` add:

```ts
export { actionUrl, ACTION_ID } from './client.js';
```

- [ ] **Step 4: Update the Vite codegen in `vite/actions.ts`**

Replace the stub-emission block:

```ts
      const lines: string[] = [
        '// @generated by litro:actions — client stub for a .server module',
        `import { makeStub } from '@beatzball/litro/actions/client';`,
      ];
      for (const e of exports) {
        const name = e.n;
        const actionId = hashActionId(relPath, name);
        lines.push(
          name === 'default'
            ? `export default makeStub(${JSON.stringify(actionId)});`
            : `export const ${name} = makeStub(${JSON.stringify(actionId)});`,
        );
      }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @beatzball/litro exec vitest run src/actions/__tests__/client.test.ts src/vite/__tests__/actions-plugin.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/framework/src/actions/client.ts packages/framework/src/actions/index.ts packages/framework/src/vite/actions.ts packages/framework/src/vite/__tests__/actions-plugin.test.ts packages/framework/src/actions/__tests__/client.test.ts
git commit -m "feat(actions): stamp action ids on stubs; isomorphic actionUrl()"
```

---

### Task 5: Server-side stamping plugin, `.mjs` fix, `actions/server` subpath + client stub

**Files:**
- Create: `packages/framework/src/actions/server.ts`
- Modify: `packages/framework/src/plugins/actions.ts`
- Modify: `packages/framework/src/vite/actions.ts` (client stub for the server subpath)
- Modify: `packages/framework/package.json` (exports)
- Modify: `.gitignore` (repo root)
- Test: `packages/framework/src/plugins/__tests__/actions.test.ts` (extend)
- Test: `packages/framework/src/vite/__tests__/actions-plugin.test.ts` (extend)
- Test: `packages/framework/src/actions/__tests__/server.test.ts` (create)

**Interfaces:**
- Consumes: `ACTION_ID` (Task 4), `hashActionId`, `ActionModuleEntry`.
- Produces: `stampActionIds(entries: ActionModuleEntry[]): void` in new server-only module `actions/server.ts` (exported as `@beatzball/litro/actions/server`; Task 7 adds the cookie helpers to the same file). The Nitro plugin additionally writes `server/plugins/litro-actions.ts` (auto-loaded by Nitro at boot). `toRelativeImportSpecifier` no longer rewrites `.mjs`. The Vite plugin serves throwing stubs for `@beatzball/litro/actions/server` in client builds.

- [ ] **Step 1: Write the failing tests**

Create `packages/framework/src/actions/__tests__/server.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { stampActionIds } from '../server.js';
import { ACTION_ID, actionUrl } from '../client.js';
import { hashActionId } from '../hash.js';
import type { ActionModuleEntry } from '../handler.js';

describe('stampActionIds', () => {
  it('stamps every function export with hashActionId(relPath, exportName)', () => {
    const fn = async () => 'x';
    const other = async () => 'y';
    const entries: ActionModuleEntry[] = [
      { relPath: 'actions/demo.server', module: { fn, other, notAFn: 42 } },
    ];
    stampActionIds(entries);
    expect((fn as unknown as Record<symbol, unknown>)[ACTION_ID]).toBe(
      hashActionId('actions/demo.server', 'fn'),
    );
    expect(actionUrl(other)).toBe(
      `/__litro/action/${hashActionId('actions/demo.server', 'other')}`,
    );
  });

  it('is idempotent and skips already-stamped functions', () => {
    const fn = async () => 'x';
    const entries: ActionModuleEntry[] = [{ relPath: 'a.server', module: { fn } }];
    stampActionIds(entries);
    expect(() => stampActionIds(entries)).not.toThrow();
  });
});
```

In `plugins/__tests__/actions.test.ts` add (reuse the existing `mockNitro()` + temp-dir helpers):

```ts
it('writes the runtime stamping plugin to server/plugins/litro-actions.ts', async () => {
  // ...run actionsPlugin against a temp root with one demo .server.ts...
  const pluginSrc = await readFile(join(rootDir, 'server/plugins/litro-actions.ts'), 'utf-8');
  expect(pluginSrc).toContain("import { stampActionIds } from '@beatzball/litro/actions/server';");
  expect(pluginSrc).toContain("import { actionModules } from '#litro/action-manifest';");
  expect(pluginSrc).toContain('export default function');
});

it('keeps .mjs extensions in stub manifest import specifiers', async () => {
  // ...temp root containing actions/legacy.server.mjs...
  const stub = await readFile(join(rootDir, 'server/stubs/action-manifest.ts'), 'utf-8');
  expect(stub).toContain('legacy.server.mjs');
  expect(stub).not.toContain('legacy.server.js');
});
```

In `vite/__tests__/actions-plugin.test.ts` add:

```ts
it('stubs @beatzball/litro/actions/server in client builds', async () => {
  const plugin = litroActionsPlugin();
  const resolved = (plugin.resolveId as (id: string) => string | undefined)(
    '@beatzball/litro/actions/server',
  );
  expect(resolved).toBe('\0litro:actions-server-stub');
  const code = (plugin.load as (id: string) => string | undefined)(resolved!);
  expect(code).toContain('server-only');
  expect(code).toContain('export const csrfToken');
  expect(code).toContain('export const getFormErrors');
  expect(code).toContain('export const stampActionIds');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @beatzball/litro exec vitest run src/actions/__tests__/server.test.ts src/plugins/__tests__/actions.test.ts src/vite/__tests__/actions-plugin.test.ts`
Expected: FAIL — `../server.js` does not exist; plugin file not written; `.mjs` gets rewritten; resolveId hook missing.

- [ ] **Step 3: Create `actions/server.ts`**

```ts
/**
 * @beatzball/litro/actions/server — SERVER-ONLY action utilities.
 * Touches node:crypto (Task 7 adds cookie/CSRF helpers here). Page modules
 * may import it (the fetcher runs server-side); the Vite actions plugin
 * replaces this module with throwing stubs in client builds.
 */
import { hashActionId } from './hash.js';
import { ACTION_ID } from './client.js';
import type { ActionModuleEntry } from './handler.js';

/** Called at Nitro boot by the generated server/plugins/litro-actions.ts:
 *  stamps every scanned function export with its wire id so actionUrl()
 *  resolves during SSR. Mirrors the handler registry's enumeration exactly. */
export function stampActionIds(entries: ActionModuleEntry[]): void {
  for (const { relPath, module } of entries) {
    for (const exportName of Object.keys(module)) {
      const value = module[exportName];
      if (typeof value !== 'function') continue;
      if ((value as unknown as Record<symbol, unknown>)[ACTION_ID] !== undefined) continue;
      Object.defineProperty(value, ACTION_ID, {
        value: hashActionId(relPath, exportName),
        enumerable: false,
      });
    }
  }
}
```

- [ ] **Step 4: Extend the Nitro plugin (`plugins/actions.ts`)**

Add next to the existing stub constants and source:

```ts
const RUNTIME_PLUGIN_REL = join('server', 'plugins', 'litro-actions.ts');

const RUNTIME_PLUGIN_SOURCE = `// @ts-nocheck
// @generated by litro action scanner — do not edit
// Auto-loaded by Nitro at startup (server/plugins/). Stamps every scanned
// action export with its wire id so actionUrl() works during SSR.
import { stampActionIds } from '@beatzball/litro/actions/server';
import { actionModules } from '#litro/action-manifest';

export default function litroActionsStampPlugin() {
  stampActionIds(actionModules);
}
`;
```

In `runScan()`, after the two existing `writeStub` calls:

```ts
    await writeStub(rootDir, RUNTIME_PLUGIN_REL, RUNTIME_PLUGIN_SOURCE);
```

Fix `toRelativeImportSpecifier` (v1 follow-up: a `.mjs` file imported as `.js` fails resolution):

```ts
function toRelativeImportSpecifier(fromFile: string, toFile: string): string {
  const rel = relative(join(fromFile, '..'), toFile).replace(/\.(ts|tsx)$/, '.js');
  return rel.startsWith('.') ? rel : `./${rel}`;
}
```

- [ ] **Step 5: Add the client stub to the Vite plugin (`vite/actions.ts`)**

Add module-level constants and two hooks inside the returned plugin object:

```ts
const SERVER_SUBPATH = '@beatzball/litro/actions/server';
const SERVER_SUBPATH_STUB_ID = '\0litro:actions-server-stub';

const SERVER_SUBPATH_STUB = `// @generated by litro:actions — browser stub for a server-only module
const serverOnly = (name) => () => {
  throw new Error('[litro] ' + name + '() is server-only — call it inside definePageData or other server code.');
};
export const csrfToken = serverOnly('csrfToken');
export const getFormErrors = serverOnly('getFormErrors');
export const setFormErrorCookie = serverOnly('setFormErrorCookie');
export const verifyCsrfToken = serverOnly('verifyCsrfToken');
export const stampActionIds = serverOnly('stampActionIds');
export const CSRF_COOKIE = '__Host-litro-csrf';
export const FORM_ERROR_COOKIE = 'litro-form-error';
`;
```

```ts
    resolveId(id) {
      if (id === SERVER_SUBPATH) return SERVER_SUBPATH_STUB_ID;
    },

    load(id) {
      if (id === SERVER_SUBPATH_STUB_ID) return SERVER_SUBPATH_STUB;
    },
```

(The stub already exports the Task 7 helper names so this file is touched once.)

- [ ] **Step 6: Add the subpath export and gitignore entry**

In `packages/framework/package.json` `"exports"`, add after the `"./actions/handler"` entry, mirroring its exact condition order:

```json
    "./actions/server": {
      "source": "./src/actions/server.ts",
      "import": "./dist/actions/server.js",
      "types": "./dist/actions/server.d.ts"
    },
```

In the repo-root `.gitignore`, next to the existing `playground*/server/stubs/` line, add:

```
playground*/server/plugins/litro-actions.ts
```

- [ ] **Step 7: Run tests to verify they pass, then full suite + build, commit**

Run: `pnpm --filter @beatzball/litro exec vitest run src/actions src/plugins src/vite`
Expected: PASS.
Run: `pnpm --filter @beatzball/litro test && pnpm --filter @beatzball/litro build`
Expected: PASS / clean emit.

```bash
git add packages/framework/src/actions/server.ts packages/framework/src/plugins/actions.ts packages/framework/src/vite/actions.ts packages/framework/package.json .gitignore packages/framework/src/actions/__tests__/server.test.ts packages/framework/src/plugins/__tests__/actions.test.ts packages/framework/src/vite/__tests__/actions-plugin.test.ts
git commit -m "feat(actions): server-side id stamping via generated runtime plugin; keep .mjs specifiers"
```

---

### Task 6: `formDataToObject` + `ActionConfig` csrf/form fields

**Files:**
- Create: `packages/framework/src/actions/form-data.ts`
- Modify: `packages/framework/src/actions/define.ts`
- Test: `packages/framework/src/actions/__tests__/form-data.test.ts` (create)
- Test: `packages/framework/src/actions/__tests__/define.test.ts` (extend)

**Interfaces:**
- Produces: `CSRF_FIELD = '_litro_csrf'` and `formDataToObject(fd: FormData): Record<string, unknown>` (repeated names → arrays, `File` passes through, `CSRF_FIELD` stripped) in isomorphic `form-data.ts`. `ActionConfig` gains `csrf?: 'origin' | 'token'` (default `'origin'`) and `form?: { redirect?: string }`.

- [ ] **Step 1: Write the failing tests**

Create `packages/framework/src/actions/__tests__/form-data.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { formDataToObject, CSRF_FIELD } from '../form-data.js';

describe('formDataToObject', () => {
  it('converts single fields, collapses repeats into arrays, passes Files through', () => {
    const fd = new FormData();
    fd.append('title', 'hello');
    fd.append('tag', 'a');
    fd.append('tag', 'b');
    fd.append('tag', 'c');
    const file = new File(['x'], 'x.txt', { type: 'text/plain' });
    fd.append('attachment', file);
    const obj = formDataToObject(fd);
    expect(obj.title).toBe('hello');
    expect(obj.tag).toEqual(['a', 'b', 'c']);
    expect(obj.attachment).toBe(file);
  });

  it(`strips the ${'_litro_csrf'} token field`, () => {
    const fd = new FormData();
    fd.append('name', 'x');
    fd.append(CSRF_FIELD, 'token-value');
    expect(formDataToObject(fd)).toEqual({ name: 'x' });
  });
});
```

In `define.test.ts` add:

```ts
it('carries csrf and form config through ACTION_CONFIG', () => {
  const action = defineAction({
    csrf: 'token',
    form: { redirect: '/thanks' },
    async handler() {
      return 'ok';
    },
  });
  const config = action[ACTION_CONFIG];
  expect(config.csrf).toBe('token');
  expect(config.form?.redirect).toBe('/thanks');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @beatzball/litro exec vitest run src/actions/__tests__/form-data.test.ts src/actions/__tests__/define.test.ts`
Expected: FAIL — module and config fields missing.

- [ ] **Step 3: Create `form-data.ts`**

```ts
/**
 * FormData → action-input conversion. ISOMORPHIC — used by both the browser
 * form enhancer and the server form-mode handler; keep free of Node imports.
 * Repeated field names collapse into arrays; File values pass through
 * (seroval serializes Blobs on the enhanced path; the no-JS path receives
 * them from readFormData directly). The CSRF token field is stripped on both
 * paths — it is transport metadata, and a strict input schema would
 * otherwise reject it as an unknown key.
 */
export const CSRF_FIELD = '_litro_csrf';

export function formDataToObject(fd: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of fd.entries()) {
    if (key === CSRF_FIELD) continue;
    const existing = out[key];
    if (existing === undefined) out[key] = value;
    else if (Array.isArray(existing)) existing.push(value);
    else out[key] = [existing, value];
  }
  return out;
}
```

- [ ] **Step 4: Extend `ActionConfig` in `define.ts`**

```ts
export interface ActionFormConfig {
  /** Success-redirect target for no-JS form posts (PRG). Defaults to the
   *  request's Referer, then '/'. */
  redirect?: string;
}

export interface ActionConfig<In, Out> {
  input?: StandardSchemaV1<unknown, In>;
  /** CSRF mode for form-mode requests. 'origin' (default): Origin/
   *  Sec-Fetch-Site checks only. 'token': additionally require the
   *  __Host-litro-csrf double-submit cookie to match the _litro_csrf field. */
  csrf?: 'origin' | 'token';
  form?: ActionFormConfig;
  handler: (input: In, ctx: ActionContext) => Out | Promise<Out>;
}
```

- [ ] **Step 5: Run tests to verify they pass, commit**

Run: `pnpm --filter @beatzball/litro exec vitest run src/actions/__tests__/form-data.test.ts src/actions/__tests__/define.test.ts`
Expected: PASS.

```bash
git add packages/framework/src/actions/form-data.ts packages/framework/src/actions/define.ts packages/framework/src/actions/__tests__/form-data.test.ts packages/framework/src/actions/__tests__/define.test.ts
git commit -m "feat(actions): formDataToObject and csrf/form action config"
```

---

### Task 7: CSRF token + form-error cookie helpers (`actions/server.ts`)

**Files:**
- Modify: `packages/framework/src/actions/server.ts`
- Test: `packages/framework/src/actions/__tests__/server.test.ts` (extend)

**Interfaces:**
- Consumes: h3 `getCookie`/`setCookie`/`deleteCookie`; `node:crypto` `randomBytes`/`timingSafeEqual`.
- Produces (all from `@beatzball/litro/actions/server`): `CSRF_COOKIE = '__Host-litro-csrf'`; `FORM_ERROR_COOKIE = 'litro-form-error'`; `csrfToken(event): string` (mints + sets cookie when absent); `verifyCsrfToken(event, submitted: unknown): boolean` (constant-time); `interface FormErrors { actionId: string; issues?: unknown[]; message?: string; status?: number }`; `getFormErrors(event): FormErrors | null` (reads + clears the one-shot cookie); `setFormErrorCookie(event, errors: FormErrors): void`.

- [ ] **Step 1: Write the failing tests**

Extend `server.test.ts` with a real-HTTP-server block (mirror `handler.test.ts` setup):

```ts
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp, createRouter, defineEventHandler, toNodeListener } from 'h3';
import { beforeAll, afterAll } from 'vitest';
import {
  csrfToken,
  verifyCsrfToken,
  getFormErrors,
  setFormErrorCookie,
  CSRF_COOKIE,
  FORM_ERROR_COOKIE,
} from '../server.js';

describe('csrf + form-error cookies', () => {
  let server: Server;
  let base: string;

  beforeAll(async () => {
    const app = createApp();
    const router = createRouter();
    router.get('/token', defineEventHandler((event) => ({ token: csrfToken(event) })));
    router.get(
      '/verify',
      defineEventHandler((event) => ({
        ok: verifyCsrfToken(event, new URL(`http://x${event.path}`).searchParams.get('t')),
      })),
    );
    router.get(
      '/set-errors',
      defineEventHandler((event) => {
        setFormErrorCookie(event, { actionId: 'abc123def456', issues: [{ message: 'Name is required' }] });
        return 'ok';
      }),
    );
    router.get('/read-errors', defineEventHandler((event) => ({ errors: getFormErrors(event) })));
    app.use(router);
    server = createServer(toNodeListener(app));
    await new Promise<void>((resolve) => server.listen(0, resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  it('mints a __Host- cookie with Secure, Path=/, HttpOnly, SameSite=Lax', async () => {
    const res = await fetch(`${base}/token`);
    const setCookie = res.headers.get('set-cookie') ?? '';
    const { token } = (await res.json()) as { token: string };
    expect(token.length).toBeGreaterThanOrEqual(32);
    expect(setCookie).toContain(`${CSRF_COOKIE}=${token}`);
    expect(setCookie).toContain('Path=/');
    expect(setCookie).toContain('Secure');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Lax');
  });

  it('returns the existing token without re-setting the cookie', async () => {
    const first = await fetch(`${base}/token`);
    const { token } = (await first.json()) as { token: string };
    const second = await fetch(`${base}/token`, { headers: { cookie: `${CSRF_COOKIE}=${token}` } });
    expect(((await second.json()) as { token: string }).token).toBe(token);
    expect(second.headers.get('set-cookie')).toBeNull();
  });

  it('verifyCsrfToken matches only the exact cookie value', async () => {
    const okRes = await fetch(`${base}/verify?t=tok-1`, { headers: { cookie: `${CSRF_COOKIE}=tok-1` } });
    expect(((await okRes.json()) as { ok: boolean }).ok).toBe(true);
    const badRes = await fetch(`${base}/verify?t=wrong`, { headers: { cookie: `${CSRF_COOKIE}=tok-1` } });
    expect(((await badRes.json()) as { ok: boolean }).ok).toBe(false);
    const noneRes = await fetch(`${base}/verify?t=tok-1`);
    expect(((await noneRes.json()) as { ok: boolean }).ok).toBe(false);
  });

  it('form-error cookie round-trips once and is cleared on read', async () => {
    const set = await fetch(`${base}/set-errors`);
    const setCookie = set.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain(`${FORM_ERROR_COOKIE}=`);
    expect(setCookie).toContain('Max-Age=30');
    expect(setCookie).not.toContain('HttpOnly');
    const cookiePair = setCookie.split(';')[0];
    const read = await fetch(`${base}/read-errors`, { headers: { cookie: cookiePair } });
    const { errors } = (await read.json()) as { errors: { actionId: string; issues: { message: string }[] } };
    expect(errors.actionId).toBe('abc123def456');
    expect(errors.issues[0].message).toBe('Name is required');
    // read handler must clear the cookie (expiry set-cookie in the response)
    expect(read.headers.get('set-cookie')).toContain(`${FORM_ERROR_COOKIE}=`);
  });

  it('getFormErrors returns null for absent or malformed cookies', async () => {
    const none = await fetch(`${base}/read-errors`);
    expect(((await none.json()) as { errors: unknown }).errors).toBeNull();
    const bad = await fetch(`${base}/read-errors`, {
      headers: { cookie: `${FORM_ERROR_COOKIE}=not-json` },
    });
    expect(((await bad.json()) as { errors: unknown }).errors).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @beatzball/litro exec vitest run src/actions/__tests__/server.test.ts`
Expected: FAIL — helpers not exported.

- [ ] **Step 3: Implement in `actions/server.ts`**

Extend imports and append:

```ts
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { getCookie, setCookie, deleteCookie, type H3Event } from 'h3';
```

```ts
export const CSRF_COOKIE = '__Host-litro-csrf';
export const FORM_ERROR_COOKIE = 'litro-form-error';

/** Returns the current CSRF token, minting + setting the __Host- cookie when
 *  absent. Call inside definePageData fetchers for pages that render
 *  csrf:'token' forms, and put the value in
 *  <input type="hidden" name="_litro_csrf" value=...>.
 *  __Host- requires Secure + Path=/ and no Domain; browsers treat
 *  http://localhost as trustworthy, so dev works. */
export function csrfToken(event: H3Event): string {
  const existing = getCookie(event, CSRF_COOKIE);
  if (existing) return existing;
  const token = randomBytes(32).toString('base64url');
  setCookie(event, CSRF_COOKIE, token, {
    path: '/',
    secure: true,
    httpOnly: true,
    sameSite: 'lax',
  });
  return token;
}

/** Constant-time double-submit comparison: the _litro_csrf form field must
 *  equal the __Host-litro-csrf cookie. */
export function verifyCsrfToken(event: H3Event, submitted: unknown): boolean {
  const cookie = getCookie(event, CSRF_COOKIE);
  if (!cookie || typeof submitted !== 'string' || submitted.length === 0) return false;
  const a = Buffer.from(cookie);
  const b = Buffer.from(submitted);
  return a.length === b.length && timingSafeEqual(a, b);
}

export interface FormErrors {
  actionId: string;
  issues?: unknown[];
  message?: string;
  status?: number;
}

/** One-shot PRG error transport. HttpOnly is off by design: the payload is
 *  already client-visible data, and enhanced clients may read it too. */
export function setFormErrorCookie(event: H3Event, errors: FormErrors): void {
  setCookie(event, FORM_ERROR_COOKIE, JSON.stringify(errors), {
    path: '/',
    sameSite: 'lax',
    maxAge: 30,
    httpOnly: false,
  });
}

/** Reads and clears the one-shot error cookie set by a failed form post —
 *  call inside definePageData so the re-rendered page can surface issues. */
export function getFormErrors(event: H3Event): FormErrors | null {
  const raw = getCookie(event, FORM_ERROR_COOKIE);
  if (!raw) return null;
  deleteCookie(event, FORM_ERROR_COOKIE, { path: '/' });
  try {
    return JSON.parse(raw) as FormErrors;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass, commit**

Run: `pnpm --filter @beatzball/litro exec vitest run src/actions/__tests__/server.test.ts`
Expected: PASS.

```bash
git add packages/framework/src/actions/server.ts packages/framework/src/actions/__tests__/server.test.ts
git commit -m "feat(actions): csrfToken, verifyCsrfToken and one-shot form-error cookie helpers"
```

---

### Task 8: Form-mode endpoint (handler branch, PRG, x-forwarded-host)

**Files:**
- Create: `packages/framework/src/actions/form.ts`
- Modify: `packages/framework/src/actions/handler.ts`
- Test: `packages/framework/src/actions/__tests__/form-mode.test.ts` (create)

**Interfaces:**
- Consumes: `readFormData`, `sendRedirect`, `getRequestHeader` (h3); `ACTION_CONFIG`, `runAction` (define.ts); `formDataToObject`, `CSRF_FIELD` (Task 6); `verifyCsrfToken`, `setFormErrorCookie` (Task 7); `isAsyncIterable` (Task 1); `LitroActionError`.
- Produces: `isFormContentType(contentType: string | undefined): boolean` and `handleFormMode(event: H3Event, actionId: string, fn: (...args: unknown[]) => unknown): Promise<unknown>` in `form.ts`. Handler behavior: form-content-type requests skip the `x-litro-action` header gate (other gates still apply); Origin gate compares against the first `x-forwarded-host` value when present, else `host`; form mode requires `defineAction` with an `input` schema (else 400), enforces token mode (403), runs PRG (success → 303 `form.redirect ?? Referer ?? '/'`; validation failure / handler throw → error cookie + 303 `Referer ?? '/'`), honors `event.handled`, and 400s streaming results.

- [ ] **Step 1: Write the failing tests**

Create `packages/framework/src/actions/__tests__/form-mode.test.ts` (real-server harness like `handler.test.ts`):

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp, createRouter, toNodeListener } from 'h3';
import { createActionHandler, type ActionModuleEntry } from '../handler.js';
import { defineAction } from '../define.js';
import { hashActionId } from '../hash.js';
import { CSRF_COOKIE, FORM_ERROR_COOKIE } from '../server.js';
import type { StandardSchemaV1 } from '../standard-schema.js';

interface EntryInput {
  name: string;
  tags?: string[];
}

// Strict schema: rejects unknown keys, so a leaked _litro_csrf field fails it.
const entrySchema: StandardSchemaV1<unknown, EntryInput> = {
  '~standard': {
    version: 1,
    vendor: 'litro-test',
    validate(value) {
      const v = value as Record<string, unknown> | null;
      if (!v || typeof v !== 'object') return { issues: [{ message: 'Expected an object' }] };
      const issues: { message: string }[] = [];
      if (typeof v.name !== 'string' || v.name === '') issues.push({ message: 'Name is required' });
      for (const k of Object.keys(v)) {
        if (k !== 'name' && k !== 'tags') issues.push({ message: `Unknown field: ${k}` });
      }
      if (issues.length) return { issues };
      return { value: v as unknown as EntryInput };
    },
  },
};

const seen: EntryInput[] = [];
const formAction = defineAction({
  input: entrySchema,
  form: { redirect: '/after' },
  async handler(input) {
    seen.push(input);
    return { count: seen.length };
  },
});
const tokenAction = defineAction({
  input: entrySchema,
  csrf: 'token',
  async handler(input) {
    seen.push(input);
    return { count: seen.length };
  },
});
const noSchemaAction = defineAction({
  async handler() {
    return 'x';
  },
});
const noRedirectAction = defineAction({
  input: entrySchema,
  async handler(input) {
    seen.push(input);
    return 'ok';
  },
});
const throwingAction = defineAction({
  input: entrySchema,
  async handler(): Promise<never> {
    throw new Error('db exploded');
  },
});
const streamingAction = defineAction({
  input: entrySchema,
  async *handler() {
    yield 1;
  },
});
async function plainFn(): Promise<string> {
  return 'plain';
}

const REL = 'actions/forms.server';
const module = { formAction, tokenAction, noSchemaAction, noRedirectAction, throwingAction, streamingAction, plainFn };
const entries: ActionModuleEntry[] = [{ relPath: REL, module }];
const id = (name: string) => hashActionId(REL, name);

let server: Server;
let base: string;

beforeAll(async () => {
  const app = createApp();
  const router = createRouter();
  router.post('/__litro/action/:id', createActionHandler(entries));
  app.use(router);
  server = createServer(toNodeListener(app));
  await new Promise<void>((resolve) => server.listen(0, resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

function postForm(actionName: string, fields: Record<string, string | string[]>, headers: Record<string, string> = {}) {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(fields)) {
    for (const item of Array.isArray(v) ? v : [v]) body.append(k, item);
  }
  return fetch(`${base}/__litro/action/${id(actionName)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', ...headers },
    body: body.toString(),
    redirect: 'manual',
  });
}

describe('form mode', () => {
  it('does not require the x-litro-action header for form posts', async () => {
    const res = await postForm('formAction', { name: 'Ada' });
    expect(res.status).toBe(303);
  });

  it('valid post redirects to form.redirect', async () => {
    const res = await postForm('formAction', { name: 'Ada' });
    expect(res.headers.get('location')).toBe('/after');
  });

  it('falls back to Referer, then /, for the success redirect', async () => {
    const withReferer = await postForm('noRedirectAction', { name: 'x' }, { referer: `${base}/somewhere` });
    expect(withReferer.status).toBe(303);
    expect(withReferer.headers.get('location')).toBe(`${base}/somewhere`);
    const bare = await postForm('noRedirectAction', { name: 'x' });
    expect(bare.headers.get('location')).toBe('/');
  });

  it('validation failure bounces 303 to Referer with the one-shot issues cookie', async () => {
    const res = await postForm('formAction', { name: '' }, { referer: `${base}/forms` });
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe(`${base}/forms`);
    const cookie = res.headers.get('set-cookie') ?? '';
    expect(cookie).toContain(`${FORM_ERROR_COOKIE}=`);
    const raw = decodeURIComponent(cookie.split(`${FORM_ERROR_COOKIE}=`)[1].split(';')[0]);
    const parsed = JSON.parse(raw) as { actionId: string; issues: { message: string }[] };
    expect(parsed.actionId).toBe(id('formAction'));
    expect(parsed.issues[0].message).toBe('Name is required');
  });

  it('handler throw bounces 303 with message/status in the cookie', async () => {
    const res = await postForm('throwingAction', { name: 'Ada' }, { referer: `${base}/forms` });
    expect(res.status).toBe(303);
    const cookie = res.headers.get('set-cookie') ?? '';
    const raw = decodeURIComponent(cookie.split(`${FORM_ERROR_COOKIE}=`)[1].split(';')[0]);
    const parsed = JSON.parse(raw) as { message: string; status: number };
    expect(parsed.message).toBe('db exploded');
    expect(parsed.status).toBe(500);
  });

  it('repeated fields arrive as arrays and _litro_csrf is stripped', async () => {
    seen.length = 0;
    const res = await postForm('formAction', { name: 'Ada', tags: ['a', 'b'], _litro_csrf: 'tok' });
    expect(res.status).toBe(303); // strict schema passed → token field was stripped
    expect(seen[0]).toEqual({ name: 'Ada', tags: ['a', 'b'] });
  });

  it('plain-function and schema-less targets get 400 with an explanation', async () => {
    for (const name of ['plainFn', 'noSchemaAction']) {
      const res = await postForm(name, { name: 'x' });
      expect(res.status).toBe(400);
      const body = (await res.json()) as { message: string };
      expect(body.message).toContain('input schema');
    }
  });

  it('token mode: missing token 403, wrong token 403, matching token 303', async () => {
    const missing = await postForm('tokenAction', { name: 'x' });
    expect(missing.status).toBe(403);
    const wrong = await postForm('tokenAction', { name: 'x', _litro_csrf: 'bad' }, { cookie: `${CSRF_COOKIE}=good` });
    expect(wrong.status).toBe(403);
    const ok = await postForm('tokenAction', { name: 'x', _litro_csrf: 'good' }, { cookie: `${CSRF_COOKIE}=good` });
    expect(ok.status).toBe(303);
  });

  it('streaming actions invoked via form mode get 400', async () => {
    const res = await postForm('streamingAction', { name: 'x' });
    expect(res.status).toBe(400);
  });

  it('Origin gate honors x-forwarded-host (both modes)', async () => {
    const pass = await postForm('formAction', { name: 'x' }, {
      origin: 'https://public.example',
      'x-forwarded-host': 'public.example, internal:3000',
    });
    expect(pass.status).toBe(303);
    const fail = await postForm('formAction', { name: 'x' }, {
      origin: 'https://evil.example',
      'x-forwarded-host': 'public.example',
    });
    expect(fail.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @beatzball/litro exec vitest run src/actions/__tests__/form-mode.test.ts`
Expected: FAIL — form posts get 403 (missing `x-litro-action` header).

- [ ] **Step 3: Create `actions/form.ts`**

```ts
/**
 * Form-mode handling for POST /__litro/action/:id — the no-JS progressive
 * enhancement path (spec section 2.3). SERVER-ONLY.
 *
 * Error-surface split:
 *   - Misconfiguration (plain-function target, schema-less defineAction,
 *     streaming result) and CSRF-token failures THROW LitroActionError —
 *     handler.ts turns them into plain JSON 400/403 responses. These are
 *     developer errors or attack traffic, not end-user flows.
 *   - Validation failures and handler throws PRG-bounce: one-shot
 *     litro-form-error cookie + 303 back to the Referer, so the re-rendered
 *     page can surface them via getFormErrors().
 */
import { readFormData, sendRedirect, getRequestHeader, type H3Event } from 'h3';
import { ACTION_CONFIG, runAction, type ActionConfig } from './define.js';
import { LitroActionError } from './error.js';
import { formDataToObject, CSRF_FIELD } from './form-data.js';
import { isAsyncIterable } from './serialize.js';
import { setFormErrorCookie, verifyCsrfToken } from './server.js';

export function isFormContentType(contentType: string | undefined): boolean {
  if (!contentType) return false;
  return (
    contentType.includes('application/x-www-form-urlencoded') ||
    contentType.includes('multipart/form-data')
  );
}

export async function handleFormMode(
  event: H3Event,
  actionId: string,
  fn: (...args: unknown[]) => unknown,
): Promise<unknown> {
  const config = (fn as unknown as Record<symbol, unknown>)[ACTION_CONFIG] as
    | ActionConfig<unknown, unknown>
    | undefined;
  if (!config?.input) {
    throw new LitroActionError(
      'Form posts require a defineAction export with an input schema — form fields ' +
        'are untrusted strings and the schema is the parse boundary.',
      { status: 400 },
    );
  }

  const fd = await readFormData(event);
  if (config.csrf === 'token' && !verifyCsrfToken(event, fd.get(CSRF_FIELD))) {
    throw new LitroActionError('Invalid or missing CSRF token', { status: 403 });
  }

  const input = formDataToObject(fd);
  const referer = getRequestHeader(event, 'referer');

  let result: unknown;
  try {
    result = await runAction(config, input, { event });
  } catch (err) {
    if (err instanceof LitroActionError && err.issues) {
      setFormErrorCookie(event, { actionId, issues: err.issues });
    } else {
      const e = err instanceof Error ? err : new Error(String(err));
      const status = err instanceof LitroActionError ? err.status : 500;
      setFormErrorCookie(event, { actionId, message: e.message, status });
    }
    return sendRedirect(event, referer ?? '/', 303);
  }

  // Escape hatch: the handler wrote its own response via ctx.event.
  if (event.handled) return undefined;

  if (isAsyncIterable(result)) {
    throw new LitroActionError('Streaming actions cannot respond to form posts', { status: 400 });
  }

  return sendRedirect(event, config.form?.redirect ?? referer ?? '/', 303);
}
```

- [ ] **Step 4: Rework the gates and add the branch in `handler.ts`**

Add the import:

```ts
import { isFormContentType, handleFormMode } from './form.js';
```

Inside `defineEventHandler`, replace the gate section's beginning:

```ts
    const formMode = isFormContentType(getRequestHeader(event, 'content-type'));

    // --- CSRF gates -------------------------------------------------------
    // Form posts cannot carry custom headers; the header gate applies to RPC
    // mode only. Sec-Fetch-Site and Origin/Host checks apply to both modes.
    if (!formMode && getRequestHeader(event, 'x-litro-action') !== '1') {
      return sendError(event, new LitroActionError('Missing x-litro-action header', { status: 403 }));
    }
```

In the Origin/Host gate, replace the `host` line:

```ts
    // Behind proxies that rewrite Host, the public host arrives in
    // x-forwarded-host (first value wins). Only trustworthy at the platform
    // level — Nitro presets set it appropriately.
    const forwardedHost = getRequestHeader(event, 'x-forwarded-host');
    const host = forwardedHost?.split(',')[0]?.trim() || getRequestHeader(event, 'host');
```

After the registry lookup (`if (!fn) { ... 404 ... }`), before the deserialize section:

```ts
    // --- Form mode (no-JS progressive enhancement) -------------------------
    if (formMode) {
      try {
        return await handleFormMode(event, id, fn);
      } catch (err) {
        return sendError(event, err);
      }
    }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @beatzball/litro exec vitest run src/actions/__tests__/form-mode.test.ts src/actions/__tests__/handler.test.ts`
Expected: PASS — all form-mode tests plus every pre-existing handler test (RPC mode unchanged).

- [ ] **Step 6: Full unit suite + build, commit**

Run: `pnpm --filter @beatzball/litro test && pnpm --filter @beatzball/litro build`
Expected: PASS / clean emit.

```bash
git add packages/framework/src/actions/form.ts packages/framework/src/actions/handler.ts packages/framework/src/actions/__tests__/form-mode.test.ts
git commit -m "feat(actions): no-JS form mode with PRG flow, token CSRF and x-forwarded-host gate"
```

---

### Task 9: Form enhancer (`actions/form-client.ts`)

**Files:**
- Create: `packages/framework/src/actions/form-client.ts`
- Modify: `packages/framework/package.json` (exports)
- Test: `packages/framework/src/actions/__tests__/form-client.test.ts` (create)

**Interfaces:**
- Consumes: `callAction` (client.ts), `formDataToObject` (form-data.ts), `LitroActionError`.
- Produces: `enhanceForms(root: Document | ShadowRoot | Element = document): () => void` — delegated submit listener; intercepts forms whose `action` attribute path matches `/__litro/action/<12 hex>`, prevents default, converts `FormData` (token field stripped by `formDataToObject`), calls `callAction(id, [input])`, dispatches `litro:action-success` (detail = result) or `litro:action-error` (detail = the `LitroActionError`) on the form with `bubbles: true, composed: true`. Returns a detach function. Subpath `@beatzball/litro/actions/form-client`.

- [ ] **Step 1: Write the failing tests**

Create `packages/framework/src/actions/__tests__/form-client.test.ts`:

```ts
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { enhanceForms } from '../form-client.js';
import { serializeValue } from '../serialize.js';
import { LitroActionError } from '../error.js';

const fetchMock = vi.fn();
let detach: (() => void) | undefined;

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  document.body.innerHTML = '';
});
afterEach(() => {
  detach?.();
  detach = undefined;
  vi.unstubAllGlobals();
});

function okResponse(value: unknown) {
  return new Response(serializeValue(value), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function buildForm(action: string, fields: Record<string, string | string[]>): HTMLFormElement {
  const form = document.createElement('form');
  form.setAttribute('method', 'post');
  form.setAttribute('action', action);
  for (const [name, v] of Object.entries(fields)) {
    for (const value of Array.isArray(v) ? v : [v]) {
      const input = document.createElement('input');
      input.name = name;
      input.value = value;
      form.appendChild(input);
    }
  }
  document.body.appendChild(form);
  return form;
}

function submit(form: HTMLFormElement): Event {
  const e = new Event('submit', { bubbles: true, cancelable: true });
  form.dispatchEvent(e);
  return e;
}

const ACTION = '/__litro/action/abc123def456';

describe('enhanceForms', () => {
  it('intercepts action forms and performs the RPC with converted input', async () => {
    detach = enhanceForms();
    fetchMock.mockResolvedValue(okResponse({ count: 1 }));
    const form = buildForm(ACTION, { name: 'Ada', tag: ['a', 'b'], _litro_csrf: 'tok' });
    const e = submit(form);
    expect(e.defaultPrevented).toBe(true);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(ACTION);
    // args = [input]; token field stripped, repeats collapsed to array
    const { deserializeValue } = await import('../serialize.js');
    expect(deserializeValue(init.body as string)).toEqual([{ name: 'Ada', tag: ['a', 'b'] }]);
  });

  it('dispatches litro:action-success with the result, bubbling and composed', async () => {
    detach = enhanceForms();
    fetchMock.mockResolvedValue(okResponse({ count: 7 }));
    const form = buildForm(ACTION, { name: 'Ada' });
    const events: CustomEvent[] = [];
    document.addEventListener('litro:action-success', (e) => events.push(e as CustomEvent));
    submit(form);
    await vi.waitFor(() => expect(events).toHaveLength(1));
    expect(events[0].detail).toEqual({ count: 7 });
    expect(events[0].composed).toBe(true);
  });

  it('dispatches litro:action-error with the LitroActionError', async () => {
    detach = enhanceForms();
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ name: 'LitroActionError', message: 'Action input validation failed', status: 400, issues: [{ message: 'Name is required' }] }),
        { status: 400, headers: { 'content-type': 'application/json' } },
      ),
    );
    const form = buildForm(ACTION, { name: '' });
    const events: CustomEvent[] = [];
    form.addEventListener('litro:action-error', (e) => events.push(e as CustomEvent));
    submit(form);
    await vi.waitFor(() => expect(events).toHaveLength(1));
    expect(events[0].detail).toBeInstanceOf(LitroActionError);
    expect((events[0].detail as LitroActionError).issues).toEqual([{ message: 'Name is required' }]);
  });

  it('ignores non-action forms', () => {
    detach = enhanceForms();
    const form = buildForm('/regular/endpoint', { name: 'x' });
    const e = submit(form);
    expect(e.defaultPrevented).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('attaches to a shadow root (submit is composed:false and never reaches document)', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });
    const form = document.createElement('form');
    form.setAttribute('action', ACTION);
    shadow.appendChild(form);

    const documentDetach = enhanceForms();
    const e1 = new Event('submit', { bubbles: true, cancelable: true });
    form.dispatchEvent(e1);
    expect(e1.defaultPrevented).toBe(false); // document listener cannot see it
    documentDetach();

    detach = enhanceForms(shadow);
    fetchMock.mockResolvedValue(okResponse('ok'));
    const e2 = new Event('submit', { bubbles: true, cancelable: true });
    form.dispatchEvent(e2);
    expect(e2.defaultPrevented).toBe(true);
  });

  it('the detach function removes the listener', () => {
    const off = enhanceForms();
    off();
    const form = buildForm(ACTION, { name: 'x' });
    const e = submit(form);
    expect(e.defaultPrevented).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @beatzball/litro exec vitest run src/actions/__tests__/form-client.test.ts`
Expected: FAIL — `../form-client.js` does not exist.

- [ ] **Step 3: Create `actions/form-client.ts`**

```ts
/**
 * Progressive-enhancement form client. BROWSER-ONLY, framework-agnostic:
 * one delegated submit listener upgrades any <form action="/__litro/action/...">
 * to a seroval RPC and reports the outcome via CustomEvents on the form
 * (litro:action-success / litro:action-error, both bubbling and composed).
 * Without this module (or without JS at all) the same form posts natively
 * and the server answers with the PRG flow.
 *
 * NOTE: 'submit' events are composed:false — they never cross shadow-root
 * boundaries. enhanceForms() on document covers light-DOM forms; components
 * that render forms inside shadow roots call enhanceForms(this.renderRoot).
 */
import { callAction } from './client.js';
import { formDataToObject } from './form-data.js';

const ACTION_PATH_RE = /^\/__litro\/action\/([0-9a-f]{12})$/;

export function enhanceForms(root: Document | ShadowRoot | Element = document): () => void {
  const listener = (e: Event): void => {
    onSubmit(e);
  };
  root.addEventListener('submit', listener);
  return () => root.removeEventListener('submit', listener);
}

function onSubmit(e: Event): void {
  const form = e.target;
  if (!(form instanceof HTMLFormElement)) return;
  const action = form.getAttribute('action') ?? '';
  const path = action.startsWith('/') ? action.split('?')[0] : new URL(action, location.href).pathname;
  const match = ACTION_PATH_RE.exec(path);
  if (!match) return;
  e.preventDefault();
  // formDataToObject strips the _litro_csrf token field — the header gate
  // covers the enhanced path, and a strict schema would reject the extra key.
  const input = formDataToObject(new FormData(form));
  void submitViaRpc(form, match[1], input);
}

async function submitViaRpc(
  form: HTMLFormElement,
  id: string,
  input: Record<string, unknown>,
): Promise<void> {
  try {
    const result = await callAction(id, [input]);
    form.dispatchEvent(
      new CustomEvent('litro:action-success', { detail: result, bubbles: true, composed: true }),
    );
  } catch (err) {
    form.dispatchEvent(
      new CustomEvent('litro:action-error', { detail: err, bubbles: true, composed: true }),
    );
  }
}
```

- [ ] **Step 4: Add the subpath export**

In `packages/framework/package.json` `"exports"`, after `"./actions/server"`:

```json
    "./actions/form-client": {
      "source": "./src/actions/form-client.ts",
      "import": "./dist/actions/form-client.js",
      "types": "./dist/actions/form-client.d.ts"
    },
```

- [ ] **Step 5: Run tests to verify they pass, full suite + build, commit**

Run: `pnpm --filter @beatzball/litro exec vitest run src/actions/__tests__/form-client.test.ts && pnpm --filter @beatzball/litro test && pnpm --filter @beatzball/litro build`
Expected: PASS / clean emit.

```bash
git add packages/framework/src/actions/form-client.ts packages/framework/package.json packages/framework/src/actions/__tests__/form-client.test.ts
git commit -m "feat(actions): enhanceForms() progressive-enhancement form client"
```

---

### Task 10: Checkpoint A — independent core validation

Protocol identical to v1 (spec section 8 of the v1 design; see also the M2 spec section 6 "Checkpoints").

- [ ] **Step 1: Run the full verification battery**

Run: `pnpm --filter @beatzball/litro test && pnpm --filter @beatzball/litro build && pnpm --filter @beatzball/litro-router test`
Expected: everything green.

- [ ] **Step 2: Dispatch one or more independent validation subagents** (they must not have produced the code). Their brief, verbatim claims to verify against the actual codebase:

1. Every export named in this plan's Interfaces blocks (Tasks 1-9) exists with the stated signature and subpath.
2. The NDJSON protocol matches the spec: `{ n }` / `{ err }` / `{ done: true }` lines, `application/x-ndjson`, shared-refs cross-JSON, no code-eval seroval API anywhere (`grep -rn "crossSerialize\|fromCrossJSON\|toCrossJSON" packages/framework/src` — only the JSON-data trio may appear).
3. RPC mode is byte-for-byte unchanged for single-shot actions (existing v1 tests untouched and passing).
4. Form mode enforces: schema requirement, token compare, PRG statuses/targets, `event.handled` escape, streaming 400, header gate skipped only for form content-types.
5. `actions/client.ts`, `form-client.ts`, `form-data.ts`, `serialize.ts`, `error.ts` import no Node-only modules (check the whole import graph).
6. Generated-file writes are all content-compared (`writeStub`) including the new `server/plugins/litro-actions.ts`.
7. Every test asserts what its name claims (no vacuous assertions).

- [ ] **Step 3: Fix all findings in place, re-run the battery, commit fixes**

```bash
git add -A && git commit -m "fix(actions): checkpoint A findings"
```

(Skip the commit if there were no findings.)

---

### Task 11: Playground integration

**Files:**
- Create: `playground/actions/forms.server.ts`
- Create: `playground/pages/forms.ts`
- Modify: `playground/app.ts`

**Interfaces:**
- Consumes: everything shipped in Tasks 1-9 via `packages/framework/dist/` (build first).
- Produces: `/forms` page with ids used by Task 12 e2e: `#form-errors`, `#guestbook-form`, `#gb-name`, `#gb-message`, `#gb-submit`, `#enhanced-result`, `#enhanced-error`, `#token-form`, `#entries`, `#stream-button`, `#stream-lines`, `#stream-fail-button`, `#stream-error`. Actions `addEntry`, `addEntryWithToken`, `listEntries`, `countdown`, `failingStream` at relPath `actions/forms.server`.

- [ ] **Step 1: Create `playground/actions/forms.server.ts`**

```ts
/**
 * Demo actions for the /forms page: guestbook writes via no-JS + enhanced
 * form posts, plus streaming demos. In-memory store — playground only.
 */
import { defineAction, type StandardSchemaV1 } from '@beatzball/litro/actions';

export interface GuestbookEntry {
  name: string;
  message: string;
  at: Date;
}

const entries: GuestbookEntry[] = [];

interface EntryInput {
  name: string;
  message: string;
}

// Hand-rolled Standard Schema (same pattern as demo.server.ts). STRICT about
// unknown keys — proves the _litro_csrf field is stripped before validation.
const entrySchema: StandardSchemaV1<unknown, EntryInput> = {
  '~standard': {
    version: 1,
    vendor: 'litro-playground',
    validate(value) {
      const v = value as Record<string, unknown> | null;
      if (!v || typeof v !== 'object') return { issues: [{ message: 'Expected an object' }] };
      const issues: { message: string }[] = [];
      if (typeof v.name !== 'string' || v.name.trim() === '') issues.push({ message: 'Name is required' });
      if (typeof v.message !== 'string' || v.message.trim() === '') issues.push({ message: 'Message is required' });
      for (const k of Object.keys(v)) {
        if (k !== 'name' && k !== 'message') issues.push({ message: `Unknown field: ${k}` });
      }
      if (issues.length > 0) return { issues };
      return { value: { name: (v.name as string).trim(), message: (v.message as string).trim() } };
    },
  },
};

export const addEntry = defineAction({
  input: entrySchema,
  form: { redirect: '/forms' },
  async handler(input) {
    entries.push({ ...input, at: new Date() });
    return { count: entries.length };
  },
});

export const addEntryWithToken = defineAction({
  input: entrySchema,
  csrf: 'token',
  form: { redirect: '/forms' },
  async handler(input) {
    entries.push({ ...input, at: new Date() });
    return { count: entries.length };
  },
});

export async function listEntries(): Promise<GuestbookEntry[]> {
  return entries.slice().reverse();
}

const countSchema: StandardSchemaV1<unknown, { from: number }> = {
  '~standard': {
    version: 1,
    vendor: 'litro-playground',
    validate(value) {
      const v = value as { from?: unknown } | null;
      const from = Number(v?.from);
      if (!Number.isInteger(from) || from < 1 || from > 10) {
        return { issues: [{ message: 'from must be an integer between 1 and 10' }] };
      }
      return { value: { from } };
    },
  },
};

export const countdown = defineAction({
  input: countSchema,
  async *handler({ from }) {
    for (let i = from; i >= 1; i--) {
      yield { i, at: new Date() };
    }
  },
});

export const failingStream = defineAction({
  input: countSchema,
  async *handler({ from }) {
    yield { i: from, at: new Date() };
    throw new Error('stream blew up');
  },
});
```

- [ ] **Step 2: Create `playground/pages/forms.ts`**

```ts
import { html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { definePageData, LitroPage } from '@beatzball/litro';
import { actionUrl } from '@beatzball/litro/actions/client';
import { enhanceForms } from '@beatzball/litro/actions/form-client';
import { csrfToken, getFormErrors, type FormErrors } from '@beatzball/litro/actions/server';
import { addEntry, addEntryWithToken, listEntries, countdown, failingStream } from '../actions/forms.server.js';

interface FormsPageData {
  errors: FormErrors | null;
  token: string;
  entries: { name: string; message: string; atIso: string }[];
}

// The worked PRG error example (spec section 5.4): a failed no-JS post 303s
// back here with the one-shot cookie; getFormErrors() reads + clears it and
// the template renders the issues above the form.
export const pageData = definePageData(async (event) => {
  const errors = getFormErrors(event);
  const token = csrfToken(event);
  const all = await listEntries();
  return {
    errors,
    token,
    entries: all.map((e) => ({ name: e.name, message: e.message, atIso: e.at.toISOString() })),
  } satisfies FormsPageData;
});

@customElement('page-forms')
export class FormsPage extends LitroPage {
  static styles = css`
    :host { display: block; padding: 1rem; font-family: system-ui, sans-serif; }
    #form-errors { color: #b91c1c; }
  `;

  @state() declare serverData: FormsPageData | null;
  @state() private enhancedResult = '';
  @state() private enhancedError = '';
  @state() private streamLines: string[] = [];
  @state() private streamError = '';

  private detachEnhancer?: () => void;

  firstUpdated(): void {
    // submit events are composed:false — the document-level enhanceForms()
    // in app.ts cannot see forms inside this shadow root, so attach locally.
    this.detachEnhancer = enhanceForms(this.renderRoot as ShadowRoot);
    this.renderRoot.addEventListener('litro:action-success', ((e: CustomEvent) => {
      this.enhancedResult = `saved entry ${(e.detail as { count: number }).count}`;
    }) as EventListener);
    this.renderRoot.addEventListener('litro:action-error', ((e: CustomEvent) => {
      const err = e.detail as { issues?: { message: string }[]; message: string };
      this.enhancedError = err.issues?.map((i) => i.message).join(', ') ?? err.message;
    }) as EventListener);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.detachEnhancer?.();
  }

  private async runStream(): Promise<void> {
    this.streamLines = [];
    const iterable = await countdown({ from: 3 });
    for await (const chunk of iterable) {
      this.streamLines = [
        ...this.streamLines,
        `${chunk.i} @ ${chunk.at instanceof Date ? chunk.at.toISOString() : 'NOT-A-DATE'}`,
      ];
    }
    this.streamLines = [...this.streamLines, 'done'];
  }

  private async runFailingStream(): Promise<void> {
    this.streamError = '';
    try {
      const iterable = await failingStream({ from: 1 });
      for await (const _chunk of iterable) {
        // drain until the mid-stream error arrives
      }
    } catch (err) {
      this.streamError = (err as Error).message;
    }
  }

  render() {
    const d = this.serverData;
    return html`
      <h1>Forms Demo</h1>

      ${d?.errors
        ? html`<ul id="form-errors">
            ${(d.errors.issues ?? []).map((i) => html`<li>${(i as { message: string }).message}</li>`)}
            ${d.errors.message ? html`<li>${d.errors.message}</li>` : ''}
          </ul>`
        : ''}

      <form id="guestbook-form" method="post" action=${actionUrl(addEntry)}>
        <input id="gb-name" name="name" placeholder="Name" />
        <input id="gb-message" name="message" placeholder="Message" />
        <button id="gb-submit">Sign</button>
      </form>
      <p id="enhanced-result">${this.enhancedResult}</p>
      <p id="enhanced-error">${this.enhancedError}</p>

      <form id="token-form" method="post" action=${actionUrl(addEntryWithToken)}>
        <input type="hidden" name="_litro_csrf" value=${d?.token ?? ''} />
        <input name="name" placeholder="Name" />
        <input name="message" placeholder="Message" />
        <button>Sign (token mode)</button>
      </form>

      <ul id="entries">
        ${(d?.entries ?? []).map((e) => html`<li>${e.name}: ${e.message}</li>`)}
      </ul>

      <button id="stream-button" @click=${this.runStream}>Stream countdown</button>
      <ol id="stream-lines">${this.streamLines.map((l) => html`<li>${l}</li>`)}</ol>
      <button id="stream-fail-button" @click=${this.runFailingStream}>Failing stream</button>
      <p id="stream-error">${this.streamError}</p>
    `;
  }
}

export default FormsPage;
```

- [ ] **Step 3: Wire the enhancer into `playground/app.ts`**

Append after the outlet wiring:

```ts
// Progressive enhancement for light-DOM action forms. Forms inside shadow
// roots attach their own enhancer (see pages/forms.ts) — submit events are
// composed:false and never reach this document-level listener.
import { enhanceForms } from '@beatzball/litro/actions/form-client';
enhanceForms();
```

(Place the import at the top of the file with the other imports; the call after the outlet block.)

- [ ] **Step 4: Build + smoke-check in dev**

Run: `pnpm --filter @beatzball/litro build`
Expected: clean emit.
Run: `cd playground && node ../packages/framework/dist/cli/index.js dev --port 3031` in the background; then `curl -s http://localhost:3031/forms | grep -o 'guestbook-form'` and
`curl -s -X POST 'http://localhost:3031/__litro/action/<addEntry-id>' -H 'content-type: application/x-www-form-urlencoded' -H 'referer: http://localhost:3031/forms' --data 'name=&message=' -D - -o /dev/null | grep -i 'HTTP/1.1 303\|set-cookie'`
(compute `<addEntry-id>` from the repo root with:
`node --input-type=module -e "const {hashActionId}=await import('./packages/framework/dist/actions/hash.js');console.log(hashActionId('actions/forms.server','addEntry'))"`).
Expected: `guestbook-form` found; 303 + `litro-form-error` cookie. Stop the dev server afterwards.
Also verify the generated runtime plugin exists: `cat playground/server/plugins/litro-actions.ts` — contains `stampActionIds`.

- [ ] **Step 5: Commit**

```bash
git add playground/actions/forms.server.ts playground/pages/forms.ts playground/app.ts
git commit -m "feat(playground): /forms demo — PRG forms, token mode, streaming"
```

---

### Task 12: E2E specs (forms PRG loop, enhanced path, token mode, streaming)

**Files:**
- Create: `e2e/playground/server-actions-forms.spec.ts`
- Create: `e2e/playground/server-actions-streaming.spec.ts`

**Interfaces:**
- Consumes: the `/forms` page ids from Task 11; `hashActionId`/`serializeValue` from `packages/framework/dist/` (existing spec convention); Playwright `request` fixture (per-test cookie jar) and `page` fixture; baseURL `http://localhost:3030` from `playwright.config.ts`.

- [ ] **Step 1: Write `server-actions-forms.spec.ts`**

```ts
import { test, expect } from '@playwright/test';
import { hashActionId } from '../../packages/framework/dist/actions/hash.js';

const ADD_ENTRY_ID = hashActionId('actions/forms.server', 'addEntry');
const TOKEN_ID = hashActionId('actions/forms.server', 'addEntryWithToken');

test.describe('server actions — no-JS form posts (PRG)', () => {
  test('full failure loop: invalid post, 303 bounce, error rendered once, then cleared', async ({ request, baseURL }) => {
    const res = await request.post(`/__litro/action/${ADD_ENTRY_ID}`, {
      form: { name: '', message: '' },
      headers: { referer: `${baseURL}/forms` },
      maxRedirects: 0,
    });
    expect(res.status()).toBe(303);
    expect(res.headers()['location']).toContain('/forms');
    expect(res.headers()['set-cookie']).toContain('litro-form-error=');

    // The request fixture's cookie jar carries the one-shot cookie.
    const bounced = await request.get('/forms');
    expect(await bounced.text()).toContain('Name is required');

    // One-shot: a second GET renders clean.
    const again = await request.get('/forms');
    expect(await again.text()).not.toContain('Name is required');
  });

  test('valid post redirects to form.redirect and the entry renders', async ({ request }) => {
    const res = await request.post(`/__litro/action/${ADD_ENTRY_ID}`, {
      form: { name: 'NoJs', message: 'hello from the no-js path' },
      maxRedirects: 0,
    });
    expect(res.status()).toBe(303);
    expect(res.headers()['location']).toBe('/forms');
    const pageRes = await request.get('/forms');
    expect(await pageRes.text()).toContain('hello from the no-js path');
  });

  test('token mode: missing token 403; minted token passes', async ({ request }) => {
    const missing = await request.post(`/__litro/action/${TOKEN_ID}`, {
      form: { name: 'x', message: 'y' },
      maxRedirects: 0,
    });
    expect(missing.status()).toBe(403);

    // GET /forms mints the __Host- cookie; read the token from the set-cookie
    // header explicitly (Secure cookies over http may not enter every jar).
    const pageRes = await request.get('/forms');
    const setCookie = pageRes.headers()['set-cookie'] ?? '';
    const token = /__Host-litro-csrf=([^;]+)/.exec(setCookie)?.[1];
    expect(token).toBeTruthy();

    const ok = await request.post(`/__litro/action/${TOKEN_ID}`, {
      form: { name: 'Tok', message: 'token path works', _litro_csrf: token! },
      headers: { cookie: `__Host-litro-csrf=${token!}` },
      maxRedirects: 0,
    });
    expect(ok.status()).toBe(303);
  });
});

test.describe('server actions — enhanced form posts', () => {
  test('validation error surfaces via litro:action-error without navigation', async ({ page }) => {
    await page.goto('/forms');
    await page.locator('#gb-submit').click();
    await expect(page.locator('#enhanced-error')).toContainText('Name is required');
    expect(page.url()).toContain('/forms');
    await expect(page.locator('#form-errors')).toHaveCount(0); // no PRG bounce happened
  });

  test('success surfaces via litro:action-success detail', async ({ page }) => {
    await page.goto('/forms');
    await page.fill('#gb-name', 'Enhanced');
    await page.fill('#gb-message', 'enhanced hello');
    await page.locator('#gb-submit').click();
    await expect(page.locator('#enhanced-result')).toContainText('saved entry');
  });
});
```

- [ ] **Step 2: Write `server-actions-streaming.spec.ts`**

```ts
import { test, expect } from '@playwright/test';
import { hashActionId } from '../../packages/framework/dist/actions/hash.js';
import { serializeValue } from '../../packages/framework/dist/actions/serialize.js';

const COUNTDOWN_ID = hashActionId('actions/forms.server', 'countdown');

test.describe('server actions — streaming', () => {
  test('raw NDJSON: countdown streams value lines and a done line', async ({ request }) => {
    const res = await request.post(`/__litro/action/${COUNTDOWN_ID}`, {
      headers: { 'content-type': 'application/json', 'x-litro-action': '1' },
      data: serializeValue([{ from: 3 }]),
    });
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('application/x-ndjson');
    const lines = (await res.text()).split('\n').filter((l) => l.length > 0);
    expect(lines).toHaveLength(4);
    expect(JSON.parse(lines[3])).toEqual({ done: true });
    expect(lines[0]).toContain('"n"');
  });

  test('browser: for-await over the stream yields 3 chunks with a revived Date', async ({ page }) => {
    await page.goto('/forms');
    await page.locator('#stream-button').click();
    await expect(page.locator('#stream-lines li')).toHaveCount(4);
    await expect(page.locator('#stream-lines li').first()).toContainText('3 @ 20');
    await expect(page.locator('#stream-lines li').last()).toHaveText('done');
  });

  test('mid-stream error surfaces as a LitroActionError message', async ({ page }) => {
    await page.goto('/forms');
    await page.locator('#stream-fail-button').click();
    await expect(page.locator('#stream-error')).toHaveText('stream blew up');
  });
});
```

- [ ] **Step 3: Run the playground e2e project**

Run: `pnpm --filter @beatzball/litro build && pnpm exec playwright test --project=playground`
Expected: all new specs pass; every pre-existing playground spec (including `server-actions.spec.ts` and `server-actions-externalization.spec.ts`) still passes. The externalization spec doubles as proof that the forms page did not leak server modules into the client bundle.

- [ ] **Step 4: Commit**

```bash
git add e2e/playground/server-actions-forms.spec.ts e2e/playground/server-actions-streaming.spec.ts
git commit -m "test(e2e): forms PRG loop, enhanced submits, token mode, streaming"
```

---

### Task 13: Checkpoint B — full-suite regression

- [ ] **Step 1: Run everything**

```bash
pnpm --filter @beatzball/litro build
pnpm test
pnpm test:e2e
pnpm test:e2e:preview
```

Expected: all green. `test:e2e:preview` matters here — production builds exercise the asyncContext path (`ctx.event` defined in-process) and the generated runtime plugin in a bundled server.

- [ ] **Step 2: Fix any failures via superpowers:systematic-debugging, commit fixes**

```bash
git add -A && git commit -m "fix: checkpoint B regressions"
```

(Skip if green on the first run.)

---

### Task 14: create-litro fullstack template wiring

**Files:**
- Modify: `packages/create-litro/recipes/fullstack/template/nitro.config.ts`
- Modify: `packages/create-litro/recipes/fullstack/template/vite.config.ts`
- Modify: `packages/create-litro/recipes/fullstack/template/package.json`
- Modify: `packages/create-litro/recipes/fullstack/template/.gitignore`
- Modify: `packages/create-litro/recipes/fullstack/template/app.ts`
- Modify: `packages/create-litro/recipes/fullstack/template/pages/index.ts`
- Create: `packages/create-litro/recipes/fullstack/template/actions/demo.server.ts`
- Test: `packages/create-litro/src/scaffold.test.ts` (extend)

**Interfaces:**
- Consumes: published-subpath imports (`@beatzball/litro/plugins/actions`, `@beatzball/litro/vite`, `@beatzball/litro/actions`, `@beatzball/litro/actions/client`, `@beatzball/litro/actions/form-client`).
- Produces: a scaffolded fullstack app with actions fully wired and a `greet` demo action + enhanced form on the home page.

- [ ] **Step 1: Extend the scaffold test**

Add to `packages/create-litro/src/scaffold.test.ts` (inside the existing describe, reusing `withTmpDir` + `scaffold` conventions):

```ts
it('fullstack template wires server actions', async () => {
  await withTmpDir(async (targetDir) => {
    await scaffold('fullstack', { projectName: 'cool-blog', mode: 'ssr' }, targetDir);

    const nitroConfig = await readFile(join(targetDir, 'nitro.config.ts'), 'utf-8');
    expect(nitroConfig).toContain("import actionsPlugin from '@beatzball/litro/plugins/actions';");
    expect(nitroConfig).toContain("route: '/__litro/action/:id'");
    expect(nitroConfig).toContain('await actionsPlugin(nitro);');
    expect(nitroConfig).toContain("'/__litro/action/**'");

    const viteConfig = await readFile(join(targetDir, 'vite.config.ts'), 'utf-8');
    expect(viteConfig).toContain("import { litroActionsPlugin } from '@beatzball/litro/vite';");
    expect(viteConfig).toContain('litroActionsPlugin()');

    const pkg = JSON.parse(await readFile(join(targetDir, 'package.json'), 'utf-8'));
    expect(pkg.imports['#litro/action-manifest']).toBe('./server/stubs/action-manifest.ts');

    const gitignore = await readFile(join(targetDir, '.gitignore'), 'utf-8');
    expect(gitignore).toContain('server/stubs/action-manifest.ts');
    expect(gitignore).toContain('server/stubs/action-handler.ts');
    expect(gitignore).toContain('server/plugins/litro-actions.ts');

    expect(existsSync(join(targetDir, 'actions/demo.server.ts'))).toBe(true);

    const appTs = await readFile(join(targetDir, 'app.ts'), 'utf-8');
    expect(appTs).toContain('enhanceForms');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @beatzball/create-litro test`
Expected: FAIL on the new test only.

- [ ] **Step 3: Apply the template edits**

`nitro.config.ts` — add the import after the `ssgPlugin` import:

```ts
import actionsPlugin from '@beatzball/litro/plugins/actions';
```

Add to the `handlers` array, after the vite-dev entry:

```ts
    {
      route: '/__litro/action/:id',
      method: 'post',
      handler: resolve('./server/stubs/action-handler.ts'),
    },
```

In `hooks['build:before']`, after `await ssgPlugin(nitro);`:

```ts
      await actionsPlugin(nitro);
```

In `routeRules`, after the `/_litro/**` rule:

```ts
    '/__litro/action/**': {
      headers: { 'cache-control': 'no-store' },
    },
```

Also extend the auto-discovery comment above `srcDir` to mention `server/plugins/` (runtime plugins, auto-loaded at startup).

`vite.config.ts` — add the import and a `plugins` array:

```ts
import { litroActionsPlugin } from '@beatzball/litro/vite';
```

```ts
  plugins: [litroActionsPlugin()],
```

`package.json` — extend `"imports"`:

```json
  "imports": {
    "#litro/page-manifest": "./server/stubs/page-manifest.ts",
    "#litro/action-manifest": "./server/stubs/action-manifest.ts"
  },
```

`.gitignore` — under the existing "Generated" block add:

```
server/stubs/action-manifest.ts
server/stubs/action-handler.ts
server/plugins/litro-actions.ts
```

`app.ts` — append at the end:

```ts
// Progressive enhancement for action forms in light DOM. Components that
// render forms inside shadow roots attach their own enhancer instead — see
// pages/index.ts (submit events do not cross shadow-root boundaries).
import { enhanceForms } from '@beatzball/litro/actions/form-client';
enhanceForms();
```

(Move the import up with the other imports; ESM hoists it anyway.)

Create `actions/demo.server.ts`:

```ts
/**
 * Demo server action. Every export of a *.server.ts module becomes a public
 * endpoint — validate anything that touches data with an input schema.
 * This module and its imports never enter the client bundle.
 */
import { defineAction, type StandardSchemaV1 } from '@beatzball/litro/actions';

const greetSchema: StandardSchemaV1<unknown, { name: string }> = {
  '~standard': {
    version: 1,
    vendor: '{{projectName}}',
    validate(value) {
      const v = value as { name?: unknown } | null;
      if (typeof v?.name !== 'string' || v.name.trim() === '') {
        return { issues: [{ message: 'Name is required' }] };
      }
      return { value: { name: v.name.trim() } };
    },
  },
};

export const greet = defineAction({
  input: greetSchema,
  async handler({ name }) {
    return { greeting: `Hello, ${name}!`, at: new Date() };
  },
});
```

`pages/index.ts` — replace the file with:

```ts
import { html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { LitroPage } from '@beatzball/litro/runtime';
import { definePageData } from '@beatzball/litro';
import { actionUrl } from '@beatzball/litro/actions/client';
import { enhanceForms } from '@beatzball/litro/actions/form-client';
import { greet } from '../actions/demo.server.js';

export interface HomeData {
  message: string;
  timestamp: string;
}

// Runs on the server before SSR — result injected as JSON into the HTML shell.
export const pageData = definePageData(async (_event) => {
  return {
    message: 'Hello from {{projectName}}!',
    timestamp: new Date().toISOString(),
  } satisfies HomeData;
});

@customElement('page-home')
export class HomePage extends LitroPage {
  @state() private greeting = '';

  private detachEnhancer?: () => void;

  // Called on client-side navigation (not on the initial SSR load).
  override async fetchData() {
    const res = await fetch('/api/hello');
    return res.json() as Promise<HomeData>;
  }

  firstUpdated(): void {
    // Enhance the form below: with JS it becomes a typed RPC; without JS the
    // browser posts natively and the server redirects (PRG). submit events
    // do not cross shadow roots, so attach to this component's render root.
    this.detachEnhancer = enhanceForms(this.renderRoot as ShadowRoot);
    this.renderRoot.addEventListener('litro:action-success', ((e: CustomEvent) => {
      this.greeting = (e.detail as { greeting: string }).greeting;
    }) as EventListener);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.detachEnhancer?.();
  }

  render() {
    const data = this.serverData as HomeData | null;
    if (this.loading) return html`<p>Loading…</p>`;
    return html`
      <main>
        <h1>${data?.message ?? 'Welcome to {{projectName}}'}</h1>
        <p><small>Rendered at: ${data?.timestamp ?? '—'}</small></p>
        <form method="post" action=${actionUrl(greet)}>
          <input name="name" placeholder="Your name" />
          <button>Greet (server action)</button>
        </form>
        <p id="greeting">${this.greeting}</p>
        <nav>
          <litro-link href="/blog">Go to Blog →</litro-link>
        </nav>
      </main>
    `;
  }
}

export default HomePage;
```

- [ ] **Step 4: Run tests to verify they pass, commit**

Run: `pnpm --filter @beatzball/create-litro test`
Expected: PASS (new test + all pre-existing scaffold tests).

```bash
git add packages/create-litro/recipes/fullstack/template packages/create-litro/src/scaffold.test.ts
git commit -m "feat(create-litro): wire server actions into the fullstack template"
```

---

### Task 15: Docs guide update + spec lockstep amendments

**Files:**
- Modify: `packages/docs-content/content/docs/server-actions.md`
- Modify: `docs/superpowers/specs/2026-07-05-server-actions-m2-design.md`

- [ ] **Step 1: Update the Server Actions guide**

In `packages/docs-content/content/docs/server-actions.md`:

1. **Rename `## Limitations (v1)` to `## Limitations`** and rewrite its list: remove forms/streaming (now shipped); keep/add — GET actions and caching, `'use server'` directive, lint rule, `Serializable<T>` typing, file-upload size limits (form mode accepts what `readFormData` buffers), `ctx.event` undefined for in-process calls in dev, `.server.ts` modules outside the project root are stubbed client-side but never registered (silent 404 — keep actions inside the app), `experimental.asyncContext` on edge presets needs runtime AsyncLocalStorage support (e.g. Cloudflare `nodejs_compat`).
2. **In `### Error handling`**, add: production error payloads echo the raw handler `Error.message` — shape what you throw deliberately.
3. **Add `## Forms` after the `## CSRF protection` section** with these subsections (write against the shipped code, mirroring the playground `/forms` page):
   - *Basic form* — `actionUrl(action)` in a plain `<form method="post">`; identical in Lit/FAST/Elena (plain attribute interpolation); no-JS = native post + PRG, with-JS = `enhanceForms()` upgrade.
   - *The enhancer* — `enhanceForms()` from `@beatzball/litro/actions/form-client` in `app.ts`; `litro:action-success` / `litro:action-error` CustomEvents (`bubbles`, `composed`); the shadow-DOM caveat: submit events are `composed: false`, so components rendering forms in shadow roots call `enhanceForms(this.renderRoot)` (returns a detach function).
   - *Requirements* — form targets must be `defineAction` with an `input` schema (400 otherwise); repeated field names become arrays; files pass through.
   - *PRG flow and the worked error example* — the complete loop, code included, exactly the playground `/forms` pattern: strict schema rejects → 303 back to Referer with the one-shot `litro-form-error` cookie → `getFormErrors(event)` inside `definePageData` → template renders `errors.issues` above the form, repopulating inputs from `defaultValues` passed through pageData → next GET is clean. Follow with one paragraph on the enhanced-path failure surface (`litro:action-error` event detail carries the same issues) so both failure surfaces sit side by side.
   - *CSRF modes* — `'origin'` default (Origin/`Sec-Fetch-Site` gates; form posts skip the header gate); `'token'` opt-in: `csrfToken(event)` in pageData, `<input type="hidden" name="_litro_csrf" value=...>`, `__Host-litro-csrf` double-submit cookie, 403 on mismatch. Note `@beatzball/litro/actions/server` is server-only (client builds get throwing stubs).
   - *Redirect targets* — `form: { redirect }`, then Referer, then `/`; `ctx.event` escape hatch (handler calls `sendRedirect` itself; the framework detects `event.handled`).
4. **Add `## Streaming` after `## Forms`**: async-generator handlers (`async *handler`), `for await (const chunk of await tail({...}))` on the client, seroval revival per chunk (Dates etc.), mid-stream throws arrive as `LitroActionError`, `application/x-ndjson` transport, form mode never streams (400).
5. **In `## Setup`**, add a sentence: apps scaffolded with `npm create @beatzball/litro` (fullstack recipe) ship with all of this pre-wired; also note the generated `server/plugins/litro-actions.ts` alongside the existing generated-stubs description, and the `x-forwarded-host` note in the CSRF section.

Every code example must be verified against the shipped exports (subpaths, names, signatures) — the Task 17 fact-check agent will diff docs claims against the code.

- [ ] **Step 2: Amend the M2 spec (lockstep rule)**

Append a `## Implementation deviations` section to `docs/superpowers/specs/2026-07-05-server-actions-m2-design.md` recording the seven pinned decisions from this plan's header (seroval per-value cross-JSON composition; TextDecoder line reader; `enhanceForms(root)` param + shadow-DOM rationale; Vite client stub for `@beatzball/litro/actions/server`; plain-function runtime plugin; server-side `_litro_csrf` stripping; PRG-vs-plain-error split), each with one sentence of rationale.

- [ ] **Step 3: Verify docs build/tests, commit**

Run: `pnpm test:docs`
Expected: PASS.

```bash
git add packages/docs-content/content/docs/server-actions.md docs/superpowers/specs/2026-07-05-server-actions-m2-design.md
git commit -m "docs: server actions forms and streaming guide; record M2 implementation deviations"
```

---

### Task 16: Changesets

**Files:**
- Create: `.changeset/litro-server-actions-m2.md`
- Create: `.changeset/create-litro-actions-wiring.md`

- [ ] **Step 1: Write the framework changeset**

`.changeset/litro-server-actions-m2.md`:

```md
---
'@beatzball/litro': minor
---

Server Actions milestone 2: progressive-enhancement forms and streaming returns.

- Forms: `actionUrl()` renders plain `<form method="post">` targets for actions; without JS the endpoint answers with a Post/Redirect/Get flow (one-shot `litro-form-error` cookie, read via `getFormErrors()`); with JS, `enhanceForms()` (`@beatzball/litro/actions/form-client`) upgrades submits to seroval RPCs and reports results via `litro:action-success` / `litro:action-error` events. Opt-in `csrf: 'token'` double-submit mode with `csrfToken()`; form targets require a `defineAction` input schema.
- Streaming: action handlers may return an `AsyncIterable` (async generators included); responses stream as `application/x-ndjson` seroval cross-JSON lines and `callAction` yields chunks incrementally, preserving object identity across chunks.
- Follow-ups: the Origin gate honors `x-forwarded-host`; `.mjs` action modules keep their extension in generated manifests; new `@beatzball/litro/actions/server` subpath (server-only helpers, stubbed in client builds).
```

- [ ] **Step 2: Write the create-litro changeset**

`.changeset/create-litro-actions-wiring.md`:

```md
---
'@beatzball/create-litro': minor
---

The fullstack template ships with Server Actions pre-wired: actions plugin and endpoint handler in `nitro.config.ts`, `no-store` route rule, `#litro/action-manifest` import mapping, `litroActionsPlugin()` in `vite.config.ts`, form enhancer in `app.ts`, and a demo `greet` action with a progressive-enhancement form on the home page.
```

- [ ] **Step 3: Commit**

```bash
git add .changeset/litro-server-actions-m2.md .changeset/create-litro-actions-wiring.md
git commit -m "chore: changesets for server actions milestone 2"
```

---

### Task 17: Checkpoint C + final whole-branch review

- [ ] **Step 1: Dispatch an independent docs fact-check agent.** Brief: read `packages/docs-content/content/docs/server-actions.md` and verify EVERY claim against the real code — each named export exists at the stated subpath with the stated signature; each code example type-checks against real conventions (class pages, `pageData` export, `nitro.config.ts`/`vite.config.ts`); each described behavior (status codes, cookie names/attributes, event names, redirect fallback chain, content types) matches the shipped implementation and tests. Fix findings in place.

- [ ] **Step 2: Dispatch an independent whole-branch reviewer.** Brief: review the full branch diff against `docs/superpowers/specs/2026-07-05-server-actions-m2-design.md` for spec-code contract violations, security regressions in the CSRF gates, and leftover debug code. Fix findings.

- [ ] **Step 3: Final battery**

```bash
pnpm --filter @beatzball/litro build
pnpm test
pnpm test:e2e
pnpm test:docs
```

Expected: all green.

- [ ] **Step 4: Personal-identifier sweep (required before any push)**

```bash
git log --format='%an %ae %s %b' main..HEAD | grep -iE 'zaid|/Users/' ; git diff main..HEAD | grep -iE 'zaid|/Users/[a-z]+' 
```

Expected: no output from either grep (exit code 1). If anything matches, rewrite the offending commits before pushing.

- [ ] **Step 5: Commit any fixes, then hand off**

```bash
git add -A && git commit -m "fix: checkpoint C findings"
```

(Skip if no findings.) Then use superpowers:finishing-a-development-branch to decide merge/PR handling. PR body must reference "PRD item" style numbering only (no bare `#N`) and end with the standard generated-with footer.
