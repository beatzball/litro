/**
 * `node:sqlite` session store — the multi-instance counterpart to the
 * default JSONL store.
 *
 * Two things it gives you that `fileSessionStore` cannot:
 *
 *  1. **Crash-safe sequence numbers.** `seq` is computed as `MAX(seq)+1`
 *     INSIDE the same `BEGIN IMMEDIATE` transaction as the insert, so there
 *     is no in-memory counter to lose on restart and no way for two writers
 *     (in this process or another) to mint the same seq.
 *  2. **A real turn lease** (`acquireLease`/`isLeased`), which upgrades the
 *     runtime's per-process turn lock to a cross-instance one. Without it,
 *     two app instances would happily run concurrent turns on one session.
 *
 * Requires **Node 22.5+** — `node:sqlite` does not exist before that, and
 * the repo's own `engines` range still admits Node 20. That is why this
 * lives behind its own subpath (`@beatzball/litro-agent/sessions/sqlite`)
 * and is never reachable from the package's default import graph. Node
 * prints an `ExperimentalWarning` for `node:sqlite`; that is Node's notice,
 * not this package's.
 *
 * Deliberate v0.1 limitation: `node:sqlite`'s `DatabaseSync` is
 * synchronous, so every append briefly blocks the event loop. Correctness
 * first — the same call the JSONL store made with fsync-per-append. A
 * worker-thread or async driver is a later knob.
 */
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { AgentError } from '../errors.js';
import { validateSessionId } from './file.js';
import type { SessionEvent, SessionLease, SessionStore } from './types.js';

export interface SqliteSessionStoreOptions {
  /** Database file path. Use `':memory:'` only for single-connection tests
   *  — an in-memory database is not shared between connections, so it can
   *  never demonstrate the multi-instance behaviour this store exists for. */
  path: string;
  /** Default lease duration. The runtime renews on a heartbeat at a third
   *  of this, so a lease only lapses if an instance stalls (or dies) for
   *  longer than the full TTL. Default 30s. */
  defaultLeaseTtlMs?: number;
  /** How long a writer waits for a competing write lock before failing.
   *  Default 5s. */
  busyTimeoutMs?: number;
}

/** Minimal structural view of the `node:sqlite` surface used here, so this
 *  module carries no build-time dependency on Node's type definitions. */
interface StatementLike {
  run(...params: unknown[]): { changes: number | bigint };
  all(...params: unknown[]): unknown[];
  get(...params: unknown[]): unknown;
}
interface DatabaseLike {
  exec(sql: string): void;
  prepare(sql: string): StatementLike;
  close(): void;
}
type DatabaseCtor = new (path: string) => DatabaseLike;

const DEFAULT_LEASE_TTL_MS = 30_000;
const DEFAULT_BUSY_TIMEOUT_MS = 5_000;

/** Loads `node:sqlite` synchronously, turning the Node-version failure into
 *  an actionable error rather than a bare ERR_UNKNOWN_BUILTIN_MODULE. */
function loadDatabaseSync(): DatabaseCtor {
  try {
    const require = createRequire(import.meta.url);
    const mod = require('node:sqlite') as { DatabaseSync?: DatabaseCtor };
    if (!mod.DatabaseSync) throw new Error('node:sqlite has no DatabaseSync export');
    return mod.DatabaseSync;
  } catch (err) {
    throw new AgentError(
      'sqliteSessionStore: node:sqlite is unavailable — it requires Node 22.5 or newer. ' +
        'Use the default fileSessionStore on older runtimes.',
      { status: 500, cause: err },
    );
  }
}

function toCount(changes: number | bigint): number {
  return typeof changes === 'bigint' ? Number(changes) : changes;
}

interface EventRow {
  seq: number | bigint;
  ts: number | bigint;
  kind: string;
  payload: string;
}

export interface SqliteSessionStore extends SessionStore {
  /** Closes the underlying database handle. Tests and short-lived scripts
   *  should call it; a long-running server never needs to. */
  close(): void;
}

