/**
 * The Streamable HTTP route, over a real socket.
 *
 * A REAL HTTP SERVER, NOT A MOCK EVENT. The gates answer statuses and headers,
 * and a mocked `H3Event` would be this file's idea of what h3 does with
 * `setResponseStatus` rather than what a client receives. So every case here
 * goes through `node:http`, and the protocol cases are driven by the SDK's OWN
 * `Client` over its Streamable HTTP transport — AGENT-012: a suite we wrote
 * cannot check our own reading of the spec, so the other end is not ours.
 *
 * `playground/mcp-server/http-probe.mjs` is the same shape against a real
 * production Nitro build. This file is the part that runs in CI.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type Server } from 'node:http';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'pathe';
import { createApp, createRouter, toNodeListener } from 'h3';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { defineAgent } from '../index.js';
import type { AgentManifestEntry } from '../runtime/agent.js';
import { closeWhenDone, createMcpHandler, type McpHandlerOptions } from './http.js';
import { FIXTURE_UI_HTML, fixtureApps, fixtureTools } from './fixtures.js';

const TOKEN = 'unit-test-token-0123456789';

/** A manifest entry shaped exactly as the build-time scanner writes one. */
function entry(options: { access?: () => void } = {}): AgentManifestEntry {
  return {
    name: 'demo',
    module: {
      default: defineAgent({ model: null as never, instructions: 'You are a demo.' }),
      ...(options.access ? { access: options.access } : {}),
    },
    instructions: '',
    tools: [...fixtureTools()].map(([name, def]) => ({ name, module: { default: def } })),
  };
}

/**
 * A real `dist/mcp-apps/` on disk.
 *
 * The route reads the packed documents from the filesystem at boot, so a test
 * that handed it an in-memory array would skip the only part of app serving
 * that can go wrong in a deployment.
 */
async function writeApps(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
  const [app] = fixtureApps();
  await writeFile(join(dir, 'weather-card.html'), app.html, 'utf8');
  await writeFile(join(dir, 'weather-card.json'), JSON.stringify(app.descriptor), 'utf8');
  await writeFile(
    join(dir, 'manifest.json'),
    JSON.stringify([
      {
        name: app.name,
        uri: app.descriptor.uri,
        html: 'weather-card.html',
        descriptor: 'weather-card.json',
      },
    ]),
    'utf8',
  );
}

interface Running {
  base: string;
  url: string;
  logs: string[];
  close: () => Promise<void>;
}

/** Boots the handler behind `node:http` on a port the OS picked. */
async function serve(options: McpHandlerOptions, entries?: AgentManifestEntry[]): Promise<Running> {
  const logs: string[] = [];
  const handler = createMcpHandler(entries ?? [entry()], {
    log: (l) => void logs.push(l),
    ...options,
  });

  const app = createApp();
  const router = createRouter();
  // The same two entries a project declares in `nitro.config.ts`.
  router.post('/__litro/mcp/:agent', handler);
  router.options('/__litro/mcp/:agent', handler);
  app.use(router);

  const server: Server = createServer(toNodeListener(app));
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const { port } = server.address() as { port: number };
  const base = `http://127.0.0.1:${port}`;

  return {
    base,
    url: `${base}/__litro/mcp/demo`,
    logs,
    close: () => new Promise<void>((done) => void server.close(() => done())),
  };
}

/** One `initialize` POST by hand. It is the only method a client may send
 *  first, so a gate's answer cannot be confused with a complaint about
 *  ordering. */
async function initialize(
  url: string,
  headers: Record<string, string> = {},
  method = 'POST',
): Promise<{ status: number; headers: Headers; text: string }> {
  const res = await fetch(url, {
    method,
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      ...headers,
    },
    body:
      method === 'POST'
        ? JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'initialize',
            params: {
              protocolVersion: '2025-11-25',
              capabilities: {},
              clientInfo: { name: 'vitest', version: '0' },
            },
          })
        : undefined,
  });
  return { status: res.status, headers: res.headers, text: await res.text() };
}

