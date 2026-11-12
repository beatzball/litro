import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { AgentError } from '@beatzball/litro-agent';

/** A local shared-directory mutex. Never steal a live or abandoned lock. A crash
 * fails closed; an operator removes the lock only after all workers stop. */
export async function coderLock<T>(directory: string, work: () => Promise<T>): Promise<T> {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const lock = join(directory, '.lock');
  const deadline = Date.now() + 10000;
  for (;;) {
    try { await mkdir(lock, { mode: 0o700 }); break; }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      if (Date.now() >= deadline) throw new AgentError('Coder state is busy or locked after a stopped worker. Retry, or ask the operator to recover its lock.', { status: 503 });
      await new Promise((done) => setTimeout(done, 20));
    }
  }
  try { return await work(); } finally { await rm(lock, { recursive: true, force: true }); }
}
