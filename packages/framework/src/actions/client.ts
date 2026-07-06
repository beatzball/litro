/**
 * Browser runtime for generated action stubs.
 *
 * BROWSER-SAFE: only imports serialize.ts (seroval, isomorphic) and error.ts
 * (pure). Never import hash.ts (node:crypto), define.ts (nitropack), or
 * anything else Node-only from here.
 */
import { serializeValue, deserializeValue, createStreamDecoder } from './serialize.js';
import { LitroActionError, type ActionErrorPayload } from './error.js';

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

export async function callAction<T = unknown>(id: string, args: unknown[]): Promise<T> {
  const res = await fetch(`/__litro/action/${id}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-litro-action': '1',
    },
    body: serializeValue(args),
  });

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

  if (!res.ok) {
    let payload: ActionErrorPayload | undefined;
    try {
      payload = JSON.parse(text) as ActionErrorPayload;
    } catch {
      // Non-JSON error body (proxy/gateway HTML, etc.) — fall through.
    }
    throw new LitroActionError(
      payload?.message ?? `Action ${id} failed with status ${res.status}`,
      { status: payload?.status ?? res.status, issues: payload?.issues },
    );
  }

  return deserializeValue(text) as T;
}
