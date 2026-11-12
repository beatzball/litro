import { setTimeout as delay } from 'node:timers/promises';
export class SandpiperError extends Error {
    status;
    name = 'SandpiperError';
    constructor(message, status) {
        super(message);
        this.status = status;
    }
}
export class StreamError extends Error {
    name = 'StreamError';
}
export class ExecError extends Error {
    event;
    name = 'ExecError';
    constructor(message, event) {
        super(message);
        this.event = event;
    }
}
/** Parse complete NDJSON records across arbitrary HTTP chunk boundaries. */
async function* records(response) {
    if (!response.body)
        throw new StreamError('The response has no event stream');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let pending = '';
    const parse = (line) => {
        try {
            const value = JSON.parse(line);
            if (!value || typeof value !== 'object' || !('type' in value) || typeof value.type !== 'string') {
                throw new Error('Missing event type');
            }
            if (value.type !== 'stream.error' &&
                (!('seq' in value) || !Number.isSafeInteger(value.seq) || Number(value.seq) < 1)) {
                throw new Error('Invalid event sequence');
            }
            const event = value;
            const strings = (...keys) => keys.every(key => typeof event[key] === 'string');
            const number = (key) => Number.isSafeInteger(event[key]);
            const stringArray = (key) => Array.isArray(event[key]) && event[key].every(item => typeof item === 'string');
            if (event.type !== 'stream.error' && (!strings('machine') || !number('time')))
                throw new Error('Invalid event envelope');
            let valid = false;
            switch (event.type) {
                case 'machine.created':
                    valid = strings('template') && 'metadata' in event;
                    break;
                case 'machine.checked':
                    valid = stringArray('walls');
                    break;
                case 'machine.running':
                    valid = number('readyMs');
                    break;
                case 'machine.failed':
                case 'machine.destroyed':
                    valid = strings('reason');
                    break;
                case 'exec.started':
                    valid = strings('exec') && stringArray('cmd');
                    break;
                case 'exec.stdout':
                case 'exec.stderr':
                    valid = strings('exec', 'data');
                    break;
                case 'exec.error':
                    valid = strings('exec', 'message');
                    break;
                case 'exec.exited':
                    valid = strings('exec') && number('code') && typeof event.stdoutTruncated === 'boolean' && typeof event.stderrTruncated === 'boolean';
                    break;
                case 'exec.timedout':
                    valid = strings('exec') && number('timeoutMs');
                    break;
                case 'exec.failed':
                    valid = strings('exec', 'reason');
                    break;
                case 'stream.error':
                    valid = strings('message');
                    break;
            }
            if (!valid)
                throw new Error('Invalid event fields');
            return value;
        }
        catch {
            throw new StreamError('Invalid NDJSON event');
        }
    };
    try {
        while (true) {
            const { value, done } = await reader.read();
            pending += decoder.decode(value, { stream: !done });
            let newline;
            while ((newline = pending.indexOf('\n')) !== -1) {
                const line = pending.slice(0, newline).trim();
                pending = pending.slice(newline + 1);
                if (line)
                    yield parse(line);
            }
            if (done) {
                if (pending.trim()) {
                    // A connection can close in the middle of a record. Replay the
                    // unfinished record from the last complete sequence number.
                    try {
                        JSON.parse(pending);
                    }
                    catch {
                        throw new TypeError('Stream ended inside an NDJSON record');
                    }
                    yield parse(pending);
                }
                return;
            }
        }
    }
    finally {
        await reader.cancel().catch(() => { });
        reader.releaseLock();
    }
}
function checkId(id) {
    if (!/^m_[0-9a-f]{16}$/.test(id))
        throw new TypeError('Invalid machine id');
}
export class Sandpiper {
    baseUrl;
    token;
    constructor({ baseUrl, token }) {
        const url = new URL(baseUrl);
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
            throw new TypeError('baseUrl must be an HTTP(S) URL without credentials, query, or fragment');
        }
        this.baseUrl = url.href.replace(/\/$/, '');
        this.token = token;
    }
    machine(id) {
        checkId(id);
        return new Machine(this, id);
    }
    async createMachine(options, request = {}) {
        const response = await this.request('/v1/machines', 'POST', options, request.signal);
        const info = await response.json();
        return this.machine(info.id);
    }
    /** Internal transport shared by machine handles. HTTP failures are never retried. */
    async request(path, method, body, signal) {
        const response = await fetch(`${this.baseUrl}${path}`, {
            method,
            headers: {
                Authorization: `Bearer ${this.token}`,
                ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
            },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
            ...(signal === undefined ? {} : { signal }),
            redirect: 'manual',
        });
        if (!response.ok) {
            const text = await response.text();
            let message = text || response.statusText;
            try {
                const parsed = JSON.parse(text);
                if (typeof parsed.error === 'string')
                    message = parsed.error;
            }
            catch { /* Some framework errors have plain-text bodies. */ }
            throw new SandpiperError(message, response.status);
        }
        return response;
    }
    /** Replay and follow a machine, reconnecting after EOF or transport failure. */
    async *events(machineId, options = {}) {
        checkId(machineId);
        let next = options.from ?? 1;
        if (!Number.isSafeInteger(next) || next < 1)
            throw new TypeError('from must be a positive safe integer');
        let retryMs = 100;
        while (true) {
            options.signal?.throwIfAborted();
            let received = false;
            try {
                const response = await this.request(`/v1/events?machine=${machineId}&from=${next}`, 'GET', undefined, options.signal);
                for await (const event of records(response)) {
                    if (event.type === 'stream.error') {
                        yield event;
                        throw new StreamError(event.message);
                    }
                    if (event.machine !== machineId)
                        throw new StreamError('Event belongs to another machine');
                    if (event.seq < next)
                        continue;
                    next = event.seq + 1;
                    received = true;
                    retryMs = 100;
                    yield event;
                    if (event.type === 'machine.destroyed')
                        return;
                }
                // The server closes an empty replay when the cursor is past destruction.
                if (!received) {
                    const info = await this.machine(machineId).info(options);
                    if (info.state === 'destroyed' || info.state === 'failed')
                        return;
                }
            }
            catch (error) {
                options.signal?.throwIfAborted();
                if (error instanceof SandpiperError || error instanceof StreamError)
                    throw error;
                // Fetch and body transport errors are safe to retry for this GET.
                if (!(error instanceof TypeError))
                    throw error;
            }
            await delay(retryMs, undefined, options.signal ? { signal: options.signal } : {});
            retryMs = Math.min(retryMs * 2, 5_000);
        }
    }
}
export class Machine {
    client;
    id;
    constructor(client, id) {
        this.client = client;
        this.id = id;
        checkId(id);
    }
    async info(options = {}) {
        const response = await this.client.request(`/v1/machines/${this.id}`, 'GET', undefined, options.signal);
        return await response.json();
    }
    async destroy(options = {}) {
        const response = await this.client.request(`/v1/machines/${this.id}`, 'DELETE', undefined, options.signal);
        await response.body?.cancel();
    }
    /** Raw wire events. A lost exec stream throws; the command is never submitted twice. */
    async *execStream(cmd, options = {}) {
        const { signal, stdin, cwd, env, timeoutMs } = options;
        const input = stdin instanceof Uint8Array
            ? { stdinBase64: Buffer.from(stdin).toString('base64') }
            : { stdin };
        const response = await this.client.request(`/v1/machines/${this.id}/exec`, 'POST', { cmd, cwd, env, timeoutMs, ...input }, signal);
        for await (const event of records(response)) {
            if (event.type !== 'stream.error' && event.machine !== this.id) {
                throw new StreamError('Event belongs to another machine');
            }
            if (!event.type.startsWith('exec.') && event.type !== 'machine.destroyed' && event.type !== 'stream.error') {
                throw new StreamError('Unexpected event in exec stream');
            }
            yield event;
            if (event.type === 'stream.error')
                throw new StreamError(event.message);
            if (['exec.exited', 'exec.timedout', 'exec.failed', 'machine.destroyed'].includes(event.type))
                return;
        }
        throw new StreamError('Exec stream ended before a terminal event; use events() to replay');
    }
    async exec(cmd, options = {}) {
        const stdout = [];
        const stderr = [];
        for await (const event of this.execStream(cmd, options)) {
            if (event.type === 'exec.stdout')
                stdout.push(Buffer.from(event.data, 'base64'));
            if (event.type === 'exec.stderr')
                stderr.push(Buffer.from(event.data, 'base64'));
            if (event.type === 'exec.failed' || event.type === 'machine.destroyed') {
                throw new ExecError(event.reason, event);
            }
            if (event.type === 'exec.exited' || event.type === 'exec.timedout') {
                return {
                    exitCode: event.type === 'exec.exited' ? event.code : null,
                    stdout: Buffer.concat(stdout).toString('utf8'),
                    stderr: Buffer.concat(stderr).toString('utf8'),
                    stdoutTruncated: event.type === 'exec.exited' && event.stdoutTruncated,
                    stderrTruncated: event.type === 'exec.exited' && event.stderrTruncated,
                    timedOut: event.type === 'exec.timedout',
                };
            }
        }
        throw new StreamError('Exec ended without a result');
    }
}
