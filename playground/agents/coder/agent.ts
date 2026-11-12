import { defineAgent } from '@beatzball/litro-agent';
import { scriptedProvider } from '@beatzball/litro-agent/providers/scripted';
import { openaiCompatible } from '@beatzball/litro-agent/providers/openai-compatible';

// Without a model endpoint, accept a JSON argv array for a repeatable local demo.
const scripted = scriptedProvider((request) => {
  const last = request.messages.at(-1);
  if (last?.role === 'tool') {
    const result = JSON.parse(String(last.content)) as { error?: { message: string } };
    return [{ type: 'text-delta', text: result.error?.message ?? 'The command finished. See the output below.' }, { type: 'done' }];
  }
  let cmd: unknown;
  try { cmd = JSON.parse(String(last?.content ?? '')); } catch { /* Show usage below. */ }
  if (Array.isArray(cmd) && cmd.length > 0 && cmd.every((arg) => typeof arg === 'string')) {
    return [{ type: 'tool-call', id: 'run', name: 'run-code', input: { cmd } }, { type: 'done' }];
  }
  return [{ type: 'text-delta', text: 'Enter a JSON command array, such as ["node", "-e", "console.log(1+1)"].' }, { type: 'done' }];
});

export default defineAgent({
  model: process.env.LLM_URL ? openaiCompatible({ baseURL: process.env.LLM_URL, model: process.env.LLM_MODEL ?? 'gpt-4o-mini' }) : scripted,
  instructions: './instructions.md',
});
