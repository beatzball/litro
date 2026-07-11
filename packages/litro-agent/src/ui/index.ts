/**
 * `ui()` — the tool-facing entry point for rendering a framework template
 * into a `UIResult` the agent runtime can stream back to the client.
 *
 * The concrete renderer (`./lit.js`, `./fast.js`, ...) is resolved from
 * `LITRO_ADAPTER` at call time and imported lazily — importing this module
 * (or the package's `./ui` export) must never drag SSR machinery (Lit SSR,
 * the FAST DOM shim, ...) into a graph that doesn't use it.
 */
import { AgentError } from '../errors.js';

export interface UIResult {
  type: 'ui';
  html: string;
  data?: unknown;
  hydrate?: { modules?: string[]; props?: Record<string, unknown> };
}

export interface UiOpts {
  data?: unknown;
  hydrate?: UIResult['hydrate'];
}

/** Type guard for a well-formed `UIResult`. */
export function isUIResult(v: unknown): v is UIResult {
  return (
    typeof v === 'object' &&
    v !== null &&
    (v as Record<string, unknown>).type === 'ui' &&
    typeof (v as Record<string, unknown>).html === 'string'
  );
}

/** Renders `template` to a `UIResult` via the framework adapter selected by
 *  `LITRO_ADAPTER` ('lit' by default). */
export async function ui(template: unknown, opts: UiOpts = {}): Promise<UIResult> {
  const adapter = process.env.LITRO_ADAPTER ?? 'lit';
  if (adapter === 'lit') return (await import('./lit.js')).uiLit(template as never, opts);
  if (adapter === 'fast') return (await import('./fast.js')).uiFast(template as never, opts);
  throw new AgentError(`ui(): the "${adapter}" renderer is deferred past v0.`, { status: 500 });
}
