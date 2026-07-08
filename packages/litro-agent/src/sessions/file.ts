import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'pathe';
import { AgentError } from '../errors.js';
import type { SessionEvent, SessionStore } from './types.js';

export function validateSessionId(id: string): void {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) {
    throw new AgentError(`Invalid session id: ${id}`, { status: 400 });
  }
}

export function fileSessionStore(opts?: { dir?: string }): SessionStore {
  const dir = resolve(process.cwd(), opts?.dir ?? '.litro/sessions');

  // Per-session promise chains for serialized writes
  const chains = new Map<string, Promise<void>>();
  // Per-session sequence counters
  const seqs = new Map<string, number>();

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

      // Get or create the chain for this session
      const currentChain = chains.get(sessionId) ?? Promise.resolve();

      let resultEvent: SessionEvent | undefined;

      const newChain = currentChain.then(async () => {
        // Create directory if needed
        await mkdir(dir, { recursive: true });

        // Initialize seq on first touch
        await initSeqIfNeeded(sessionId);

        // Increment and assign seq
        const currentSeq = seqs.get(sessionId)!;
        const seq = currentSeq + 1;
        seqs.set(sessionId, seq);

        // Build complete event (payload is plain JSON in the log; seroval wraps only the WIRE, not the store)
        resultEvent = {
          seq,
          ts: event.ts,
          kind: event.kind,
          payload: event.payload,
        };

        // Write to file
        const filePath = `${dir}/${sessionId}.jsonl`;
        await appendFile(filePath, JSON.stringify(resultEvent) + '\n');
      });

      chains.set(sessionId, newChain);

      // Wait for the chain to complete and return the event
      await newChain;
      return resultEvent!;
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
