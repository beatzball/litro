/**
 * Browser session client for `@beatzball/litro-agent`.
 *
 * BROWSER-SAFE: only imports the isomorphic stream wire protocol
 * (`@beatzball/litro/stream` -- seroval, no Node/H3), the `SessionEvent` and
 * `UIResult` types (type-only -- no SSR machinery enters this graph), and
 * `AgentError` (pure). Never import the H3 server framework, any Node
 * built-in module, providers, or runtime/ here.
 *
 * Mirrors the NDJSON reading discipline of the Server Actions browser client
 * (`packages/framework/src/actions/client.ts` `parseActionStream`): a
 * buffered TextDecoder line loop over the response body, with
 * `reader.cancel()` in a `finally` so an early `break` by the consumer
 * always releases the underlying connection.
 */
import { createStreamDecoder, serializeValue } from '@beatzball/litro/stream';
import type { SessionEvent } from './sessions/types.js';
import type { UIResult } from './ui/index.js';
import { AgentError } from './errors.js';

export interface AgentSession {
  send(text: string): AsyncIterable<SessionEvent>;
  resume(fromSeq?: number): AsyncIterable<SessionEvent>;
}

/** Actions-style error payload shape (`{ name, message, status }`), reused
 *  here since the agent handler's `errorPayload()` mirrors the actions one. */
interface WireErrorPayload {
  message?: string;
  status?: number;
}

/** Incremental NDJSON reader for a `/__litro/agent/:agent/:session` response
 *  body. Buffers bytes, splits on newlines, revives each `{ n }` line via the
 *  shared-refs decoder, rethrows `{ err }` lines as `AgentError`, and returns
 *  on the `{ done }` line. A stream that ends without `done` (dropped
 *  connection, network failure) surfaces as a thrown `AgentError` -- distinct
 *  from an `{ err }` line, which is an intentional server-side signal. */
async function* parseSessionStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<SessionEvent, void, undefined> {
  const decode = createStreamDecoder();
  const reader = body.getReader();
  const textDecoder = new TextDecoder();
  let buffer = '';

  const handleLine = (line: string): { done: boolean; value?: SessionEvent; hasValue: boolean } => {
    const chunk = decode(line);
    if (chunk.kind === 'done') return { done: true, hasValue: false };
    if (chunk.kind === 'error') {
      const payload = chunk.payload as WireErrorPayload;
      throw new AgentError(payload.message ?? 'Agent session stream reported an error', {
        status: payload.status,
      });
    }
    return { done: false, value: chunk.value as SessionEvent, hasValue: true };
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
        if (r.hasValue) yield r.value as SessionEvent;
      }
      if (done) {
        const rest = buffer.trim();
        if (rest) {
          const r = handleLine(rest);
          if (r.done) return;
          if (r.hasValue) yield r.value as SessionEvent;
        }
        throw new AgentError('Agent session stream ended unexpectedly', { status: 502 });
      }
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      // Stream may already be closed or errored -- nothing to cancel.
    }
    reader.releaseLock();
  }
}

/** Parses a non-2xx pre-stream response body the same way the actions client
 *  does: JSON payload wins, otherwise fall back to a generic message keyed
 *  off the HTTP status. */
async function errorFromResponse(res: Response): Promise<AgentError> {
  const text = await res.text();
  let payload: WireErrorPayload | undefined;
  try {
    payload = JSON.parse(text) as WireErrorPayload;
  } catch {
    // Non-JSON error body (proxy/gateway HTML, etc.) -- fall through.
  }
  return new AgentError(payload?.message ?? `Agent request failed with status ${res.status}`, {
    status: payload?.status ?? res.status,
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function* sendStream(url: string, text: string): AsyncGenerator<SessionEvent, void, undefined> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-litro-agent': '1',
    },
    body: serializeValue({ text }),
  });

  if (!res.ok) throw await errorFromResponse(res);
  if (!res.body) throw new AgentError('Agent session response had no body', { status: 502 });

  yield* parseSessionStream(res.body);
}

/** GET replay/live-tail with exactly one retry on a mid-stream network
 *  error (anything other than a server-signaled `AgentError`), after a
 *  500ms backoff, resuming from the last seen seq + 1. A second failure
 *  propagates unchanged. */
async function* resumeStream(url: string, fromSeq: number): AsyncGenerator<SessionEvent, void, undefined> {
  let from = fromSeq;
  let lastSeq = from - 1;
  let retried = false;

  while (true) {
    try {
      const res = await fetch(`${url}?from=${from}`, { method: 'GET' });
      if (!res.ok) throw await errorFromResponse(res);
      if (!res.body) throw new AgentError('Agent session response had no body', { status: 502 });

      for await (const ev of parseSessionStream(res.body)) {
        lastSeq = ev.seq;
        yield ev;
      }
      return;
    } catch (err) {
      if (err instanceof AgentError || retried) throw err;
      retried = true;
      from = lastSeq + 1;
      await delay(500);
    }
  }
}

/** Opens a browser-side session against `/__litro/agent/:agent/:session`.
 *  `send()` starts a turn (POST); `resume()` replays and/or live-tails an
 *  in-flight turn (GET). Neither call touches Node or H3 -- both are plain
 *  `fetch()` against the deployed Nitro handler. */
export function agentSession(agent: string, sessionId: string, opts: { base?: string } = {}): AgentSession {
  const base = opts.base ?? '';
  const url = `${base}/__litro/agent/${agent}/${sessionId}`;

  return {
    send(text: string): AsyncIterable<SessionEvent> {
      return sendStream(url, text);
    },
    resume(fromSeq = 0): AsyncIterable<SessionEvent> {
      return resumeStream(url, fromSeq);
    },
  };
}

/** Injects a tool-rendered `UIResult` into `host` and wires up its optional
 *  client-side hydration. `setHTMLUnsafe` is required to parse Declarative
 *  Shadow DOM `<template shadowrootmode>` markup in modern browsers;
 *  `innerHTML` is the fallback for jsdom/tests and pre-DSD environments
 *  (there the nested shadow trees simply won't attach, which is fine for
 *  environments that don't render DSD anyway). */
export async function hydrateUIResult(host: HTMLElement, result: UIResult): Promise<void> {
  if (typeof (host as { setHTMLUnsafe?: (html: string) => void }).setHTMLUnsafe === 'function') {
    (host as unknown as { setHTMLUnsafe: (html: string) => void }).setHTMLUnsafe(result.html);
  } else {
    host.innerHTML = result.html;
  }

  const hydrate = result.hydrate;
  if (hydrate?.modules?.length) {
    await Promise.all(hydrate.modules.map((m) => import(/* @vite-ignore */ m)));
  }
  if (hydrate?.props && host.firstElementChild) {
    Object.assign(host.firstElementChild, hydrate.props);
  }
}
