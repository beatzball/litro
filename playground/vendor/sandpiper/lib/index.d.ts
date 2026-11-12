import type { CreateMachineOptions, EventsOptions, ExecOptions, ExecResult, ExecStreamEvent, MachineInfo, RequestOptions, SandpiperEvent, SandpiperOptions } from './types.js';
export type * from './types.js';
export declare class SandpiperError extends Error {
    readonly status: number;
    readonly name = "SandpiperError";
    constructor(message: string, status: number);
}
export declare class StreamError extends Error {
    readonly name = "StreamError";
}
export declare class ExecError extends Error {
    readonly event: ExecStreamEvent;
    readonly name = "ExecError";
    constructor(message: string, event: ExecStreamEvent);
}
export declare class Sandpiper {
    private readonly baseUrl;
    private readonly token;
    constructor({ baseUrl, token }: SandpiperOptions);
    machine(id: string): Machine;
    createMachine(options: CreateMachineOptions, request?: RequestOptions): Promise<Machine>;
    /** Internal transport shared by machine handles. HTTP failures are never retried. */
    request(path: string, method: string, body?: unknown, signal?: AbortSignal): Promise<Response>;
    /** Replay and follow a machine, reconnecting after EOF or transport failure. */
    events(machineId: string, options?: EventsOptions): AsyncGenerator<SandpiperEvent>;
}
export declare class Machine {
    private readonly client;
    readonly id: string;
    constructor(client: Sandpiper, id: string);
    info(options?: RequestOptions): Promise<MachineInfo>;
    destroy(options?: RequestOptions): Promise<void>;
    /** Raw wire events. A lost exec stream throws; the command is never submitted twice. */
    execStream(cmd: readonly string[], options?: ExecOptions): AsyncGenerator<ExecStreamEvent>;
    exec(cmd: readonly string[], options?: ExecOptions): Promise<ExecResult>;
}