let appsDir: string;
let root: string;

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'litro-mcp-http-'));
  appsDir = join(root, 'dist', 'mcp-apps');
  await writeApps(appsDir);
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('the Origin gate', () => {
  let running: Running;
  beforeAll(async () => {
    running = await serve({ appsDir, local: true });
  });
  afterAll(() => running.close());

  it('allows a request with NO Origin header — a host that is not a browser sends none', async () => {
    const res = await initialize(running.url);
    expect(res.status).toBe(200);
  });

  it('answers 403 to an Origin that is present and not allowlisted', async () => {
    const res = await initialize(running.url, { origin: 'https://evil.example' });
    expect(res.status).toBe(403);
    expect(JSON.parse(res.text).message).toContain('https://evil.example');
  });

  it('allows a localhost Origin on a local route, and echoes exactly that one', async () => {
    const res = await initialize(running.url, { origin: 'http://localhost:6274' });
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:6274');
  });

  it('NEVER sends a wildcard CORS header, on any answer', async () => {
    const cases: Record<string, string>[] = [
      {},
      { origin: 'http://localhost:6274' },
      { origin: 'https://evil.example' },
    ];
    for (const headers of cases) {
      const res = await initialize(running.url, headers);
      expect(res.headers.get('access-control-allow-origin')).not.toBe('*');
    }
  });

  it('varies on Origin even when it echoes nothing, so a cache cannot cross origins', async () => {
    const res = await initialize(running.url);
    expect(res.headers.get('vary')).toBe('origin');
  });

  it('answers the CORS preflight without a token, because a preflight carries none', async () => {
    const res = await initialize(running.url, { origin: 'http://localhost:6274' }, 'OPTIONS');
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-headers')).toContain('authorization');
    expect(res.headers.get('access-control-allow-methods')).toBe('POST, OPTIONS');
  });
});

describe('the token gate', () => {
  let running: Running;
  beforeAll(async () => {
    running = await serve({ appsDir, local: false, token: TOKEN });
  });
  afterAll(() => running.close());

  it('answers 401 when no Authorization header is sent', async () => {
    const res = await initialize(running.url);
    expect(res.status).toBe(401);
    expect(JSON.parse(res.text).message).toContain('Bearer');
  });

  it('answers 401 to a wrong token, and says nothing about what was sent', async () => {
    const res = await initialize(running.url, { authorization: 'Bearer wrong-token' });
    expect(res.status).toBe(401);
    expect(res.text).not.toContain('wrong-token');
  });

  it('answers 401 to a scheme that is not Bearer', async () => {
    const res = await initialize(running.url, { authorization: `Basic ${TOKEN}` });
    expect(res.status).toBe(401);
  });

  it('allows the right token, and matches the scheme case-insensitively', async () => {
    expect((await initialize(running.url, { authorization: `Bearer ${TOKEN}` })).status).toBe(200);
    expect((await initialize(running.url, { authorization: `bearer ${TOKEN}` })).status).toBe(200);
  });

  it('runs the Origin gate BEFORE the token gate', async () => {
    // A bad origin with a good token is still 403: the request never had any
    // business reaching the route, and 401 would invite a retry.
    const res = await initialize(running.url, {
      origin: 'https://evil.example',
      authorization: `Bearer ${TOKEN}`,
    });
    expect(res.status).toBe(403);
  });

  it('allowlists no origin by default on a route that is not local', async () => {
    const res = await initialize(running.url, {
      origin: 'http://localhost:6274',
      authorization: `Bearer ${TOKEN}`,
    });
    expect(res.status).toBe(403);
  });
});

describe('the per-agent access guard', () => {
  it('runs AFTER the gates, and its refusal reads as an auth failure', async () => {
    const calls: string[] = [];
    const running = await serve({ appsDir, local: false, token: TOKEN }, [
      entry({
        access: () => {
          calls.push('access');
          throw Object.assign(new Error('this agent is not for you'), { statusCode: 403 });
        },
      }),
    ]);
    try {
      // The token gate refuses first, so the guard is never reached.
      expect((await initialize(running.url)).status).toBe(401);
      expect(calls).toEqual([]);

      const res = await initialize(running.url, { authorization: `Bearer ${TOKEN}` });
      expect(calls).toEqual(['access']);
      // h3 formats a thrown error with a `statusCode`; what matters here is
      // that it is a refusal and not a 500 crash.
      expect(res.status).toBe(403);
    } finally {
      await running.close();
    }
  });
});

