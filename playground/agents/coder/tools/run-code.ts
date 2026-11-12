import { html } from 'lit';
import { z } from 'zod';
import { defineTool } from '@beatzball/litro-agent';
import { ui } from '@beatzball/litro-agent/ui';
import { coderIdentity } from '../../../server/coder-auth.js';
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
    const identity = coderIdentity(ctx.event, ctx.session.id);
    return machines.withMachine(identity, { template: 'node' }, async (machine) => {
      const result = await machine.exec(cmd, { timeoutMs: 10000 });
      const stdout = preview(result.stdout);
      const stderr = preview(result.stderr);
      const visible = { ...result, stdout: stdout.text, stderr: stderr.text,
        stdoutTruncated: result.stdoutTruncated || stdout.truncated,
        stderrTruncated: result.stderrTruncated || stderr.truncated };
      return ui(html`<run-output .cmd=${cmd} .result=${visible}></run-output>`, {
        data: { exitCode: result.exitCode, stdout: result.stdout.slice(-8000), stderr: result.stderr.slice(-4000) },
        hydrate: { props: { cmd, result: visible } },
      });
    });
  },
});

/** Last 64 KiB, without splitting a UTF-8 code point. */
function preview(value: string): { text: string; truncated: boolean } {
  const bytes = Buffer.from(value, 'utf8');
  if (bytes.length <= 65536) return { text: value, truncated: false };
  let start = bytes.length - 65536;
  while ((bytes[start] & 0xc0) === 0x80) start++;
  return { text: bytes.toString('utf8', start), truncated: true };
}
