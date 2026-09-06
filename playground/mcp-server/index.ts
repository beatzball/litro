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

/** Counts calls, so a refresh is visibly a NEW reading even when nothing moved. */
let calls = 0;

/** WMO weather codes, which is what Open-Meteo reports instead of prose. */
const WMO: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  56: 'Light freezing drizzle',
  57: 'Dense freezing drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  66: 'Light freezing rain',
  67: 'Heavy freezing rain',
  71: 'Slight snow',
  73: 'Moderate snow',
  75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Slight rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  85: 'Slight snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with slight hail',
  99: 'Thunderstorm with heavy hail',
};

/** Gives up rather than hanging a tool call on a slow network. */
async function getJson(url: string, ms = 4000): Promise<unknown> {
  const stop = AbortSignal.timeout(ms);
  const res = await fetch(url, { signal: stop });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

/**
 * REAL WEATHER, from Open-Meteo. No API key, no account.
 *
 * THE SERVER FETCHES, NOT THE VIEW, and that distinction is the point worth
 * noticing: the packed document still declares no CSP and still loads nothing
 * from the network. Data reaches it as `structuredContent` over postMessage.
 * Adding a live upstream changed nothing about the sandbox.
 *
 * Two calls: a name to coordinates, then coordinates to a current reading.
 * Both are cached for a few minutes, because the Refresh button is meant to
 * prove a round trip happened, not to hammer a free public API.
 */
const geoCache = new Map<string, { lat: number; lon: number; label: string } | null>();
const wxCache = new Map<string, { at: number; tempC: number; tempF: number; summary: string }>();
const WX_TTL_MS = 5 * 60 * 1000;

async function locate(city: string) {
  const key = city.trim().toLowerCase();
  if (geoCache.has(key)) return geoCache.get(key)!;

  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
  const body = (await getJson(url)) as {
    results?: { latitude: number; longitude: number; name: string; country_code?: string }[];
  };
  const hit = body.results?.[0];
  const found = hit
    ? {
        lat: hit.latitude,
        lon: hit.longitude,
        label: hit.country_code ? `${hit.name}, ${hit.country_code}` : hit.name,
      }
    : null;
  geoCache.set(key, found);
  return found;
}

/**
 * Returns a reading, and says whether it is real.
 *
 * A network failure must not take the demo down — this rig is run offline, on
 * planes, and in front of people. So a failure degrades to a clearly-labelled
 * placeholder rather than throwing, and the label is the honest part: nobody
 * should have to guess whether the number on screen came from a weather
 * service or from us.
 */
async function forecast(city: string): Promise<{
  tempC: number;
  tempF: number;
  summary: string;
  label: string;
  live: boolean;
}> {
  calls += 1;
  const key = city.trim().toLowerCase();

  const fresh = wxCache.get(key);
  if (fresh && Date.now() - fresh.at < WX_TTL_MS) {
    return { ...fresh, label: city, summary: `${fresh.summary} (reading #${calls})`, live: true };
  }

  try {
    const place = await locate(city);
    if (!place) {
      return {
        tempC: 0,
        tempF: 32,
        summary: `No place called "${city}" (reading #${calls})`,
        label: city,
        live: false,
      };
    }

    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${place.lat}&longitude=${place.lon}` +
      '&current=temperature_2m,weather_code';
    const body = (await getJson(url)) as { current?: { temperature_2m: number; weather_code: number } };
    const now = body.current;
    if (!now) throw new Error('no current reading in the response');

    const tempC = Math.round(now.temperature_2m);
    const tempF = Math.round((now.temperature_2m * 9) / 5 + 32);
    const summary = WMO[now.weather_code] ?? `Weather code ${now.weather_code}`;

    wxCache.set(key, { at: Date.now(), tempC, tempF, summary });
    // The call number rides along. Without it a refresh two minutes apart
    // renders identically whether the round trip happened or not, and the
    // screenshot proves nothing.
    return { tempC, tempF, summary: `${summary} (reading #${calls})`, label: place.label, live: true };
  } catch (err) {
    const why = err instanceof Error ? err.message : String(err);
    return {
      tempC: 15,
      tempF: 59,
      summary: `Offline placeholder — ${why} (reading #${calls})`,
      label: city,
      live: false,
    };
  }
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
      // `city` is optional but it MUST be declared. With an empty `properties`
      // and `additionalProperties: false` a host cannot pass one, so the card
      // always opened on the London default no matter what the user asked for
      // — and then the Refresh button re-fetched London forever, because it
      // reads the city back off the card.
      inputSchema: {
        type: 'object',
        properties: { city: { type: 'string', description: 'City name' } },
        additionalProperties: false,
      },
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
  const { tempC, tempF, summary, label, live } = await forecast(city);

  if (name === 'get-weather' || name === 'weather-refresh-demo') {
    return {
      // `content` is what the model reads. `structuredContent` is what the
      // view fills from. The spec keeps them separate and so does this.
      //
      // `live` travels in both, because a model that reports a placeholder as
      // a real forecast is worse than one that reports nothing.
      content: [
        {
          type: 'text',
          text: `${label}: ${tempF}°F, ${summary}.${live ? '' : ' NOT a real reading.'}`,
        },
      ],
      structuredContent: { city: label, tempC, tempF, summary, live },
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
