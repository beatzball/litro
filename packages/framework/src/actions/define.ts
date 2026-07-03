/**
 * defineAction — the validated, authenticated action primitive.
 *
 * SERVER-ONLY module (it reaches for Nitro's async context). Client code
 * never imports it directly: .server.ts modules that use it are replaced by
 * generated stubs in the client build.
 *
 * The returned value is a plain async function so in-process SSR calls work
 * identically to RPC calls: validation runs, then the handler. The config is
 * attached under ACTION_CONFIG so the HTTP handler (handler.ts) can detect
 * defineAction exports and route input through runAction with its own event.
 */
import type { H3Event } from 'h3';
import { LitroActionError } from './error.js';
import type { StandardSchemaV1 } from './standard-schema.js';

export const ACTION_CONFIG = Symbol.for('litro.action.config');

export interface ActionContext {
  /** The current H3 event. Defined during HTTP action calls; during
   *  in-process SSR calls it comes from Nitro's async context
   *  (experimental.asyncContext) and is undefined when that is unavailable. */
  event: H3Event | undefined;
}

export interface ActionConfig<In, Out> {
  input?: StandardSchemaV1<unknown, In>;
  handler: (input: In, ctx: ActionContext) => Promise<Out>;
}

export type ActionFunction<In, Out> = ((input: In) => Promise<Out>) & {
  [ACTION_CONFIG]: ActionConfig<In, Out>;
};

export async function runAction<In, Out>(
  config: ActionConfig<In, Out>,
  rawInput: unknown,
  ctx: ActionContext,
): Promise<Out> {
  let input = rawInput as In;
  if (config.input) {
    const result = await config.input['~standard'].validate(rawInput);
    if (result.issues) {
      throw new LitroActionError('Action input validation failed', {
        status: 400,
        issues: [...result.issues],
      });
    }
    input = result.value;
  }
  return config.handler(input, ctx);
}

/** Best-effort event lookup for in-process calls. Requires Nitro's
 *  experimental.asyncContext (enabled by Litro's config presets). Dynamic
 *  import + try/catch so this module also loads outside a Nitro runtime
 *  (vitest, plain node scripts). */
async function currentEvent(): Promise<H3Event | undefined> {
  try {
    const mod = (await import('nitropack/runtime')) as {
      useEvent?: () => H3Event | undefined;
    };
    return mod.useEvent?.() ?? undefined;
  } catch {
    return undefined;
  }
}

export function defineAction<In, Out>(config: ActionConfig<In, Out>): ActionFunction<In, Out> {
  const fn = (async (input: In) =>
    runAction(config, input, { event: await currentEvent() })) as ActionFunction<In, Out>;
  fn[ACTION_CONFIG] = config;
  return fn;
}
