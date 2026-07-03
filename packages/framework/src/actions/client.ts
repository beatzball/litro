/**
 * Browser runtime for generated action stubs.
 *
 * BROWSER-SAFE: only imports serialize.ts (seroval, isomorphic) and error.ts
 * (pure). Never import hash.ts (node:crypto), define.ts (nitropack), or
 * anything else Node-only from here.
 */
import { serializeValue, deserializeValue } from './serialize.js';
import { LitroActionError, type ActionErrorPayload } from './error.js';

export async function callAction<T = unknown>(id: string, args: unknown[]): Promise<T> {
  const res = await fetch(`/_litro/action/${id}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-litro-action': '1',
    },
    body: serializeValue(args),
  });

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
