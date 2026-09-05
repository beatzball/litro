/**
 * A minimal stdio MCP server that serves the documents `litro mcp-app build`
 * packs, so a REAL MCP host can render them.
 *
 * Everything else that exercises the packager is something we wrote — a fake
 * host in jsdom, a fake host in Playwright. All of it agrees with our reading
 * of the spec because all of it came from that reading. This server exists so
 * a host we did not write gets a turn.
 *
 * It deliberately does NOT re-implement the packer. It reads
 * `dist/mcp-apps/manifest.json` and hands the bytes over untouched, so what a
 * host renders is what `litro mcp-app build` actually produced.
 *
 * Run (stdio, for Claude Desktop):  node playground/mcp-server/index.ts
 * Run (http, for MCP Inspector):     node playground/mcp-server/index.ts --http
 * Pack first:  pnpm --filter playground mcp-app
 *
 * Two transports because MCP Inspector V2 auto-connects only to a URL, and
 * Claude Desktop launches only a stdio command. Same handlers behind both, so
 * neither host is being shown a different server from the other.
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(process.env.LITRO_MCP_APPS_DIR ?? join(HERE, '..', 'dist', 'mcp-apps'));

/** One entry of the packer's `manifest.json`. */
interface ManifestEntry {
  name: string;
  uri: string;
  html: string;
  descriptor: string;
}

/** The descriptor the packer writes beside each document. */
interface Descriptor {
  uri: string;
  /** The packer names the resource now; the manifest stem is only a filename. */
  name?: string;
  mimeType: string;
  _meta: { ui: Record<string, unknown> };
}

interface LoadedApp {
  name: string;
  descriptor: Descriptor;
  html: string;
}

async function loadApps(): Promise<LoadedApp[]> {
  let manifest: ManifestEntry[];
  try {
    manifest = JSON.parse(await readFile(join(OUT_DIR, 'manifest.json'), 'utf8')) as ManifestEntry[];
  } catch {
    // stderr, not stdout: stdout is the JSON-RPC channel and a stray byte on it
    // desyncs the framing for the rest of the session.
    process.stderr.write(
      `litro mcp-server: no manifest at ${join(OUT_DIR, 'manifest.json')}\n` +
        '  Run: pnpm --filter playground mcp-app\n',
    );
    process.exit(1);
  }

  return Promise.all(
    manifest.map(async (entry) => ({
      name: entry.name,
      // Passed through byte for byte. Reshaping _meta here would mean the host
      // is checking this file's reading of the spec rather than the packer's.
      descriptor: JSON.parse(await readFile(join(OUT_DIR, entry.descriptor), 'utf8')) as Descriptor,
      html: await readFile(join(OUT_DIR, entry.html), 'utf8'),
    })),
  );
}

const apps = await loadApps();
const byUri = new Map(apps.map((a) => [a.descriptor.uri, a]));

/** Counts calls so a refresh visibly changes the view even for a canned city. */
let calls = 0;

/** Canned, on purpose: this server tests rendering, not a weather API. */
function forecast(city: string) {
  const cities: Record<string, { tempC: number; summary: string }> = {
    london: { tempC: 12, summary: 'Overcast with light drizzle' },
    tokyo: { tempC: 21, summary: 'Clear and mild' },
    reykjavik: { tempC: 3, summary: 'Windy, snow showers' },
  };
  calls += 1;
  const hit = cities[city.trim().toLowerCase()] ?? { tempC: 15, summary: 'Partly cloudy' };
  // The call number rides along in the summary. Without it a refresh of a
  // canned city renders identically whether the round-trip happened or not,
  // and the screenshot proves nothing.
  return { tempC: hit.tempC, summary: `${hit.summary} (reading #${calls})` };
}

/**
 * A fresh Server per connection. The HTTP transport is stateless — one
 * transport per request — so a single shared Server would be re-connected
 * under each new one and lose the previous session's state.
 */
