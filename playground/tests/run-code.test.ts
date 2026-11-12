import { createServer, type Server } from 'node:http';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Sandpiper, type MachineInfo } from '@beatzball/sandpiper';
import { TOOL_CONFIG, type UIResult } from '@beatzball/litro-agent';
import { sessionMachines } from '../server/machines.js';
import { authenticatedContext, identity, testToken } from './coder-context.js';
import runCode from '../agents/coder/tools/run-code.js';

let server: Server;
let directory: string;
let url: string;
let creates: number;
let infoFailure: number;
let state: MachineInfo['state'];
let stdout: string;
let stderr: string;
let exitCode: number;
let timedOut: boolean;
let executions: unknown[];
let headers: string[];
let destroys: number;
let destroyFailure: boolean;
const faults = vi.hoisted(() => ({ failRename: false }));
vi.mock('node:fs/promises', async (load) => {
  const actual = await load<typeof import('node:fs/promises')>();
  return { ...actual, rename: async (...args: Parameters<typeof actual.rename>) => {
    if (faults.failRename) throw new Error('Save failed');
    return actual.rename(...args);
  } };
});

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'litro-run-code-'));
  vi.stubEnv('CODER_ACCESS_TOKEN', testToken);
  creates = 0;
  destroys = 0;
  destroyFailure = false;
  faults.failRename = false;
  infoFailure = 0;
  state = 'running';
  stdout = '2\n';
  stderr = '';
  exitCode = 0;
  timedOut = false;
  executions = [];
  headers = [];
  server = createServer(async (req, res) => {
    headers.push(req.headers.authorization ?? '');
    res.setHeader('content-type', 'application/json');
    if (req.method === 'POST' && req.url === '/v1/machines') {
      let body = '';
      for await (const chunk of req) body += chunk;
      expect(JSON.parse(body)).toEqual({ template: 'node' });
      creates++;
      res.writeHead(201).end(JSON.stringify({ id: `m_${creates.toString(16).padStart(16, '0')}` }));
    } else if (req.method === 'GET') {
      if (infoFailure) res.writeHead(infoFailure).end(JSON.stringify({ error: 'Cannot read machine' }));
      else res.end(JSON.stringify({ state }));
    } else if (req.url?.endsWith('/exec')) {
      let body = '';
      for await (const chunk of req) body += chunk;
      executions.push(JSON.parse(body));
      const id = req.url.split('/')[3];
      const event = (type: string, seq: number, extra: Record<string, unknown>) =>
        JSON.stringify({ type, machine: id, exec: 'e_1', time: 1, seq, ...extra }) + '\n';
      res.setHeader('content-type', 'application/x-ndjson');
      res.end(event('exec.stdout', 1, { data: Buffer.from(stdout).toString('base64') }) +
        event('exec.stderr', 2, { data: Buffer.from(stderr).toString('base64') }) +
        (timedOut ? event('exec.timedout', 3, { timeoutMs: 10000 }) :
          event('exec.exited', 3, { code: exitCode, stdoutTruncated: false, stderrTruncated: false })));
    } else if (req.method === 'DELETE') {
      destroys++;
      res.writeHead(destroyFailure ? 500 : 204).end();
    }
    else res.writeHead(404).end();
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing HTTP listener');
  url = `http://127.0.0.1:${address.port}`;
  vi.stubEnv('SANDPIPER_URL', url);
  vi.stubEnv('SANDPIPER_TOKEN', 'test-token');
  vi.stubEnv('SANDPIPER_SESSIONS_DIR', directory);
});
afterEach(async () => {
  vi.restoreAllMocks();
  faults.failRename = false;
  vi.unstubAllEnvs();
  server.closeAllConnections();
  await new Promise<void>((done, reject) => server.close((error) => error ? reject(error) : done()));
  await rm(directory, { recursive: true, force: true });
});

function bindings(scope = url) {
  return sessionMachines(new Sandpiper({ baseUrl: url, token: 'test-token' }), directory, scope, { perPrincipal: 8 });
}
const options = { template: 'node' };
const tool = runCode[TOOL_CONFIG];
const execute = (cmd = ['node', '-e', 'console.log(1+1)']) =>
  tool.execute({ cmd }, authenticatedContext()) as Promise<UIResult>;

