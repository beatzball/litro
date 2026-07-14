/**
 * Demo agent — scripted provider (deterministic, no API keys required).
 *
 * First turn that mentions "weather" narrates, calls the get-weather tool,
 * then finishes. Every other turn just narrates a short closing message.
 */
import { defineAgent } from '@beatzball/litro-agent';
import { scriptedProvider } from '@beatzball/litro-agent/providers/scripted';

const model = scriptedProvider((req, turn) => {
  const last = req.messages[req.messages.length - 1];
  if (turn === 1 && /weather/i.test(String(last?.content ?? ''))) {
    return [
      { type: 'text-delta', text: 'Checking the weather' },
      { type: 'tool-call', id: 'call_1', name: 'get-weather', input: { city: 'Lisbon' } },
      { type: 'done' },
    ];
  }
  return [
    { type: 'text-delta', text: 'Here is the ' },
    { type: 'text-delta', text: 'weather card.' },
    { type: 'done' },
  ];
});

export default defineAgent({ model, instructions: './instructions.md' });