function buildServer(): Server {
const server = new Server(
  { name: 'litro-playground', version: '0.0.1' },
  { capabilities: { resources: {}, tools: {} } },
);

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: apps.map((app) => ({
    uri: app.descriptor.uri,
    name: app.descriptor.name ?? app.name,
    description: `Litro MCP App: ${app.descriptor.name ?? app.name}`,
    mimeType: app.descriptor.mimeType,
    // The spec puts `_meta.ui` on the resource DECLARATION as well as on the
    // read contents, so a host that decides CSP at prefetch time has it.
    _meta: app.descriptor._meta,
  })),
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const app = byUri.get(request.params.uri);
  if (!app) throw new Error(`Unknown resource: ${request.params.uri}`);
  return {
    contents: [
      {
        uri: app.descriptor.uri,
        mimeType: app.descriptor.mimeType,
        text: app.html,
        _meta: app.descriptor._meta,
      },
    ],
  };
});

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'get-weather',
      description: 'Current weather for a city.',
      inputSchema: {
        type: 'object',
        properties: { city: { type: 'string', description: 'City name' } },
        required: ['city'],
      },
      _meta: {
        ui: {
          resourceUri: 'ui://playground/weather-card',
          // ["model", "app"], not the ["app"]-only form.
          //
          // "app" is REQUIRED here and is not a default we can lean on: the
          // weather-refresh document's button calls this same tool back
          // through tools/call, and the spec says the host MUST reject a call
          // from an app for a tool whose visibility omits "app". Dropping it
          // would kill the refresh round-trip, which is one of the things this
          // server exists to test.
          //
          // "model" is kept because this tool is genuinely useful to the agent
          // — it answers a question a user would ask in words. Hiding it would
          // buy nothing and would make the demo untestable from a chat prompt,
          // which is how a real host is driven.
          visibility: ['model', 'app'],
        },
      },
    },
    {
      name: 'weather-refresh-demo',
      description: 'Shows the refreshable weather card, whose button calls get-weather back.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      _meta: {
        ui: {
          resourceUri: 'ui://playground/weather-refresh',
          visibility: ['model', 'app'],
        },
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  // Deliberately slow, when asked. The claim this whole design rests on is that
  // the server-rendered shell is on screen BEFORE the result arrives; with an
  // instant tool the two are indistinguishable in a screenshot.
  const delay = Number(process.env.LITRO_MCP_TOOL_DELAY_MS ?? 0);
  if (delay > 0) await new Promise((r) => setTimeout(r, delay));

  const name = request.params.name;
  const args = (request.params.arguments ?? {}) as { city?: string };
  const city = (args.city ?? '').trim() || 'London';
  const { tempC, summary } = forecast(city);

  if (name === 'get-weather' || name === 'weather-refresh-demo') {
    return {
      // `content` is what the model reads. `structuredContent` is what the
      // view fills from. The spec keeps them separate and so does this.
      content: [{ type: 'text', text: `${city}: ${tempC}°C, ${summary}.` }],
      structuredContent: { city, tempC, summary },
    };
  }

  throw new Error(`Unknown tool: ${name}`);
});

  return server;
}

if (process.argv.includes('--http')) {
  const { StreamableHTTPServerTransport } = await import(
    '@modelcontextprotocol/sdk/server/streamableHttp.js'
  );
  const { createServer: createHttpServer } = await import('node:http');

  // Stateless: a new transport and a new Server per request. A single shared
  // transport would hold one session, and the Inspector opens more than one.
  const port = Number(process.env.PORT ?? 3111);
  createHttpServer(async (req, res) => {
    // The Inspector runs on its own origin, so without CORS the browser never
    // even sends the POST and the failure looks like a dead server.
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Expose-Headers', 'mcp-session-id');
    if (req.method === 'OPTIONS') return void res.writeHead(204).end();

    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => void transport.close());
    await buildServer().connect(transport);

    let body: unknown;
    if (req.method === 'POST') {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk as Buffer);
      const raw = Buffer.concat(chunks).toString('utf8');
      body = raw ? JSON.parse(raw) : undefined;
    }
    await transport.handleRequest(req, res, body);
  }).listen(port, () => {
    process.stderr.write(
      `litro mcp-server: http on http://localhost:${port}/mcp — ${apps.length} app(s) from ${OUT_DIR}\n`,
    );
  });
} else {
  await buildServer().connect(new StdioServerTransport());
  process.stderr.write(`litro mcp-server: stdio — ${apps.length} app(s) from ${OUT_DIR}\n`);
}