describe('session machines', () => {
  it('coalesces concurrent creates and persists the binding across reloads', async () => {
    const manager = bindings();
    const [a, b] = await Promise.all([manager.forSession(identity('session'), options), manager.forSession(identity('session'), options)]);
    const reloaded = await bindings().forSession(identity('session'), options);
    expect([a.id, b.id, reloaded.id]).toEqual(Array(3).fill(a.id));
    expect(creates).toBe(1);
    expect(headers.every((header) => header === 'Bearer test-token')).toBe(true);
  });

  it('separates sessions and daemon scopes and never uses a session as a path', async () => {
    await bindings().forSession(identity('../../outside'), options);
    await bindings().forSession(identity('other'), options);
    await bindings('another-host').forSession(identity('other'), options);
    expect(creates).toBe(3);
    expect(await readdir(directory)).toEqual(['admission.json']);
  });

  it.each(['destroyed', 'failed'] as const)('replaces a %s machine', async (nextState) => {
    const manager = bindings();
    const first = await manager.forSession(identity('session'), options);
    state = nextState;
    const second = await manager.forSession(identity('session'), options);
    expect(second.id).not.toBe(first.id);
    expect(creates).toBe(2);
  });

  it('replaces a machine that the daemon no longer knows', async () => {
    const manager = bindings();
    await manager.forSession(identity('session'), options);
    infoFailure = 404;
    await manager.forSession(identity('session'), options);
    expect(creates).toBe(2);
  });

  it.each([401, 500])('propagates HTTP %s without allocating a new machine', async (status) => {
    const manager = bindings();
    await manager.forSession(identity('session'), options);
    infoFailure = status;
    await expect(manager.forSession(identity('session'), options)).rejects.toMatchObject({ status });
    expect(creates).toBe(1);
  });

  it('reports a damaged binding without exposing a server path or creating another machine', async () => {
    const manager = bindings();
    await manager.forSession(identity('session'), options);
    const [file] = await readdir(directory);
    await writeFile(join(directory, file), '{');
    await expect(manager.forSession(identity('session'), options)).rejects.toThrow('Could not read coder machine accounting');
    expect(creates).toBe(1);
  });

  it('isolates principals and namespaces every machine binding', async () => {
    const manager = bindings();
    const a = await manager.forSession(identity('shared', 'alice'), options);
    const b = await manager.forSession(identity('shared', 'bob'), options);
    expect(a.id).not.toBe(b.id);
    expect(() => manager.forSession(identity('mcp'), options)).toThrow('Persistent machines');
  });

  it('serializes quota admission across independent managers and reloads', async () => {
    const a = sessionMachines(new Sandpiper({ baseUrl: url, token: 'test-token' }), directory, url);
    const b = sessionMachines(new Sandpiper({ baseUrl: url, token: 'test-token' }), directory, url);
    const results = await Promise.allSettled(Array.from({ length: 8 }, (_, i) => (i % 2 ? a : b).forSession(identity(`session-${i}`), options)));
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(2);
    expect(creates).toBe(2);
    await expect(bindings().forSession(identity('third', 'other'), options)).resolves.toBeDefined();
    const limited = sessionMachines(new Sandpiper({ baseUrl: url, token: 'test-token' }), directory, url, { global: 3 });
    await expect(limited.forSession(identity('fourth', 'new'), options)).rejects.toThrow('global live machine limit');
  });

  it.each(['starting', 'stopping'] as const)('keeps %s machines accounted until terminal state or 404', async (nextState) => {
    const manager = sessionMachines(new Sandpiper({ baseUrl: url, token: 'test-token' }), directory, url, { global: 1 });
    await manager.forSession(identity(), options);
    state = nextState;
    await expect(manager.forSession(identity(), options)).rejects.toThrow('starting or stopping');
    await expect(manager.forSession(identity('second', 'bob'), options)).rejects.toThrow('global live machine limit');
    expect(creates).toBe(1);
  });

  it('persists rate accounting through cleanup, replacements, and manager reloads', async () => {
    await bindings().forSession(identity('one'), options);
    state = 'destroyed';
    const manager = () => sessionMachines(new Sandpiper({ baseUrl: url, token: 'test-token' }), directory, url, { perMinute: 1 });
    await expect(manager().forSession(identity('two'), options)).rejects.toThrow('creation rate limit');
    const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 61000);
    await expect(manager().forSession(identity('two'), options)).resolves.toBeDefined();
    expect(creates).toBe(2);
    clock.mockRestore();
  });

  it('enforces creation rate globally across different principals after expired binding cleanup', async () => {
    const manager = () => sessionMachines(new Sandpiper({ baseUrl: url, token: 'test-token' }), directory, url, { globalPerMinute: 2 });
    await manager().forSession(identity('one', 'alice'), options);
    state = 'destroyed';
    await manager().forSession(identity('two', 'bob'), options);
    await expect(manager().forSession(identity('three', 'charlie'), options)).rejects.toThrow('creation rate limit');
    expect(creates).toBe(2);
  });

  it('retains a durable capacity reservation after an accepted create loses its response', async () => {
    const original = globalThis.fetch;
    const lost = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const response = await original(input, init);
      if (init?.method === 'POST' && String(input).endsWith('/v1/machines')) {
        await response.text();
        throw new Error('Response lost');
      }
      return response;
    });
    const manager = () => sessionMachines(new Sandpiper({ baseUrl: url, token: 'test-token' }), directory, url, { global: 1 });
    await expect(manager().forSession(identity(), options)).rejects.toThrow('Response lost');
    lost.mockRestore();
    await expect(manager().forSession(identity(), options)).rejects.toThrow('uncertain outcome');
    await expect(manager().forSession(identity('other', 'bob'), options)).rejects.toThrow('global live machine limit');
    expect(creates).toBe(1);
  });

  it('retains capacity if saving an accepted machine and compensating destroy both fail', async () => {
    const original = globalThis.fetch;
    const failedSave = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const response = await original(input, init);
      if (init?.method === 'POST' && String(input).endsWith('/v1/machines')) faults.failRename = true;
      return response;
    });
    destroyFailure = true;
    const manager = () => sessionMachines(new Sandpiper({ baseUrl: url, token: 'test-token' }), directory, url, { global: 1 });
    await expect(manager().forSession(identity(), options)).rejects.toThrow('Save failed');
    faults.failRename = false;
    failedSave.mockRestore();
    expect(destroys).toBe(1);
    await expect(manager().forSession(identity('other', 'bob'), options)).rejects.toThrow('global live machine limit');
    expect(creates).toBe(1);
  });

  it('creates an isolated MCP machine per call and destroys it after success and failed execution', async () => {
    const manager = bindings();
    const ids: string[] = [];
    for (let i = 0; i < 2; i++) await manager.withMachine(identity('mcp', 'alice', 'mcp'), options, async (machine) => { ids.push(machine.id); });
    await expect(manager.withMachine(identity('mcp', 'alice', 'mcp'), options, async () => { throw new Error('Exec failed'); })).rejects.toThrow('Exec failed');
    expect(new Set(ids).size).toBe(2);
    expect(destroys).toBe(3);
    expect(creates).toBe(3);
  });

  it('retains quota when MCP machine destroy fails', async () => {
    const manager = sessionMachines(new Sandpiper({ baseUrl: url, token: 'test-token' }), directory, url, { perPrincipal: 1 });
    destroyFailure = true;
    await expect(manager.withMachine(identity('mcp', 'alice', 'mcp'), options, async () => 'done')).rejects.toBeDefined();
    await expect(bindings().withMachine(identity('mcp', 'alice', 'mcp'), options, async () => 'done')).rejects.toBeDefined();
    expect(destroys).toBe(2);
    const limited = sessionMachines(new Sandpiper({ baseUrl: url, token: 'test-token' }), directory, url, { perPrincipal: 1 });
    await expect(limited.withMachine(identity('mcp', 'alice', 'mcp'), options, async () => 'done')).rejects.toThrow('principal live machine limit');
  });

  it('propagates a network failure without allocating a new machine', async () => {
    const manager = bindings();
    await manager.forSession(identity('session'), options);
    const unavailable = vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('Connection refused'));
    await expect(manager.forSession(identity('session'), options)).rejects.toThrow('Connection refused');
    unavailable.mockRestore();
    expect(creates).toBe(1);
  });
});

