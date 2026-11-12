import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { createApp, createRouter, toNodeListener } from 'h3';
import { defineAgent } from '@beatzball/litro-agent';
import {
  createMcpHandler, createMcpServer, loadMcpSdk, loadPackedApps, resolveMcpAgent,
} from '@beatzball/litro-agent/mcp-server';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { weather } from './weather.js';

const appsDir = fileURLToPath(new URL('./mcp-apps/', import.meta.url));
const config = { model: null as never, instructions: 'Serve deterministic weather.' };
const transport = process.argv[2];
if (transport === 'http') {
  const handler = createMcpHandler([{
    name: 'weather',
    module: { default: defineAgent(config) },
    instructions: '',
    tools: [{ name: 'get-weather', module: { default: weather } }],
  }], { appsDir, local: true });
  const app = createApp();
  const router = createRouter();
  router.post('/mcp/:agent', handler);
  router.options('/mcp/:agent', handler);
  app.use(router);
  createServer(toNodeListener(app)).listen(Number(process.env.PORT), '127.0.0.1');
} else if (transport === 'stdio') {
  const resolved = resolveMcpAgent({ name: 'weather', config, tools: new Map([['get-weather', weather]]) }, await loadPackedApps(appsDir));
  const server = createMcpServer({ resolved, sdk: await loadMcpSdk() });
  await server.connect(new StdioServerTransport());
} else {
  throw new Error('Expected http or stdio transport.');
}
