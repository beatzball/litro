import { createHash, randomUUID } from 'node:crypto';
import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { AgentError } from '@beatzball/litro-agent';
import { Sandpiper } from '@beatzball/sandpiper';
import type { CoderIdentity } from './coder-auth.js';
import { coderLock } from './coder-lock.js';

interface Binding { id?: string; principal: string; scope: string }
interface Ledger { bindings: Record<string, Binding>; creations: { principal: string; at: number }[] }
interface Limits { perPrincipal: number; global: number; perMinute: number; globalPerMinute: number }
const defaults: Limits = { perPrincipal: 2, global: 8, perMinute: 4, globalPerMinute: 12 };

/** A durable admission ledger, serialized across reloads and local workers. */
export function sessionMachines(client: Sandpiper, directory: string, scope: string, configured: Partial<Limits> = {}) {
  const limits = { ...defaults, ...configured };
  if (Object.values(limits).some((value) => !Number.isSafeInteger(value) || value < 1)) {
    throw new AgentError('Coder machine limits must be positive integers.', { status: 503 });
  }
  const ledgerFile = join(directory, 'admission.json');
  async function read(): Promise<Ledger> {
    try {
      const ledger = JSON.parse(await readFile(ledgerFile, 'utf8')) as Ledger;
      if (!ledger.bindings || !Array.isArray(ledger.creations)) throw new Error('Invalid ledger');
      return ledger;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { bindings: {}, creations: [] };
      throw new AgentError('Could not read coder machine accounting. Ask the operator to check the saved ledger.', { cause: error });
    }
  }
  async function save(ledger: Ledger) {
    const temporary = `${ledgerFile}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, JSON.stringify(ledger), { mode: 0o600 });
      await rename(temporary, ledgerFile);
    } finally { await rm(temporary, { force: true }); }
  }
  function key(identity: CoderIdentity, template: string) {
    return createHash('sha256').update(JSON.stringify([scope, identity.principal, identity.agent, identity.session, identity.transport, template])).digest('hex');
  }
  async function admit(identity: CoderIdentity, template: string) {
    return coderLock(directory, async () => {
      const ledger = await read();
      for (const [bindingKey, binding] of Object.entries(ledger.bindings)) {
        if (binding.scope !== scope || !binding.id) continue;
        try {
          const state = (await client.machine(binding.id).info()).state;
          if (state !== 'destroyed' && state !== 'failed') continue;
        } catch (error) { if ((error as { status?: number }).status !== 404) throw error; }
        delete ledger.bindings[bindingKey];
      }
      ledger.creations = ledger.creations.filter(({ at }) => at > Date.now() - 60000);
      const bindingKey = key(identity, template);
      const existing = ledger.bindings[bindingKey];
      if (existing) {
        await save(ledger);
        if (!existing.id) throw new AgentError('A prior coder machine allocation has an uncertain outcome. Ask the operator to reconcile the admission ledger.', { status: 503 });
        const machine = client.machine(existing.id);
        if ((await machine.info()).state !== 'running') throw new AgentError('This session machine is starting or stopping. Retry after it finishes.', { status: 409 });
        return machine;
      }
      // Persist cleanup before returning quota errors as well.
      await save(ledger);
      const bindings = Object.values(ledger.bindings);
      if (bindings.length >= limits.global) throw new AgentError('Coder global live machine limit reached. Wait for a machine to expire.', { status: 429 });
      if (bindings.filter((binding) => binding.principal === identity.principal).length >= limits.perPrincipal) {
        throw new AgentError('Coder principal live machine limit reached. Reuse a session or wait for expiry.', { status: 429 });
      }
      if (ledger.creations.length >= limits.globalPerMinute || ledger.creations.filter((entry) => entry.principal === identity.principal).length >= limits.perMinute) {
        throw new AgentError('Coder machine creation rate limit reached. Retry after one minute.', { status: 429 });
      }
      // Charge failed allocations too; a broken daemon cannot bypass the rate.
      ledger.creations.push({ principal: identity.principal, at: Date.now() });
      ledger.bindings[bindingKey] = { principal: identity.principal, scope };
      await save(ledger);
      let machine;
      try { machine = await client.createMachine({ template }); }
      catch (error) {
        // Only explicit pre-allocation rejection can release the reservation.
        // Lost responses and server errors remain charged, even across reloads.
        if ([400, 401, 403, 429].includes((error as { status?: number }).status ?? 0)) {
          delete ledger.bindings[bindingKey];
          await save(ledger);
        }
        throw error;
      }
      ledger.bindings[bindingKey] = { id: machine.id, principal: identity.principal, scope };
      try { await save(ledger); }
      catch (error) { await machine.destroy().catch(() => {}); throw error; }
      return machine;
    });
  }
  return {
    forSession(identity: CoderIdentity, options: { template: string }) {
      if (identity.transport !== 'chat' || identity.session === 'mcp' || !identity.session) throw new AgentError('Persistent machines require a coder chat session.', { status: 403 });
      return admit(identity, options.template);
    },
    async withMachine<T>(identity: CoderIdentity, options: { template: string }, work: (machine: ReturnType<Sandpiper['machine']>) => Promise<T>): Promise<T> {
      if (identity.transport === 'chat') return work(await this.forSession(identity, options));
      const isolated = { ...identity, session: randomUUID() };
      const machine = await admit(isolated, options.template);
      try { return await work(machine); }
      finally {
        // A failed destroy remains accounted until daemon TTL cleanup succeeds.
        await machine.destroy();
        await coderLock(directory, async () => {
          const ledger = await read();
          delete ledger.bindings[key(isolated, options.template)];
          await save(ledger);
        });
      }
    },
  };
}

let configured: { key: string; machines: ReturnType<typeof sessionMachines> } | undefined;
function manager() {
  const baseUrl = process.env.SANDPIPER_URL;
  const token = process.env.SANDPIPER_TOKEN;
  if (!baseUrl || !token) throw new AgentError('Run-code needs SANDPIPER_URL and SANDPIPER_TOKEN on the playground server.');
  const directory = resolve(process.env.SANDPIPER_SESSIONS_DIR ?? '.litro/sandpiper');
  const limits = {
    perPrincipal: Number(process.env.CODER_MACHINES_PER_PRINCIPAL ?? defaults.perPrincipal),
    global: Number(process.env.CODER_MACHINES_GLOBAL ?? defaults.global),
    perMinute: Number(process.env.CODER_CREATIONS_PER_MINUTE ?? defaults.perMinute),
    globalPerMinute: Number(process.env.CODER_CREATIONS_GLOBAL_PER_MINUTE ?? defaults.globalPerMinute),
  };
  const key = JSON.stringify([baseUrl, token, directory, limits]);
  if (configured?.key !== key) configured = { key, machines: sessionMachines(new Sandpiper({ baseUrl, token }), directory, baseUrl, limits) };
  return configured.machines;
}
export const machines = {
  forSession(identity: CoderIdentity, options: { template: string }) { return manager().forSession(identity, options); },
  withMachine<T>(identity: CoderIdentity, options: { template: string }, work: (machine: ReturnType<Sandpiper['machine']>) => Promise<T>) { return manager().withMachine(identity, options, work); },
};
