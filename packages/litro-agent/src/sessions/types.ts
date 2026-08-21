export type SessionEventKind =
  | 'message'
  | 'text-delta'
  | 'tool-call'
  | 'tool-progress'
  | 'tool-result'
  | 'ui'
  | 'error'
  | 'turn-end';

export interface SessionEvent {
  seq: number;
  ts: number;
  kind: SessionEventKind;
  payload: unknown;
}

/**
 * A held turn lock. Returned by `SessionStore.acquireLease`; the runtime
 * renews it on a heartbeat for the life of a turn and releases it in a
 * `finally`.
 */
export interface SessionLease {
  /** Opaque owner id, unique per acquisition. */
  readonly owner: string;
  /** Extends the lease. Resolves false if ownership was lost (the lease
   *  expired and another instance took it over) — the runtime stops
   *  renewing but does NOT abort the turn: an in-flight turn always runs to
   *  completion, per the durability contract. */
  renew(): Promise<boolean>;
  /** Releases the lease if still owned. Idempotent. */
  release(): Promise<void>;
}

export interface SessionStore {
  append(sessionId: string, event: Omit<SessionEvent, 'seq'>): Promise<SessionEvent>;
  read(sessionId: string, fromSeq?: number): AsyncIterable<SessionEvent>;

  /**
   * OPTIONAL cross-instance turn lock. A store that implements it upgrades
   * the runtime's per-process lock to a real distributed one; a store that
   * does not (the default JSONL store) keeps the single-process behaviour.
   *
   * `key` is an OPAQUE lock key, not a session id — the runtime passes
   * `<agent>/<session>` so two agents can share a session id without
   * contending. Resolves null when another owner currently holds it.
   */
  acquireLease?(key: string, opts?: { ttlMs?: number }): Promise<SessionLease | null>;

  /**
   * OPTIONAL companion to `acquireLease`: is a turn in flight for `key`
   * right now, anywhere? The live-tail GET path uses this to decide whether
   * to keep a reconnecting client's stream open when the turn is running on
   * a DIFFERENT instance, where the in-process broadcast can never reach it.
   * An expired lease must report false.
   */
  isLeased?(key: string): Promise<boolean>;
}