describe('the route parameter', () => {
  it('answers 404 for an agent the project does not have, and names the ones it does', async () => {
    const running = await serve({ appsDir, local: true });
    try {
      const res = await fetch(`${running.base}/__litro/mcp/nope`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
        body: '{}',
      });
      expect(res.status).toBe(404);
      expect((await res.json()).message).toContain('demo');
    } finally {
      await running.close();
    }
  });
});

describe('the protocol, driven by the SDK\'s own client over HTTP', () => {
  let running: Running;
  let client: Client;
  /** Every model-facing payload the client received, for the AGENT-002 grep. */
  let seen: string[];

  beforeAll(async () => {
    running = await serve({ appsDir, local: false, token: TOKEN });
    client = new Client({ name: 'vitest', version: '0' });
    await client.connect(
      new StreamableHTTPClientTransport(new URL(running.url), {
        requestInit: { headers: { authorization: `Bearer ${TOKEN}` } },
      }),
    );
    seen = [];
  });

  afterAll(async () => {
    await client.close();
    await running.close();
  });

  it('answers tools/list with a real inputSchema and the ui:// link', async () => {
    const result = await client.listTools();
    seen.push(JSON.stringify(result));
    const weather = result.tools.find((t) => t.name === 'get-weather');
    expect(weather?.inputSchema).toMatchObject({
      type: 'object',
      properties: { city: { type: 'string' } },
      required: ['city'],
    });
    expect(weather?._meta).toEqual({ ui: { resourceUri: 'ui://fixture/weather-card' } });
    // A vendor with no converter still publishes the permissive fallback.
    expect(result.tools.find((t) => t.name === 'no-converter')?.inputSchema).toEqual({
      type: 'object',
    });
  });

  it('answers resources/list from the manifest on disk', async () => {
    const result = await client.listResources();
    seen.push(JSON.stringify(result));
    expect(result.resources).toEqual([
      {
        uri: 'ui://fixture/weather-card',
        name: 'weather-card',
        mimeType: 'text/html;profile=mcp-app',
        _meta: { ui: { prefersBorder: true } },
      },
    ]);
  });

  it('answers tools/call with text and structuredContent', async () => {
    const result = await client.callTool({ name: 'get-weather', arguments: { city: 'Lisbon' } });
    seen.push(JSON.stringify(result));
    expect(result.structuredContent).toEqual({ city: 'Lisbon', tempC: 21, summary: 'sunny' });
    expect(result.isError).not.toBe(true);
  });

  it('answers resources/read with the packed bytes, untouched', async () => {
    const result = await client.readResource({ uri: 'ui://fixture/weather-card' });
    // `contents[0]` is a text-or-blob union on the SDK's type; this server only
    // ever answers text, and asserting that is part of the point.
    const first = result.contents[0] as { text?: string; mimeType?: string };
    expect(first.text).toBe(fixtureApps()[0].html);
    expect(first.mimeType).toBe('text/html;profile=mcp-app');
  });

  it('refuses a resource uri the manifest does not list', async () => {
    await expect(client.readResource({ uri: 'ui://fixture/not-listed' })).rejects.toThrow(
      /Unknown resource/,
    );
    // AGENT-008: a uri from a request never becomes a path.
    await expect(client.readResource({ uri: 'file:///etc/passwd' })).rejects.toThrow(
      /Unknown resource/,
    );
  });

  it('answers an unknown tool with a protocol error naming it', async () => {
    await expect(client.callTool({ name: 'no-such-tool', arguments: {} })).rejects.toThrow(
      /no-such-tool/,
    );
  });

  it('answers a thrown tool with isError and no stack', async () => {
    const result = await client.callTool({ name: 'throws', arguments: {} });
    seen.push(JSON.stringify(result));
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result)).not.toContain('at ');
  });

  /**
   * AGENT-002, over HTTP — the twin of the stdio test that plants a marker in
   * the fixture.
   *
   * `FIXTURE_UI_HTML` carries `SECRET-MARKUP`. A `UIResult`'s `html` must not
   * reach the model on any transport, so this asserts it is absent from every
   * model-facing message the client received, and then asserts it IS present in
   * the tool's own return value — otherwise a fixture that stopped returning a
   * `UIResult` would make the check pass by accident.
   */
  it('never puts a UIResult\'s html on the model-facing wire', async () => {
    const result = await client.callTool({ name: 'renders-ui', arguments: {} });
    seen.push(JSON.stringify(result));
    expect(result.structuredContent).toEqual({ city: 'Lisbon', tempC: 21 });

    const wire = seen.join('\n');
    expect(FIXTURE_UI_HTML).toContain('SECRET-MARKUP');
    expect(wire).not.toContain('SECRET-MARKUP');
    expect(wire).not.toContain('shadowrootmode');
    expect(wire).not.toContain('<demo-card');
    // And the grep is not vacuous: the call DID go through the ui() path.
    expect(wire).toContain('"tempC":21');
  });
});

