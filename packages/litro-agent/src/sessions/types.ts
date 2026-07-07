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

export interface SessionStore {
  append(sessionId: string, event: Omit<SessionEvent, 'seq'>): Promise<SessionEvent>;
  read(sessionId: string, fromSeq?: number): AsyncIterable<SessionEvent>;
}
