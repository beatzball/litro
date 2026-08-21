/**
 * Scripted provider: a deterministic `Provider` driven entirely by a plain
 * function, for testing agents (and their tool-calling loops) without a
 * network call. Each `stream()` invocation calls the script with the
 * request and a 1-based turn counter; the returned events are yielded in
 * order.
 *
 * The `delay` pseudo-event is not a `ProviderEvent` — it's a script-only
 * instruction consumed by the provider itself (awaited via `setTimeout`)
 * to simulate latency between events, and it is never yielded to callers.
 */
import type { Provider, ProviderEvent, ProviderRequest } from './types.js';

export type ScriptedEvent = ProviderEvent | { type: 'delay'; ms: number };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Creates a `Provider` whose stream() output is fully determined by
 *  `script(req, turn)`. `turn` is the 1-based count of `stream()` calls
 *  made on this provider instance. */
export function scriptedProvider(
  script: (req: ProviderRequest, turn: number) => ScriptedEvent[],
): Provider {
  let turn = 0;
  return {
    info: { system: 'scripted', model: 'scripted' },
    async *stream(req: ProviderRequest): AsyncGenerator<ProviderEvent, void, undefined> {
      turn += 1;
      const events = script(req, turn);
      for (const event of events) {
        if (event.type === 'delay') {
          await sleep(event.ms);
          continue;
        }
        yield event;
      }
    },
  };
}