/** The same agent with every app-naming tool removed: a project that has tools
 *  and has never run `litro mcp-app build`. */
function entryWithoutApps(): AgentManifestEntry {
  const full = entry();
  return { ...full, tools: full.tools.filter((t) => !['get-weather', 'hidden-from-model', 'renders-ui'].includes(t.name)) };
}

describe('a project with no packed apps', () => {
  it('serves its tools and says so once, when no tool names an app', async () => {
    const running = await serve({ appsDir: join(root, 'nowhere'), local: true }, [entryWithoutApps()]);
    try {
      expect((await initialize(running.url)).status).toBe(200);
      expect(running.logs.join('\n')).toContain('serves tools only');
    } finally {
      await running.close();
    }
  });

  it('answers with the actionable message when a tool DOES name an app', async () => {
    // The resolution fails at boot, and the message has to survive to the
    // client: h3 answers a plain Error with a bare 500 and no text, which would
    // leave a reader with a status code and nothing to do about it.
    const running = await serve({ appsDir: join(root, 'nowhere'), local: true }, [entry()]);
    try {
      const res = await initialize(running.url);
      expect(res.status).toBe(500);
      expect(res.text).toContain('litro mcp-app build');
      expect(res.text).toContain('LITRO_MCP_APPS_DIR');
      // And it says so on the way up, not only in the response.
      expect(running.logs.join('\n')).toContain('cannot serve');
    } finally {
      await running.close();
    }
  });
});

describe('a client that goes away mid-call', () => {
  it('closes the transport when the response stream is canceled', async () => {
    // The disconnect path, pinned directly. A `ReadableStream`'s `cancel` is the
    // only signal this route gets that a client stopped reading, and a transport
    // that is not closed there leaks one SDK `Server` per abandoned request.
    let closes = 0;
    const source = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('event: message\n'));
      },
    });
    const wrapped = closeWhenDone(source, { close: async () => void (closes += 1) }, () => {});

    const reader = wrapped.getReader();
    await reader.read();
    expect(closes).toBe(0);
    await reader.cancel('client went away');
    expect(closes).toBe(1);
  });

  it('closes the transport exactly once when the stream ends normally', async () => {
    let closes = 0;
    const source = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('one'));
        controller.close();
      },
    });
    const wrapped = closeWhenDone(source, { close: async () => void (closes += 1) }, () => {});
    const reader = wrapped.getReader();
    await reader.read();
    await reader.read();
    await reader.cancel('already finished');
    expect(closes).toBe(1);
  });

  it('keeps answering after a request is aborted halfway through a hanging tool', async () => {
    const running = await serve({ appsDir, local: true });
    try {
      const abort = new AbortController();
      const inflight = fetch(running.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
        signal: abort.signal,
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name: 'hangs', arguments: {} },
        }),
      }).catch((err) => err as Error);
      await new Promise((r) => setTimeout(r, 150));
      abort.abort();
      await inflight;

      // The tool is still running — a promise cannot be canceled — but the route
      // is not wedged behind it.
      expect((await initialize(running.url)).status).toBe(200);
    } finally {
      await running.close();
    }
  }, 20_000);
});
