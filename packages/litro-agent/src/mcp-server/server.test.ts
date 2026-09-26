/**
 * The MCP server, driven by the SDK's OWN client over its in-memory transport.
 *
 * Not a fake host. AGENT-012 is the rule this file obeys: a suite we wrote
 * cannot check our own reading of the spec, so the client on the other end is
 * the SDK's, and every assertion is about what IT received — including the
 * ones the SDK enforces server-side, such as `structuredContent` having to be a
 * record.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMcpServer, loadMcpSdk, type McpSdk } from './index.js';
import { resolveTools } from './tools.js';
import { FIXTURE_UI_HTML, HUGE_FIELD_BYTES, fixtureApps, fixtureTools } from './fixtures.js';
import type { ResolvedMcpServer } from './index.js';
import type { AgentConfig } from '../index.js';

/** `content` is typed loosely on a CallToolResult, so this narrows it once
 *  rather than at every assertion. */
function textContent(result: unknown): Array<{ type: string; text: string }> {
  return (result as { content: unknown }).content as Array<{ type: string; text: string }>;
}

let sdk: McpSdk;
let client: Client;
let logged: string[];
let close: () => Promise<void>;

async function connect(options: { timeoutMs?: number; maxResultBytes?: number } = {}): Promise<void> {
  const tools = fixtureTools();
  const apps = fixtureApps();
  const { tools: resolvedTools, oddNames } = resolveTools(tools, apps, {
    agentName: 'demo',
    manifestPath: '/fixture/dist/mcp-apps/manifest.json',
    manifestMissing: false,
  });
  const resolved: ResolvedMcpServer = {
    agent: { name: 'demo', config: {} as AgentConfig, tools },
    tools: resolvedTools,
    apps,
    manifestPath: '/fixture/dist/mcp-apps/manifest.json',
    manifestMissing: false,
    oddNames,
  };

  logged = [];
  const server = createMcpServer({
    resolved,
    sdk,
    serverInfo: { name: 'litro-demo', version: '0.0.0' },
    log: (line) => logged.push(line),
    ...options,
  });

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  client = new Client({ name: 'test', version: '0.0.0' });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  close = async () => {
    await client.close();
    await server.close();
  };
}

beforeEach(async () => {
  sdk = await loadMcpSdk();
});

afterEach(async () => {
  await close?.();
});

