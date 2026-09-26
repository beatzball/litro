/**
 * http-probe — drives the MCP Streamable HTTP route on a REAL production
 * server, over real HTTP, and prints what came back.
 *
 * Phase 2's counterpart to `stdio-probe.mjs`. The rule it exists for is the
 * same one: a unit test asserting that a function returns 403 proves the
 * function, not the route. A gate only counts once a request that reached the
 * server over a socket was refused by it.
 *
 * WHY A PRODUCTION BUILD AND NOT `litro dev`
 *
 * BUILD-007. `litro dev` never runs the bundler, so it cannot show whether the
 * generated handler stub compiled, whether the route survived rollup, or
 * whether the SDK resolves from a built server. Every scenario here boots
 * `dist/server/server/index.mjs`.
 *
 *   node mcp-server/http-probe.mjs          # everything
 *   node mcp-server/http-probe.mjs --gates  # the gates only
 *   node mcp-server/http-probe.mjs --wire   # the protocol only
 *
 * Run `pnpm --filter playground mcp-app` and `pnpm --filter playground build`
 * first. The probe says so if you have not.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT = resolve(HERE, '..');
const ENTRY = resolve(PROJECT, 'dist/server/server/index.mjs');
const AGENT = 'demo';
const TOKEN = 'probe-token-0123456789';

const only = process.argv.includes('--gates')
  ? 'gates'
  : process.argv.includes('--wire')
    ? 'wire'
    : 'all';

let failures = 0;

function line(text = '') {
  process.stdout.write(`${text}\n`);
}

function check(label, ok, detail) {
  if (!ok) failures += 1;
  line(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
}

function section(title) {
  line();
  line(`── ${title} ${'─'.repeat(Math.max(0, 62 - title.length))}`);
}

/** A port the OS just told us is free. Fixed ports collide with whatever else
 *  a developer has running, and a collision here reads as a broken gate. */
function freePort() {
  return new Promise((done, fail) => {
    const probe = createServer();
    probe.on('error', fail);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => done(port));
    });
  });
}

/**
 * Boots the built server and waits until it answers.
 *
 * Returns `{ base, stop, stderr, exitCode }`. A server that exits before it
 * listens is not an error here — one scenario is exactly that — so the caller
 * decides what a dead process means.
 */
async function boot(env, { expectExit = false } = {}) {
  const port = await freePort();
  const child = spawn(process.execPath, [ENTRY], {
    cwd: PROJECT,
    env: { ...process.env, PORT: String(port), NITRO_PORT: String(port), ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stderr = '';
  let stdout = '';
  child.stderr.on('data', (c) => void (stderr += c));
  child.stdout.on('data', (c) => void (stdout += c));

  let exitCode;
  const exited = new Promise((done) => child.on('exit', (code) => void done((exitCode = code ?? -1))));

  const base = `http://127.0.0.1:${port}`;
  if (expectExit) {
    await exited;
    return { base, stderr, stdout, exitCode, stop: async () => {} };
  }

  // Poll rather than parse a log line: the log line is Nitro's wording and not
  // a contract, and a socket that answers is the thing being waited for.
  const deadline = Date.now() + 20_000;
  for (;;) {
    if (exitCode !== undefined) {
      throw new Error(`the server exited with ${exitCode} before it listened\n${stderr}${stdout}`);
    }
    try {
      await fetch(`${base}/api/hello`, { signal: AbortSignal.timeout(1000) });
      break;
    } catch {
      if (Date.now() > deadline) throw new Error(`the server never answered\n${stderr}${stdout}`);
      await new Promise((r) => setTimeout(r, 150));
    }
  }

  return {
    base,
    get stderr() {
      return stderr;
    },
    get stdout() {
      return stdout;
    },
    exitCode,
    stop: async () => {
      child.kill('SIGTERM');
      await exited;
    },
  };
}

/** One JSON-RPC POST, by hand. `initialize` because it is the only method a
 *  client may send first, so a gate's answer is never confused with a protocol
 *  complaint about ordering. */
function initializeBody() {
  return JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-11-25',
      capabilities: {},
      clientInfo: { name: 'litro-http-probe', version: '0.0.0' },
    },
  });
}

