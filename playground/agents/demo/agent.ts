/**
 * Demo agent — scripted provider (deterministic, no API keys required).
 *
 * Branches on the SHAPE of the request, not on a turn counter (the
 * `scriptedProvider`'s `turn` argument is a per-provider-INSTANCE counter,
 * and this module creates the provider once at module scope, so `turn` is
 * effectively process-global across every session/request -- unusable for
 * a per-request decision):
 *
 *   - First round of a turn (the user just spoke): `req.messages` ends with
 *     a `role: 'user'` message. If it mentions "weather", narrate + call
 *     the get-weather tool + done. Otherwise, a short plain narration.
 *   - Continuation round (after a tool result): `req.messages` ends with a
 *     `role: 'tool'` message (per `runTurn` in runtime/loop.ts, which pushes
 *     the assistant tool-call message followed by the tool-result message(s)
 *     onto `turnMessages` before looping). Narrate the closing message.
 *
 * This makes the weather/UI path deterministic per request, so it fires on
 * every session, not just the first one the process ever sees.
 *
 * "slowly" extension (for the Task 15 e2e resume/live-tail test): when the
 * incoming text contains that word, a { type: 'delay', ms: 1500 } is spliced
 * in after every text-delta, giving a client time to disconnect mid-turn and
 * reconnect via GET ?from=<seq> (or observe a live tail) before the turn
 * finishes.
 */
import { defineAgent } from '@beatzball/litro-agent';
import { scriptedProvider, type ScriptedEvent } from '@beatzball/litro-agent/providers/scripted';
import { openaiCompatible } from '@beatzball/litro-agent/providers/openai-compatible';

// Provider selection is env-driven so the same demo serves both purposes:
//   - LLM_URL set   -> a real OpenAI-compatible model (OpenAI, or any local
//     endpoint: Ollama/LM Studio/MLX/vLLM). Token streaming and tool-calling
//     are genuine, so the chat renders token-by-token.
//   - LLM_URL unset -> the deterministic scripted provider below (the default;
//     what the e2e suite and keyless local runs use).
// Env: LLM_URL (base, e.g. https://api.openai.com/v1), LLM_MODEL, and
// OPENAI_API_KEY (omit for keyless local runtimes).
const realModel = process.env.LLM_URL
  ? openaiCompatible({
      baseURL: process.env.LLM_URL,
      model: process.env.LLM_MODEL ?? 'gpt-4o-mini',
    })
  : null;

function withSlowDelays(events: ScriptedEvent[], slow: boolean): ScriptedEvent[] {
  if (!slow) return events;
  const out: ScriptedEvent[] = [];
  for (const event of events) {
    out.push(event);
    if (event.type === 'text-delta') out.push({ type: 'delay', ms: 1500 });
  }
  return out;
}

const model = scriptedProvider((req) => {
  const last = req.messages[req.messages.length - 1];
  const text = String(last?.content ?? '');
  const slow = /slowly/i.test(text);

  if (last?.role === 'tool') {
    return withSlowDelays(
      [
        { type: 'text-delta', text: 'Here is the ' },
        { type: 'text-delta', text: 'weather card.' },
        { type: 'done' },
      ],
      slow,
    );
  }

  if (last?.role === 'user' && /weather/i.test(text)) {
    return withSlowDelays(
      [
        { type: 'text-delta', text: 'Checking the weather' },
        { type: 'tool-call', id: 'call_1', name: 'get-weather', input: { city: 'Lisbon' } },
        { type: 'done' },
      ],
      slow,
    );
  }

  return withSlowDelays([{ type: 'text-delta', text: 'How can I help?' }, { type: 'done' }], slow);
});

export default defineAgent({ model: realModel ?? model, instructions: './instructions.md' });
