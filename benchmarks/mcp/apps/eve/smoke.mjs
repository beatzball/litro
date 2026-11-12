import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';

const appDir = fileURLToPath(new URL('.', import.meta.url));
const entry = fileURLToPath(new URL('./dist/server.mjs', import.meta.url));
const reservation = createServer();
reservation.listen(0, '127.0.0.1');
await once(reservation, 'listening');
const { port } = reservation.address();
await new Promise((resolve) => reservation.close(resolve));
const child = spawn(process.execPath, [entry, 'http'], {
  cwd: appDir,
  // No provider credentials are needed for a published static tool.
  env: { PATH: process.env.PATH, PORT: String(port) },
  stdio: ['ignore', 'pipe', 'pipe'],
});
child.stdout.resume();
child.stderr.resume();
let processError;
child.on('error', (error) => { processError = error; });
const timer = setTimeout(() => child.kill('SIGKILL'), 30_000);
const url = new URL(`http://127.0.0.1:${port}/mcp`);
const client = new Client({ name: 'weather-smoke', version: '1.0.0' }, {
  capabilities: {},
  versionNegotiation: { mode: { pin: '2026-07-28' } },
});
try {
  let ready = false;
  for (let attempt = 0; attempt < 200; attempt++) {
    if (processError) throw processError;
    assert.equal(child.exitCode, null, 'HTTP server must stay running');
    try {
      await fetch(url);
      ready = true;
      break;
    } catch {
      await delay(50);
    }
  }
  assert.equal(ready, true, 'HTTP server must become ready');
  await client.connect(new StreamableHTTPClientTransport(url));
  const { tools } = await client.listTools();
  assert.equal(tools.length, 1);
  assert.equal(tools[0].name, 'get-weather');
  assert.equal(tools[0].inputSchema.properties.city.minLength, 1);
  assert.equal(tools[0].inputSchema.properties.city.maxLength, 80);
  assert.equal(tools[0]._meta?.ui, undefined);
  for (const city of [' Lisbon ', 'x', 'x'.repeat(80)]) {
    const result = await client.callTool({ name: 'get-weather', arguments: { city } });
    assert.notEqual(result.isError, true, JSON.stringify({ cityLength: city.length, result }));
    assert.deepEqual(result.structuredContent, { city: city.trim(), tempC: 21, summary: 'sunny' });
    assert.deepEqual(JSON.parse(result.content[0].text), result.structuredContent);
  }
  for (const args of [{ city: '' }, { city: '  ' }, { city: 'x'.repeat(81) }, { city: 1 }, {}]) {
    const result = await client.callTool({ name: 'get-weather', arguments: args });
    assert.equal(result.isError, true);
  }
  // Eve's published MCP schema checks raw length before Zod can trim.
  const paddedBoundary = await client.callTool({ name: 'get-weather', arguments: { city: '  ' + 'x'.repeat(80) + '  ' } });
  assert.equal(paddedBoundary.isError, true);
  assert.match(paddedBoundary.content[0].text, /more than 80 characters/);
  const crossOrigin = await fetch(url, {
    method: 'POST',
    headers: { origin: 'https://other.example', 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
  });
  assert.equal(crossOrigin.status, 403);
  console.log(JSON.stringify({ framework: 'eve', transport: 'http', protocol: '2026-07-28', status: 'pass', tools: 1, modelCredentials: false, uiResource: null, padded80: 'rejected before trim' }));
} finally {
  await client.close();
  if (child.exitCode === null && child.signalCode === null) {
    const exited = once(child, 'exit');
    child.kill('SIGTERM');
    await exited;
  }
  clearTimeout(timer);
}
