/**
 * Demo agent (FAST playground) — scripted provider (deterministic, no API
 * keys required). Framework-agnostic: this file has no Lit or FAST imports
 * at all, so it is copied verbatim from the Lit playground's demo agent
 * (playground/agents/demo/agent.ts) — only `agents/demo/tools/get-weather.ts`
 * and `components/demo-weather-card.ts` differ per framework.
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
 */
import { defineAgent } from '@beatzball/litro-agent';
import { scriptedProvider, type ScriptedEvent } from '@beatzball/litro-agent/providers/scripted';
import { openaiCompatible } from '@beatzball/litro-agent/providers/openai-compatible';

// Provider selection is env-driven so the same demo serves both purposes:
//   - LLM_URL set   -> a real OpenAI-compatible model (token streaming and
//     tool-calling are genuine, so the chat renders token-by-token).
//   - LLM_URL unset -> the deterministic scripted provider below (the default;
//     what the e2e suite and keyless local runs use).
// Env: LLM_URL (e.g. https://api.openai.com/v1), LLM_MODEL, OPENAI_API_KEY
// (omit for keyless local runtimes).
const realModel = process.env.LLM_URL
  ? openaiCompatible({
      baseURL: process.env.LLM_URL,
      model: process.env.LLM_MODEL ?? 'gpt-4o-mini',
    })
  : null;

const model = scriptedProvider((req) => {
  const last = req.messages[req.messages.length - 1];
  const text = String(last?.content ?? '');

  if (last?.role === 'tool') {
    return [
      { type: 'text-delta', text: 'Here is the ' },
      { type: 'text-delta', text: 'weather card.' },
      { type: 'done' },
    ] satisfies ScriptedEvent[];
  }

  if (last?.role === 'user' && /weather/i.test(text)) {
    return [
      { type: 'text-delta', text: 'Checking the weather' },
      { type: 'tool-call', id: 'call_1', name: 'get-weather', input: { city: 'Lisbon' } },
      { type: 'done' },
    ] satisfies ScriptedEvent[];
  }

  return [{ type: 'text-delta', text: 'How can I help?' }, { type: 'done' }] satisfies ScriptedEvent[];
});

export default defineAgent({ model: realModel ?? model, instructions: './instructions.md' });