describe('tools/list', () => {
  it('publishes the converted inputSchema when the vendor has a converter', async () => {
    await connect();
    const { tools } = await client.listTools();
    const weather = tools.find((t) => t.name === 'get-weather')!;
    expect(weather.description).toBe('Current weather for a city.');
    expect(weather.inputSchema).toMatchObject({
      type: 'object',
      properties: { city: { type: 'string', description: 'City name', maxLength: 80 } },
      required: ['city'],
    });
    // `$schema` passes through. It is legal, and the specification says the
    // dialect defaults to 2020-12 when it is absent.
    expect(weather.inputSchema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
  });

  it('falls back to the permissive object schema when the vendor has none', async () => {
    await connect();
    const { tools } = await client.listTools();
    expect(tools.find((t) => t.name === 'no-converter')!.inputSchema).toEqual({ type: 'object' });
  });

  it('points a tool at its packed ui:// document, by the manifest name', async () => {
    await connect();
    const { tools } = await client.listTools();
    expect(tools.find((t) => t.name === 'get-weather')!._meta).toEqual({
      ui: { resourceUri: 'ui://fixture/weather-card' },
    });
  });

  it('emits visibility only when the author set it', async () => {
    await connect();
    const { tools } = await client.listTools();
    // Absent: the extension already defaults to ['model', 'app'].
    expect((tools.find((t) => t.name === 'get-weather')!._meta as Record<string, never>).ui).not.toHaveProperty(
      'visibility',
    );
    expect(tools.find((t) => t.name === 'hidden-from-model')!._meta).toEqual({
      ui: { resourceUri: 'ui://fixture/weather-card', visibility: ['app'] },
    });
  });

  it('carries no _meta for a tool with no app', async () => {
    await connect();
    const { tools } = await client.listTools();
    expect(tools.find((t) => t.name === 'no-converter')!._meta).toBeUndefined();
  });
});

describe('tools/call', () => {
  it('returns data in structuredContent and the same JSON as text', async () => {
    await connect();
    const result = await client.callTool({ name: 'get-weather', arguments: { city: 'Lisbon' } });
    expect(result.structuredContent).toEqual({ city: 'Lisbon', tempC: 21, summary: 'sunny' });
    expect(textContent(result)).toEqual([{ type: 'text', text: '{"city":"Lisbon","tempC":21,"summary":"sunny"}' }]);
    expect(result.isError).toBeFalsy();
  });

  it('drains a generator tool to its final value', async () => {
    await connect();
    const result = await client.callTool({ name: 'streams', arguments: {} });
    // The yielded progress values are not the result. v1 has nowhere to send
    // them -- progress notifications are phase 3.
    expect(result.structuredContent).toEqual({ done: true });
  });

  it('NEVER sends a UIResult html — AGENT-002', async () => {
    await connect();
    const result = await client.callTool({ name: 'renders-ui', arguments: {} });
    expect(result.structuredContent).toEqual({ city: 'Lisbon', tempC: 21 });
    // The whole message, not just the field a reader would think to check.
    const wire = JSON.stringify(result);
    expect(wire).not.toContain('SECRET-MARKUP');
    expect(wire).not.toContain('shadowrootmode');
    expect(wire).not.toContain('"html"');
  });

  it('maps a throwing tool to isError, with the message and no stack', async () => {
    await connect();
    const result = await client.callTool({ name: 'throws', arguments: {} });
    expect(result.isError).toBe(true);
    expect(textContent(result)).toEqual([{ type: 'text', text: 'upstream is down' }]);
    expect(JSON.stringify(result)).not.toContain('at ');
  });

  it('rejects a nested UIResult rather than leaking its html', async () => {
    await connect();
    const result = await client.callTool({ name: 'nests-a-ui-result', arguments: {} });
    expect(result.isError).toBe(true);
    expect(textContent(result)[0]).toMatchObject({ text: expect.stringContaining('nested UIResult') });
    expect(JSON.stringify(result)).not.toContain('SECRET-MARKUP');
  });

  it('wraps a string result, which the SDK rejects as structuredContent', async () => {
    await connect();
    const result = await client.callTool({ name: 'returns-a-string', arguments: {} });
    expect(result.structuredContent).toEqual({ value: 'ok' });
    expect(textContent(result)).toEqual([{ type: 'text', text: '"ok"' }]);
  });

  it('wraps an array rather than spreading it into index keys', async () => {
    await connect();
    const result = await client.callTool({ name: 'returns-an-array', arguments: {} });
    expect(result.structuredContent).toEqual({ value: [1, 2, 3] });
  });

  it('caps an enormous result, marks the truncation, and logs the real size', async () => {
    await connect({ maxResultBytes: 512 });
    const result = await client.callTool({ name: 'returns-something-enormous', arguments: {} });
    const text = textContent(result)[0].text;
    expect(text).toContain('[truncated by litro mcp:');
    expect(Buffer.byteLength(text, 'utf8')).toBeLessThan(512 + 200);
    expect(result.structuredContent).toMatchObject({ truncated: true, limit: 512 });
    expect((result.structuredContent as { bytes: number }).bytes).toBeGreaterThan(HUGE_FIELD_BYTES);
    expect(logged.join('\n')).toContain('capped a result from tool "returns-something-enormous"');
  });

  it('lets a result under the cap through untouched', async () => {
    await connect({ maxResultBytes: 512 });
    const result = await client.callTool({ name: 'get-weather', arguments: { city: 'Lisbon' } });
    expect(result.structuredContent).toEqual({ city: 'Lisbon', tempC: 21, summary: 'sunny' });
    expect(logged.join('\n')).not.toContain('capped');
  });

  it('times a hanging tool out with isError, and says so on stderr', async () => {
    await connect({ timeoutMs: 40 });
    const result = await client.callTool({ name: 'hangs', arguments: {} });
    expect(result.isError).toBe(true);
    expect(textContent(result)[0]).toMatchObject({ text: expect.stringContaining('did not finish within 40ms') });
    expect(logged.join('\n')).toContain('exceeded 40ms');
  });

  it('answers an unknown tool with a protocol error naming it, not an internal error', async () => {
    await connect();
    await expect(client.callTool({ name: 'no-such-tool', arguments: {} })).rejects.toMatchObject({
      code: sdk.ErrorCode.InvalidParams,
      message: expect.stringContaining('Unknown tool: "no-such-tool"'),
    });
  });

  it('answers invalid arguments with a protocol error carrying the schema detail', async () => {
    await connect();
    await expect(client.callTool({ name: 'get-weather', arguments: {} })).rejects.toMatchObject({
      code: sdk.ErrorCode.InvalidParams,
      message: expect.stringContaining('Validation failed for tool "get-weather": city is required'),
    });
  });
});

describe('resources', () => {
  it('lists each packed app with the descriptor the build wrote', async () => {
    await connect();
    const { resources } = await client.listResources();
    expect(resources).toEqual([
      {
        uri: 'ui://fixture/weather-card',
        name: 'weather-card',
        mimeType: 'text/html;profile=mcp-app',
        // `_meta.ui` is passed through, not rebuilt: a host that decides CSP at
        // prefetch time reads the packer's answer, not ours.
        _meta: { ui: { prefersBorder: true } },
      },
    ]);
  });

  it('reads the document back byte for byte', async () => {
    await connect();
    const { contents } = await client.readResource({ uri: 'ui://fixture/weather-card' });
    expect((contents[0] as { text: string }).text).toBe(fixtureApps()[0].html);
    expect(contents[0].mimeType).toBe('text/html;profile=mcp-app');
    expect(contents[0]._meta).toEqual({ ui: { prefersBorder: true } });
  });

  it('refuses a uri the manifest does not list, and never treats one as a path', async () => {
    await connect();
    await expect(client.readResource({ uri: 'ui://fixture/../../etc/passwd' })).rejects.toMatchObject({
      code: sdk.ErrorCode.InvalidParams,
      message: expect.stringContaining('Unknown resource'),
    });
  });
});

describe('the SDK is optional', () => {
  it('names the package to install when it cannot be resolved', async () => {
    await expect(
      loadMcpSdk(() => Promise.reject(new Error("Failed to resolve import '@modelcontextprotocol/sdk/types.js'"))),
    ).rejects.toThrow(/@modelcontextprotocol\/sdk is not installed/);
  });

  it("recognizes Vite 8's wording, which is how a real project fails", async () => {
    // Measured, in a scaffolded app with no SDK installed. This exact string
    // once fell through to the generic branch, so the reader was told "could
    // not load" and never told what to install.
    await expect(
      loadMcpSdk(() =>
        Promise.reject(
          new Error(
            'Failed to load url @modelcontextprotocol/sdk/server/index.js ' +
              '(resolved id: @modelcontextprotocol/sdk/server/index.js). Does the file exist?',
          ),
        ),
      ),
    ).rejects.toThrow(/@modelcontextprotocol\/sdk is not installed/);
  });

  it("recognizes Node's own wording", async () => {
    await expect(
      loadMcpSdk(() => Promise.reject(Object.assign(new Error('Cannot find package'), { code: 'ERR_MODULE_NOT_FOUND' }))),
    ).rejects.toThrow(/is not installed/);
  });

  it('does NOT blame a missing install for any other load failure', async () => {
    const err = loadMcpSdk(() => Promise.reject(new Error('Unexpected token )')));
    await expect(err).rejects.toThrow(/could not load @modelcontextprotocol\/sdk/);
    await expect(err).rejects.toThrow(/Unexpected token/);
    await expect(err).rejects.not.toThrow(/is not installed/);
  });
});
