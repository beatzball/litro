/**
 * Runtime HTTP handler for POST /__litro/action/:id.
 *
 * Consumed by the generated stub server/stubs/action-handler.ts, which passes
 * in the actionModules array from #litro/action-manifest. The registry maps
 * hashActionId(relPath, exportName) -> exported function, enumerated at
 * runtime via Object.keys — no build-time export parsing on the server side.
 *
 * Security gates (see spec section 5):
 *   1. Require the x-litro-action custom header (cross-origin form posts
 *      cannot set custom headers — closes classic CSRF without tokens).
 *   2. Reject cross-site Sec-Fetch-Site values when the header is present.
 *   3. Reject Origin/Host mismatches when Origin is present.
 * Stacks are only included in error payloads when process.dev is true.
 */
import {
  defineEventHandler,
  getRouterParam,
  getRequestHeader,
  readRawBody,
  setResponseStatus,
  setResponseHeader,
  type H3Event,
} from 'h3';
import { hashActionId } from './hash.js';
import { serializeValue, deserializeValue } from './serialize.js';
import { ACTION_CONFIG, runAction, type ActionConfig } from './define.js';
import { LitroActionError, type ActionErrorPayload } from './error.js';

export interface ActionModuleEntry {
  /** Project-root-relative module path, posix, extension-stripped —
   *  the same value normalizeActionPath() produces. */
  relPath: string;
  /** The imported module namespace object. */
  module: Record<string, unknown>;
}

type AnyFn = (...args: unknown[]) => unknown;

function isDev(): boolean {
  return (process as unknown as { dev?: boolean }).dev === true;
}

function toErrorPayload(err: unknown): ActionErrorPayload {
  if (err instanceof LitroActionError) {
    return {
      name: err.name,
      message: err.message,
      status: err.status,
      issues: err.issues,
      ...(isDev() ? { stack: err.stack } : {}),
    };
  }
  const e = err instanceof Error ? err : new Error(String(err));
  const statusCode = (e as { statusCode?: unknown }).statusCode;
  return {
    name: e.name,
    message: e.message,
    status: typeof statusCode === 'number' ? statusCode : 500,
    ...(isDev() ? { stack: e.stack } : {}),
  };
}

function sendError(event: H3Event, err: unknown): string {
  const payload = toErrorPayload(err);
  setResponseStatus(event, payload.status);
  setResponseHeader(event, 'content-type', 'application/json; charset=utf-8');
  return JSON.stringify(payload);
}

export function createActionHandler(entries: ActionModuleEntry[]) {
  let registry: Map<string, AnyFn> | null = null;

  function buildRegistry(): Map<string, AnyFn> {
    const map = new Map<string, AnyFn>();
    for (const { relPath, module } of entries) {
      for (const exportName of Object.keys(module)) {
        const value = module[exportName];
        if (typeof value !== 'function') continue;
        map.set(hashActionId(relPath, exportName), value as AnyFn);
      }
    }
    return map;
  }

  return defineEventHandler(async (event) => {
    // --- CSRF gates -------------------------------------------------------
    if (getRequestHeader(event, 'x-litro-action') !== '1') {
      return sendError(event, new LitroActionError('Missing x-litro-action header', { status: 403 }));
    }
    const secFetchSite = getRequestHeader(event, 'sec-fetch-site');
    if (secFetchSite && secFetchSite !== 'same-origin' && secFetchSite !== 'none') {
      return sendError(event, new LitroActionError('Cross-site action calls are not allowed', { status: 403 }));
    }
    const origin = getRequestHeader(event, 'origin');
    const host = getRequestHeader(event, 'host');
    if (origin) {
      let originHost: string | undefined;
      try {
        originHost = new URL(origin).host;
      } catch {
        originHost = undefined;
      }
      if (!host || originHost !== host) {
        return sendError(event, new LitroActionError('Origin does not match request host', { status: 403 }));
      }
    }

    // --- Lookup -----------------------------------------------------------
    registry ??= buildRegistry();
    const id = getRouterParam(event, 'id') ?? '';
    const fn = registry.get(id);
    if (!fn) {
      return sendError(event, new LitroActionError(`Unknown action: ${id}`, { status: 404 }));
    }

    // --- Deserialize args -------------------------------------------------
    let args: unknown[];
    try {
      const body = (await readRawBody(event)) ?? '';
      const parsed = deserializeValue(body);
      if (!Array.isArray(parsed)) throw new Error('Expected a serialized argument array');
      args = parsed;
    } catch (err) {
      return sendError(event, new LitroActionError('Malformed action request body', { status: 400, cause: err }));
    }

    // --- Dispatch ---------------------------------------------------------
    try {
      const config = (fn as unknown as Record<symbol, unknown>)[ACTION_CONFIG] as
        | ActionConfig<unknown, unknown>
        | undefined;
      const result = config
        ? await runAction(config, args[0], { event })
        : await fn(...args);
      setResponseHeader(event, 'content-type', 'application/json; charset=utf-8');
      setResponseHeader(event, 'cache-control', 'no-store');
      return serializeValue(result);
    } catch (err) {
      return sendError(event, err);
    }
  });
}