async function post(base, { origin, token, method = 'POST' } = {}) {
  const headers = {
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
  };
  if (origin) headers.origin = origin;
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${base}/__litro/mcp/${AGENT}`, {
    method,
    headers,
    body: method === 'POST' ? initializeBody() : undefined,
  });
  const text = await res.text();
  return { status: res.status, headers: res.headers, text };
}

function show(label, res) {
  const acao = res.headers.get('access-control-allow-origin');
  line(`  ${label}`);
  line(`    -> ${res.status}  access-control-allow-origin: ${acao ?? '(none)'}`);
  const body = res.text.replace(/\s+/g, ' ').trim();
  if (body) line(`    -> ${body.slice(0, 220)}${body.length > 220 ? '…' : ''}`);
}

// --- the gates -------------------------------------------------------------

async function probeGates() {
  section('a local route: no token configured');
  const local = await boot({ LITRO_MCP_LOCAL: '1' });
  try {
    const noOrigin = await post(local.base);
    show('POST with NO Origin header (what a CLI or desktop host sends)', noOrigin);
    check('no Origin is allowed', noOrigin.status === 200, `status ${noOrigin.status}`);
    check(
      'no wildcard CORS header',
      noOrigin.headers.get('access-control-allow-origin') !== '*',
      String(noOrigin.headers.get('access-control-allow-origin')),
    );

    const badOrigin = await post(local.base, { origin: 'https://evil.example' });
    show('POST with Origin: https://evil.example', badOrigin);
    check('a bad Origin is refused with 403', badOrigin.status === 403, `status ${badOrigin.status}`);
    check(
      'a refused request carries no wildcard CORS header',
      badOrigin.headers.get('access-control-allow-origin') !== '*',
      String(badOrigin.headers.get('access-control-allow-origin')),
    );

    const localOrigin = await post(local.base, { origin: 'http://localhost:6274' });
    show('POST with Origin: http://localhost:6274 (a browser-based inspector)', localOrigin);
    check('a localhost Origin is allowed on a local route', localOrigin.status === 200);
    check(
      'the allowed origin is echoed back exactly, not as *',
      localOrigin.headers.get('access-control-allow-origin') === 'http://localhost:6274',
      String(localOrigin.headers.get('access-control-allow-origin')),
    );

    const preflight = await post(local.base, { origin: 'http://localhost:6274', method: 'OPTIONS' });
    show('OPTIONS preflight from that origin', preflight);
    check('the preflight answers 204 with no token', preflight.status === 204);
    check(
      'the preflight allows the Authorization header',
      (preflight.headers.get('access-control-allow-headers') ?? '').includes('authorization'),
      String(preflight.headers.get('access-control-allow-headers')),
    );
  } finally {
    await local.stop();
  }

  section('a route with a shared secret');
  const guarded = await boot({ LITRO_MCP_LOCAL: '0', LITRO_MCP_TOKEN: TOKEN });
  try {
    const noToken = await post(guarded.base);
    show('POST with no Authorization header', noToken);
    check('no token is refused with 401', noToken.status === 401, `status ${noToken.status}`);

    const wrongToken = await post(guarded.base, { token: 'not-the-token' });
    show('POST with a wrong bearer token', wrongToken);
    check('a wrong token is refused with 401', wrongToken.status === 401, `status ${wrongToken.status}`);
    check(
      'the refusal says nothing about the token that was sent',
      !wrongToken.text.includes('not-the-token'),
    );

    const rightToken = await post(guarded.base, { token: TOKEN });
    show('POST with the right bearer token', rightToken);
    check('the right token is allowed', rightToken.status === 200, `status ${rightToken.status}`);

    const browserOrigin = await post(guarded.base, {
      token: TOKEN,
      origin: 'http://localhost:6274',
    });
    show('POST with the right token and a localhost Origin, no allowlist', browserOrigin);
    check(
      'a non-local route allowlists no origin by default',
      browserOrigin.status === 403,
      `status ${browserOrigin.status}`,
    );
  } finally {
    await guarded.stop();
  }

  section('a route with an explicit origin allowlist');
  const listed = await boot({
    LITRO_MCP_LOCAL: '0',
    LITRO_MCP_TOKEN: TOKEN,
    LITRO_MCP_ORIGINS: 'https://inspector.example, http://localhost:6274',
  });
  try {
    const allowed = await post(listed.base, { token: TOKEN, origin: 'https://inspector.example' });
    show('POST from an allowlisted origin', allowed);
    check('an allowlisted origin is allowed', allowed.status === 200);
    check(
      'and echoed, one origin only',
      allowed.headers.get('access-control-allow-origin') === 'https://inspector.example',
      String(allowed.headers.get('access-control-allow-origin')),
    );

    const notListed = await post(listed.base, { token: TOKEN, origin: 'https://other.example' });
    show('POST from an origin that is not on the list', notListed);
    check('an unlisted origin is refused with 403', notListed.status === 403);
  } finally {
    await listed.stop();
  }

  section('no token on a route that is not local: the server must not start');
  const dead = await boot({ LITRO_MCP_LOCAL: '0' }, { expectExit: true });
  line('  the process exited. Its stderr:');
  for (const l of dead.stderr.split('\n').slice(0, 8)) if (l.trim()) line(`    | ${l}`);
  check('the server refused to start', dead.exitCode !== 0, `exit ${dead.exitCode}`);
  check('the message names LITRO_MCP_TOKEN', dead.stderr.includes('LITRO_MCP_TOKEN'));
  check('and names the way out for a genuinely local route', dead.stderr.includes('LITRO_MCP_LOCAL=1'));
}

// --- the protocol ----------------------------------------------------------

async function probeWire() {
  section('the protocol itself, driven by the SDK\'s own client over HTTP');
  const server = await boot({ LITRO_MCP_LOCAL: '0', LITRO_MCP_TOKEN: TOKEN });

  /** Every byte the client received, for the AGENT-002 grep at the end. */
  const seen = [];

  try {
    const url = new URL(`${server.base}/__litro/mcp/${AGENT}`);
    const transport = new StreamableHTTPClientTransport(url, {
      requestInit: { headers: { authorization: `Bearer ${TOKEN}` } },
    });
    const client = new Client({ name: 'litro-http-probe', version: '0.0.0' });
    await client.connect(transport);
    line(`  connected. server: ${JSON.stringify(client.getServerVersion())}`);

    const tools = await client.listTools();
    seen.push(JSON.stringify(tools));
    line('  tools/list:');
    for (const t of tools.tools) {
      line(`    - ${t.name}: ${t.description}`);
      line(`      inputSchema: ${JSON.stringify(t.inputSchema)}`);
      if (t._meta) line(`      _meta: ${JSON.stringify(t._meta)}`);
    }
    check('tools/list answered over HTTP', tools.tools.length > 0);
    const weather = tools.tools.find((t) => t.name === 'get-weather');
    check('get-weather is published', Boolean(weather));
    check(
      'its inputSchema is real, not the { type: object } fallback',
      Boolean(weather?.inputSchema?.properties?.city),
      JSON.stringify(weather?.inputSchema?.properties ?? null),
    );
    check(
      'it points at its ui:// document',
      weather?._meta?.ui?.resourceUri === 'ui://playground/weather-card',
      JSON.stringify(weather?._meta ?? null),
    );

    const resources = await client.listResources();
    seen.push(JSON.stringify(resources));
    line('  resources/list:');
    for (const r of resources.resources) line(`    - ${r.uri} (${r.mimeType})`);
    check('resources/list answered', resources.resources.length === 4, `${resources.resources.length} of 4`);

    const called = await client.callTool({ name: 'get-weather', arguments: { city: 'Lisbon' } });
    seen.push(JSON.stringify(called));
    line('  tools/call get-weather { city: "Lisbon" }:');
    line(`    content:           ${JSON.stringify(called.content)}`);
    line(`    structuredContent: ${JSON.stringify(called.structuredContent)}`);
    check('the call returned data', called.structuredContent?.city === 'Lisbon');
    check('and it is not an error', called.isError !== true);

    const read = await client.readResource({ uri: 'ui://playground/weather-card' });
    const doc = read.contents[0];
    line('  resources/read ui://playground/weather-card:');
    line(`    mimeType: ${doc.mimeType}  bytes: ${doc.text.length}`);
    line(`    _meta:    ${JSON.stringify(doc._meta)}`);
    line(`    head:     ${doc.text.slice(0, 90).replace(/\s+/g, ' ')}…`);
    check('the document came back', doc.text.length > 1000);
    // The mime type the PACKAGER wrote, not one this probe decided on. AGENT-013:
    // the descriptor is the packager's output and the server passes it through.
    check(
      'with the packager\'s own mime type, passed through',
      doc.mimeType === 'text/html;profile=mcp-app',
      String(doc.mimeType),
    );

    // AGENT-002, over HTTP. The document IS html and is read deliberately, so
    // the grep is over everything EXCEPT resources/read: a tool result, a tool
    // list and a resource list must never carry the rendered markup.
    section('AGENT-002: the rendered html never reaches the model over HTTP');
    const wire = seen.join('\n');
    const marker = 'demo-weather-card';
    check(
      `no "${marker}" markup in tools/list, resources/list or the tools/call result`,
      !wire.includes(marker),
      wire.includes(marker) ? 'FOUND — a UIResult\'s html is on the wire' : undefined,
    );
    check('no "<template shadowrootmode" on the model-facing wire', !wire.includes('shadowrootmode'));
    check(
      'and the document itself DOES carry it, so the grep is not vacuous',
      read.contents[0].text.includes(marker),
    );

    const unknown = await client.callTool({ name: 'no-such-tool', arguments: {} }).then(
      () => ({ threw: false }),
      (err) => ({ threw: true, message: String(err.message ?? err) }),
    );
    line(`  tools/call on an unknown tool: ${unknown.threw ? unknown.message : 'did not throw'}`);
    check('an unknown tool is a protocol error naming it', unknown.threw && unknown.message.includes('no-such-tool'));

    await client.close();
  } finally {
    const log = server.stderr;
    await server.stop();
    section('the route\'s own startup log');
    for (const l of log.split('\n')) if (l.includes('[litro mcp]')) line(`  | ${l.trim()}`);
  }
}

// --- run -------------------------------------------------------------------

if (!existsSync(ENTRY)) {
  line(`http-probe: no ${ENTRY}.`);
  line('  Run `pnpm --filter playground build` first (and `pnpm --filter playground mcp-app` for the apps).');
  process.exit(2);
}

line(`http-probe: ${ENTRY}`);
if (only !== 'wire') await probeGates();
if (only !== 'gates') await probeWire();

line();
line(failures === 0 ? `http-probe: all checks passed.` : `http-probe: ${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
