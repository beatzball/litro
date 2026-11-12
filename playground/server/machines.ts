import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { AgentError } from '@beatzball/litro-agent';
import { Sandpiper } from '@beatzball/sandpiper';

/** Server-only bindings survive dev reloads and reconnects. The daemon owns TTL cleanup. */
export function sessionMachines(client: Sandpiper, directory: string, scope: string) {
  const pending = new Map<string, Promise<ReturnType<Sandpiper['machine']>>>();

  async function lookup(sessionId: string, { template }: { template: string }) {
    const key = createHash('sha256').update(JSON.stringify([scope, sessionId, template])).digest('hex');
    const file = join(directory, `${key}.json`);
    let id: string | undefined;
    try {
      const binding: unknown = JSON.parse(await readFile(file, 'utf8'));
      if (typeof binding === 'object' && binding !== null && 'id' in binding && typeof binding.id === 'string') {
        id = binding.id;
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw new AgentError('Could not read the session machine binding. Check SANDPIPER_SESSIONS_DIR and its saved JSON.', { cause: error });
      }
    }
    if (id) {
      const machine = client.machine(id);
      try {
        const info = await machine.info();
        if (info.state === 'running') return machine;
      } catch (error) {
        // An auth or transport failure must not allocate another machine.
        if ((error as { status?: number }).status !== 404) throw error;
      }
    }
    const machine = await client.createMachine({ template });
    const temporary = `${file}.${randomUUID()}.tmp`;
    try {
      await mkdir(directory, { recursive: true, mode: 0o700 });
      await writeFile(temporary, JSON.stringify({ id: machine.id }), { mode: 0o600 });
      await rename(temporary, file);
    } catch (error) {
      await rm(temporary, { force: true }).catch(() => {});
      await machine.destroy().catch(() => {});
      throw new AgentError('Could not save the session machine binding. Check SANDPIPER_SESSIONS_DIR permissions.', { cause: error });
    }
    return machine;
  }

  return {
    forSession(sessionId: string, options: { template: string }) {
      const key = JSON.stringify([sessionId, options.template]);
      let task = pending.get(key);
      if (!task) {
        task = lookup(sessionId, options).finally(() => pending.delete(key));
        pending.set(key, task);
      }
      return task;
    },
  };
}

let configured: { key: string; machines: ReturnType<typeof sessionMachines> } | undefined;
export const machines = {
  forSession(sessionId: string, options: { template: string }) {
    const baseUrl = process.env.SANDPIPER_URL;
    const token = process.env.SANDPIPER_TOKEN;
    if (!baseUrl || !token) {
      throw new AgentError('Run-code needs SANDPIPER_URL and SANDPIPER_TOKEN on the playground server.');
    }
    const directory = resolve(process.env.SANDPIPER_SESSIONS_DIR ?? '.litro/sandpiper');
    const key = JSON.stringify([baseUrl, token, directory]);
    if (configured?.key !== key) {
      configured = { key, machines: sessionMachines(new Sandpiper({ baseUrl, token }), directory, baseUrl) };
    }
    return configured.machines.forSession(sessionId, options);
  },
};