export function sqliteSessionStore(opts: SqliteSessionStoreOptions): SqliteSessionStore {
  const DatabaseSync = loadDatabaseSync();
  const db = new DatabaseSync(opts.path);
  const leaseTtlMs = opts.defaultLeaseTtlMs ?? DEFAULT_LEASE_TTL_MS;

  // WAL lets readers (live-tailing GETs, replays) proceed while a turn is
  // appending. `synchronous = FULL` keeps the durability promise the JSONL
  // store made with fsync-per-append: an event acknowledged to the runtime
  // has hit the disk, which is what makes append-before-wire meaningful.
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA synchronous = FULL');
  db.exec(`PRAGMA busy_timeout = ${opts.busyTimeoutMs ?? DEFAULT_BUSY_TIMEOUT_MS}`);
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      session_id TEXT NOT NULL,
      seq INTEGER NOT NULL,
      ts INTEGER NOT NULL,
      kind TEXT NOT NULL,
      payload TEXT NOT NULL,
      PRIMARY KEY (session_id, seq)
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS leases (
      key TEXT PRIMARY KEY,
      owner TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    )
  `);

  const nextSeqStmt = db.prepare('SELECT COALESCE(MAX(seq), 0) + 1 AS next FROM events WHERE session_id = ?');
  const insertStmt = db.prepare('INSERT INTO events (session_id, seq, ts, kind, payload) VALUES (?, ?, ?, ?, ?)');
  const readStmt = db.prepare(
    'SELECT seq, ts, kind, payload FROM events WHERE session_id = ? AND seq >= ? ORDER BY seq ASC',
  );
  // Insert, or take over ONLY an expired row. The WHERE on the DO UPDATE is
  // what makes this atomic: a live lease makes the update a no-op and
  // `changes` comes back 0, with no read-then-write window for a second
  // instance to slip through.
  const acquireStmt = db.prepare(`
    INSERT INTO leases (key, owner, expires_at) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET owner = excluded.owner, expires_at = excluded.expires_at
    WHERE leases.expires_at <= ?
  `);
  const renewStmt = db.prepare('UPDATE leases SET expires_at = ? WHERE key = ? AND owner = ?');
  const releaseStmt = db.prepare('DELETE FROM leases WHERE key = ? AND owner = ?');
  const isLeasedStmt = db.prepare('SELECT 1 AS held FROM leases WHERE key = ? AND expires_at > ?');

  function makeLease(key: string, owner: string, ttlMs: number): SessionLease {
    let released = false;
    return {
      owner,
      renew(): Promise<boolean> {
        if (released) return Promise.resolve(false);
        const changes = toCount(renewStmt.run(Date.now() + ttlMs, key, owner).changes);
        return Promise.resolve(changes > 0);
      },
      release(): Promise<void> {
        if (released) return Promise.resolve();
        released = true;
        releaseStmt.run(key, owner);
        return Promise.resolve();
      },
    };
  }

  return {
    // `async` on purpose, not a plain Promise-returning function: it makes
    // the validateSessionId throw below a REJECTION, matching the JSONL
    // store's contract. A caller must never have to handle both.
    async append(sessionId: string, event: Omit<SessionEvent, 'seq'>): Promise<SessionEvent> {
      validateSessionId(sessionId);

      // BEGIN IMMEDIATE takes the write lock BEFORE the MAX(seq) read, so
      // no other writer — in this process or another instance — can read
      // the same high-water mark and mint a duplicate seq.
      db.exec('BEGIN IMMEDIATE');
      try {
        const row = nextSeqStmt.get(sessionId) as { next: number | bigint } | undefined;
        const seq = toCount(row?.next ?? 1);
        const payload = event.payload === undefined ? null : event.payload;
        insertStmt.run(sessionId, seq, event.ts, event.kind, JSON.stringify(payload) ?? 'null');
        db.exec('COMMIT');
        return { seq, ts: event.ts, kind: event.kind, payload };
      } catch (err) {
        try {
          db.exec('ROLLBACK');
        } catch {
          // The transaction was already resolved; nothing to undo.
        }
        throw err instanceof Error ? err : new Error(String(err));
      }
    },

    async *read(sessionId: string, fromSeq = 0): AsyncIterable<SessionEvent> {
      validateSessionId(sessionId);
      const rows = readStmt.all(sessionId, fromSeq) as EventRow[];
      for (const row of rows) {
        let payload: unknown;
        try {
          payload = JSON.parse(row.payload);
        } catch {
          // Mirrors the JSONL store's malformed-line tolerance: a row we
          // cannot parse is skipped rather than ending the replay.
          continue;
        }
        yield { seq: toCount(row.seq), ts: toCount(row.ts), kind: row.kind as SessionEvent['kind'], payload };
      }
    },

    acquireLease(key: string, leaseOpts?: { ttlMs?: number }): Promise<SessionLease | null> {
      const ttlMs = leaseOpts?.ttlMs ?? leaseTtlMs;
      const owner = randomUUID();
      const now = Date.now();
      const changes = toCount(acquireStmt.run(key, owner, now + ttlMs, now).changes);
      return Promise.resolve(changes > 0 ? makeLease(key, owner, ttlMs) : null);
    },

    isLeased(key: string): Promise<boolean> {
      return Promise.resolve(isLeasedStmt.get(key, Date.now()) !== undefined);
    },

    close(): void {
      db.close();
    },
  };
}
