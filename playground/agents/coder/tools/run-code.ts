import { html } from 'lit';
import { z } from 'zod';
import { defineTool } from '@beatzball/litro-agent';
import { ui } from '@beatzball/litro-agent/ui';
import { machines } from '../../../server/machines.js';
// Keep the named binding: the server bundle must register the element for SSR.
import { RunOutput } from '../../../components/run-output.js';
void RunOutput;

export default defineTool({
  description: 'Run a command in this session’s Node.js microVM. Files persist until its TTL expires. Use ["sh", "-c", script] for shell syntax.',
  input: z.object({
    cmd: z.array(z.string().max(16000).refine((arg) => !arg.includes('\0'), 'Arguments must not contain NUL.'))
      .min(1).max(128).describe('Executable and arguments, for example ["node", "-e", "console.log(1+1)"].'),
  }),
  async execute({ cmd }, ctx) {
    const machine = await machines.forSession(ctx.session.id, { template: 'node' });
    const result = await machine.exec(cmd, { timeoutMs: 10000 });
    return ui(html`<run-output .cmd=${cmd} .result=${result}></run-output>`, {
      data: { exitCode: result.exitCode, stdout: result.stdout.slice(-8000), stderr: result.stderr.slice(-4000) },
      hydrate: { props: { cmd, result } },
    });
  },
});
