export type JsonValue = null | boolean | number | string | JsonValue[] | {
    [key: string]: JsonValue;
};
export interface SandpiperOptions {
    baseUrl: string;
    token: string;
}
export interface RequestOptions {
    /** Cancel the HTTP request. An accepted exec continues on the host. */
    signal?: AbortSignal;
}
export interface CreateMachineOptions {
    template: string;
    ttl?: {
        idleMs?: number;
        maxMs?: number;
    };
    metadata?: JsonValue;
}
export interface ExecOptions extends RequestOptions {
    cwd?: string;
    env?: Record<string, string>;
    /** UTF-8 text or raw bytes; bytes travel as stdinBase64. */
    stdin?: string | Uint8Array;
    timeoutMs?: number;
}
export interface EventsOptions extends RequestOptions {
    /** Inclusive per-machine sequence number. Defaults to 1. */
    from?: number;
}
export interface MachineInfo {
    id: string;
    state: 'starting' | 'running' | 'stopping' | 'destroyed' | 'failed';
    reason: string | null;
    template: string | null;
    createdAt: number | null;
    /** Present while the machine is in memory on the host. */
    expiresAt?: number;
    idleMs?: number;
}
export interface ExecResult {
    /** Null when the host ends the exec with exec.timedout. */
    exitCode: number | null;
    stdout: string;
    stderr: string;
    /** Host truncation flags; timeout events do not supply these flags. */
    stdoutTruncated: boolean;
    stderrTruncated: boolean;
    timedOut: boolean;
}
export interface EventBase {
    machine: string;
    seq: number;
    /** Milliseconds since the Unix epoch. */
    time: number;
}
type Event<T extends string, Fields = object> = EventBase & {
    type: T;
} & Fields;
export type MachineEvent = Event<'machine.created', {
    template: string;
    metadata: JsonValue;
}> | Event<'machine.checked', {
    walls: string[];
}> | Event<'machine.running', {
    readyMs: number;
}> | Event<'machine.failed', {
    reason: string;
}> | Event<'machine.destroyed', {
    reason: string;
}>;
export type ExecEvent = Event<'exec.started', {
    exec: string;
    cmd: string[];
}> | Event<'exec.stdout' | 'exec.stderr', {
    exec: string;
    data: string;
}> | Event<'exec.error', {
    exec: string;
    message: string;
}> | Event<'exec.exited', {
    exec: string;
    code: number;
    stdoutTruncated: boolean;
    stderrTruncated: boolean;
}> | Event<'exec.timedout', {
    exec: string;
    timeoutMs: number;
}> | Event<'exec.failed', {
    exec: string;
    reason: string;
}>;
/** A stream error has no machine, sequence number, or timestamp. */
export interface StreamErrorEvent {
    type: 'stream.error';
    message: string;
}
export type SandpiperEvent = MachineEvent | ExecEvent | StreamErrorEvent;
export type ExecStreamEvent = ExecEvent | Extract<MachineEvent, {
    type: 'machine.destroyed';
}> | StreamErrorEvent;
export {};