describe('run-code tool', () => {
  it('executes through the client and returns SSR with trimmed model data', async () => {
    stdout = 'begin-' + 'a'.repeat(9000) + '-stdout-end';
    stderr = 'begin-' + 'b'.repeat(5000) + '-stderr-end';
    exitCode = 7;
    const result = await execute();
    expect(executions).toEqual([{ cmd: ['node', '-e', 'console.log(1+1)'], timeoutMs: 10000 }]);
    expect(result.data).toEqual({ exitCode: 7, stdout: stdout.slice(-8000), stderr: stderr.slice(-4000) });
    expect(result.html).toContain('<run-output');
    expect(result.html).toContain('<template shadowroot="open" shadowrootmode="open">');
    expect(result.html).toContain('Exit code: 7');
    expect(result.html).toContain(stdout);
    expect(result.html).toContain(stderr);
    expect(result.hydrate?.props).toMatchObject({ result: { exitCode: 7, stdout, stderr } });
    expect(JSON.stringify(result.data)).not.toContain('shadowroot');
  });

  it('bounds UI and hydration previews by UTF-8 bytes while preserving model trimming', async () => {
    stdout = '🙂'.repeat(50000);
    stderr = '€'.repeat(50000);
    const result = await execute();
    const visible = result.hydrate!.props!.result as { stdout: string; stderr: string; stdoutTruncated: boolean; stderrTruncated: boolean };
    for (const value of [visible.stdout, visible.stderr]) {
      expect(Buffer.byteLength(value, 'utf8')).toBeLessThanOrEqual(65536);
      expect(value).not.toContain('�');
    }
    expect(visible.stdoutTruncated).toBe(true);
    expect(visible.stderrTruncated).toBe(true);
    expect(result.html).not.toContain(stdout);
    expect(result.data).toMatchObject({ stdout: stdout.slice(-8000), stderr: stderr.slice(-4000) });
  });

  it('escapes command output as text in the SSR fragment', async () => {
    stdout = '<script>alert(1)</script><img src=x onerror=alert(1)>';
    const result = await execute(['echo', '<script>']);
    expect(result.html).not.toContain('<script>');
    expect(result.html).not.toContain('<img src=');
    expect(result.html).toContain('&lt;script&gt;');
    expect(result.data).toMatchObject({ stdout });
  });

  it('reports command timeouts in SSR and returns a null exit code', async () => {
    timedOut = true;
    const result = await execute(['sleep', '30']);
    expect(result.html).toContain('Timed out');
    expect(result.data).toMatchObject({ exitCode: null });
  });

  it('does not run the command twice when its stream drops', async () => {
    const original = globalThis.fetch;
    const interrupted = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      if (String(input).endsWith('/exec')) return new Response('');
      return original(input, init);
    });
    await expect(execute()).rejects.toThrow('Exec stream ended');
    expect(interrupted.mock.calls.filter(([url]) => String(url).endsWith('/exec'))).toHaveLength(1);
    interrupted.mockRestore();
  });

  it.each(['SANDPIPER_URL', 'SANDPIPER_TOKEN'])('gives a clear error with %s unset', async (name) => {
    vi.stubEnv(name, '');
    await expect(execute()).rejects.toThrow('Run-code needs SANDPIPER_URL and SANDPIPER_TOKEN');
    expect(creates).toBe(0);
  });

  it('publishes a schema that rejects empty and NUL-containing argv', async () => {
    for (const cmd of [[], ['echo', '\0'], 'echo hello']) {
      const result = await tool.input['~standard'].validate({ cmd });
      expect(result.issues?.length).toBeGreaterThan(0);
    }
    const valid = await tool.input['~standard'].validate({ cmd: ['sh', '-c', 'echo hello'] });
    expect(valid.issues).toBeUndefined();
  });
});
