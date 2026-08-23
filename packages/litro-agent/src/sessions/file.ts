import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'pathe';
import { AgentError } from '../errors.js';
import type { SessionEvent, SessionStore } from './types.js';

export function validateSessionId(id: string): void {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) {
    throw new AgentError(`Invalid session id: ${id}`, { status: 400 });
  }
}

/** Where a default-constructed store keeps its session logs, relative to
 *  `process.cwd()` unless absolute.
 *
 *  `LITRO_AGENT_SESSIONS_DIR` exists so that two servers sharing one project
 *  directory can be given separate, non-overlapping session state. The e2e
 *  suite needs exactly that: `e2e/playground/agent-resume.spec.ts` spawns a
 *  SECOND dev server in `playground/` and wipes its session directory around
 *  the test, while the shared `playground` dev server on port 3030 is
 *  serving other specs out of the same default directory. Without the
 *  override the wipe deletes the other server's live session logs. */
const DEFAULT_DIR = '.litro/sessions';

export function fileSessionStore(opts?: { dir?: string }): SessionStore {
  const dir = resolve(process.cwd(), opts?.dir ?? process.env.LITRO_AGENT_SESSIONS_DIR ?? DEFAULT_DIR);

  // Per-session promise chains for serialized writes
  const chains = new Map<string, Promise<void>>();
  // Per-session sequence counters
  const seqs = new Map<string, number>();

  // The session directory only needs to exist once; `mkdir(recursive:
  // true)` is idempotent but still a syscall, and append() used to pay it on
  // EVERY call. Cache the in-flight/settled promise so concurrent and
  // subsequent appends share one `mkdir`. On failure the cached promise is
  // cleared so the next append retries (matches the prior per-call
  // behavior, which always got a fresh attempt).
  let dirReady: Promise<void> | undefined;
  function ensureDir(): Promise<void> {
    if (!dirReady) {
      dirReady = mkdir(dir, { recursive: true })
        .then(() => undefined)
        .catch((err: unknown) => {
          dirReady = undefined;
          throw err;
        });
    }
    return dirReady;
  }

  /** Appends, and survives the session directory disappearing underneath a
   *  long-lived store.
   *
   *  `ensureDir()` caches its resolved `mkdir` promise, so after ONE
   *  successful mkdir the store never calls mkdir again for the rest of the
   *  process's life. If the directory is then removed — a log rotation, a
   *  `rm -rf .litro`, a tmpfs reaper, a test wiping state — every subsequent
   *  append fails with ENOENT forever: the store is poisoned, not merely
   *  unlucky, and the agent endpoint 500s on every turn until the server is
   *  restarted. (That is exactly what CI saw in issue #118.)
   *
   *  ENOENT here can only mean a missing directory component: the file
   *  itself is created on demand by the append. So drop the cached mkdir,
   *  recreate the directory and retry the append ONCE. A second ENOENT is a
   *  real fault (a path that cannot be created) and propagates. */
  async function appendWithDirRecovery(filePath: string, line: string): Promise<void> {
    try {
      await appendFile(filePath, line);
    } catch (err) {
      if ((err as NodeJS.ErrnoException)?.code !== 'ENOENT') throw err;
      dirReady = undefined;
      await ensureDir();
      await appendFile(filePath, line);
    }
  }

  async function initSeqIfNeeded(sessionId: string): Promise<void> {
    if (seqs.has(sessionId)) return;

    const filePath = `${dir}/${sessionId}.jsonl`;
    let lastSeq = 0;

    try {
      const content = await readFile(filePath, 'utf-8');
      const lines = content.trim().split('\n');

      // Read from end to find last valid seq
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i];
        if (!line) continue;

        try {
          const event = JSON.parse(line) as SessionEvent;
          lastSeq = event.seq;
          break;
        } catch {
          // Skip malformed line, continue backward
        }
      }
    } catch {
      // File doesn't exist or can't be read; start at 0
    }

    seqs.set(sessionId, lastSeq);
  }

  return {
    async append(sessionId: string, event: Omit<SessionEvent, 'seq'>): Promise<SessionEvent> {
      validateSessionId(sessionId);

      // Get or create the chain for this session. Recover from a prior
      // rejection (`.catch(() => {})`) before chaining so a single failed
      // append doesn't permanently poison every subsequent append for the
      // session — the failed append still rejects to ITS caller via
      // `newChain` below, but the chain itself continues running.
      const currentChain = chains.get(sessionId) ?? Promise.resolve();

      let resultEvent: SessionEvent | undefined;

      const newChain = currentChain.catch(() => {}).then(async () => {
        // Create directory if needed
        await ensureDir();

        // Initialize seq on first touch
        await initSeqIfNeeded(sessionId);

        // Compute the next seq locally; only commit it to the map after the
        // write succeeds, so a failed append leaves no trace in memory.
        const currentSeq = seqs.get(sessionId)!;
        const seq = currentSeq + 1;

        // Build complete event (payload is plain JSON in the log; seroval wraps only the WIRE, not the store)
        resultEvent = {
          seq,
          ts: event.ts,
          kind: event.kind,
          payload: event.payload,
        };

        // Write to file
        const filePath = `${dir}/${sessionId}.jsonl`;
        await appendWithDirRecovery(filePath, JSON.stringify(resultEvent) + '\n');

        // Only advance the in-memory counter once the write is durable.
        seqs.set(sessionId, seq);
      });

      chains.set(sessionId, newChain);

      // Wait for the chain to complete and return the event
      try {
        await newChain;
        return resultEvent!;
      } finally {
        // Registry hygiene: once this link settles (success or rejection),
        // drop it from the map if it's still the current entry for this
        // session -- i.e. nothing chained onto it while it was running. If a
        // concurrent append already replaced the map entry with a newer
        // link, leave it alone; that later link owns cleanup when IT
        // settles. This keeps `chains` from growing forever across the
        // lifetime of a long-running process as distinct session ids come
        // and go, while never racing: the get/delete pair below is
        // synchronous, so nothing can interleave between the check and the
        // delete.
        if (chains.get(sessionId) === newChain) {
          chains.delete(sessionId);
        }
      }
    },

    async *read(sessionId: string, fromSeq = 0): AsyncIterable<SessionEvent> {
      validateSessionId(sessionId);

      const filePath = `${dir}/${sessionId}.jsonl`;

      try {
        const content = await readFile(filePath, 'utf-8');
        const lines = content.trim().split('\n');

        for (const line of lines) {
          if (!line) continue;

          try {
            const event = JSON.parse(line) as SessionEvent;
            if (event.seq >= fromSeq) {
              yield event;
            }
          } catch {
            // Skip malformed lines silently
          }
        }
      } catch {
        // File doesn't exist; return empty async iterable
      }
    },
  };
}
