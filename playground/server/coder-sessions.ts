import { open, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { AgentError, type SessionStore, type SessionEvent } from '@beatzball/litro-agent';
import { coderLock } from './coder-lock.js';

/** Coder-only logs: no shared filename namespace with public demo agents. */
export function coderSessionStore(options: { directory?: string; maxBytes?: number } = {}): SessionStore {
  function directory() { return resolve(options.directory ?? process.env.CODER_SESSIONS_DIR ?? '.litro/coder-sessions'); }
  function cap() {
    const value = options.maxBytes ?? Number(process.env.CODER_SESSION_MAX_BYTES ?? 4 * 1024 * 1024);
    if (!Number.isSafeInteger(value) || value < 1024) throw new AgentError('CODER_SESSION_MAX_BYTES must be an integer of at least 1024.', { status: 503 });
    return value;
  }
  function path(id: string) {
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) throw new AgentError('Invalid coder session id.', { status: 400 });
    return join(directory(), `${id}.jsonl`);
  }
  function full() { return new AgentError('Coder session storage is full. Sign in to start a new session.', { status: 413 }); }
  async function readEvents(id: string): Promise<SessionEvent[]> {
    let file;
    try { file = await open(path(id), 'r'); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
    try {
      const limit = cap();
      if ((await file.stat()).size > limit) throw full();
      // Do not use readFile: a file may grow between stat and read. Read at most
      // limit + 1 bytes, including legacy oversized logs and concurrent writes.
      const bytes = Buffer.alloc(limit + 1);
      let size = 0;
      while (size < bytes.length) {
        const next = await file.read(bytes, size, bytes.length - size, size);
        if (!next.bytesRead) break;
        size += next.bytesRead;
      }
      if (size > limit) throw full();
      return bytes.toString('utf8', 0, size).split('\n').filter(Boolean).map((line) => JSON.parse(line) as SessionEvent);
    } finally { await file.close(); }
  }
  return {
    async append(id, event) {
      return coderLock(directory(), async () => {
        const events = await readEvents(id);
        const last = events.at(-1)?.seq ?? 0;
        const next: SessionEvent = { ...event, seq: last + 1 };
        const line = Buffer.from(JSON.stringify(next) + '\n');
        const filename = path(id);
        const currentSize = await stat(filename).then((info) => info.size, (error: NodeJS.ErrnoException) => { if (error.code === 'ENOENT') return 0; throw error; });
        // Leave room for the runtime's error and turn-end records. Once those
        // fill the hard cap, fail before writing and let HTTP terminate.
        const reserve = Math.min(32768, Math.floor(cap() / 8));
        const limit = event.kind === 'error' || event.kind === 'turn-end' ? cap() : cap() - reserve;
        if (currentSize + line.length > limit) throw full();
        const file = await open(filename, 'a', 0o600);
        try { await file.writeFile(line); } finally { await file.close(); }
        return next;
      });
    },
    async *read(id, fromSeq = 0) {
      for (const event of await coderLock(directory(), () => readEvents(id))) if (event.seq >= fromSeq) yield event;
    },
    async acquireLease(key, options) {
      const ttlMs = options?.ttlMs ?? 30000;
      const lock = join(directory(), `.turn-${createHash('sha256').update(key).digest('hex')}.json`);
      const owner = randomUUID();
      const readLease = async (): Promise<{ owner: string; expires: number } | undefined> => {
        try { return JSON.parse(await readFile(lock, 'utf8')); }
        catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined; throw error; }
      };
      const saveLease = async () => {
        const temporary = `${lock}.${owner}.tmp`;
        try { await writeFile(temporary, JSON.stringify({ owner, expires: Date.now() + ttlMs }), { mode: 0o600 }); await rename(temporary, lock); }
        finally { await rm(temporary, { force: true }); }
      };
      const acquired = await coderLock(directory(), async () => {
        const current = await readLease();
        if (current && current.expires > Date.now()) return false;
        await saveLease();
        return true;
      });
      if (!acquired) return null;
      return {
        owner,
        renew: () => coderLock(directory(), async () => {
          const current = await readLease();
          if (current?.owner !== owner || current.expires <= Date.now()) return false;
          await saveLease();
          return true;
        }),
        release: () => coderLock(directory(), async () => {
          if ((await readLease())?.owner === owner) await rm(lock, { force: true });
        }),
      };
    },
    async isLeased(key) {
      return coderLock(directory(), async () => {
        const lock = join(directory(), `.turn-${createHash('sha256').update(key).digest('hex')}.json`);
        try {
          const lease = JSON.parse(await readFile(lock, 'utf8')) as { expires: number };
          if (lease.expires > Date.now()) return true;
          await rm(lock, { force: true });
          return false;
        } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false; throw error; }
      });
    },
  };
}
