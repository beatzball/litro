import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { MCPServer } from '@mastra/mcp';
import { createTool } from '@mastra/core/tools';
import { noopLogger } from '@mastra/core/logger';
import { z } from 'zod';

const transport = process.argv[2];
if (transport !== 'http' && transport !== 'stdio') {
  throw new Error('Expected transport argument: http or stdio.');
}
const resourceUri = 'ui://bench-weather/card';
const getWeather = createTool({
  id: 'get-weather',
  description: 'Get the current weather for a city.',
  inputSchema: z.object({
    city: z.string().trim().min(1).max(80).describe('The city name, e.g. "Lisbon".'),
  }),
  outputSchema: z.object({
    city: z.string(),
    tempC: z.number(),
    summary: z.string(),
  }),
  mcp: { _meta: { ui: { resourceUri } } },
  execute: async ({ city }) => ({ city, tempC: 21, summary: 'sunny' }),
});
const server = new MCPServer({
  id: 'weather-benchmark',
  name: 'Weather benchmark',
  version: '1.0.0',
  tools: { 'get-weather': getWeather },
  legacy: 'stateless',
  appResources: {
    [resourceUri]: {
      name: 'Weather',
      html: readFileSync(new URL('./weather.html', import.meta.url), 'utf8'),
    },
  },
});
server.__setLogger(noopLogger);

if (transport === 'stdio') {
  await server.startStdio();
} else {
  const portText = process.env.PORT;
  const port = Number(portText);
  if (!portText || !/^\d+$/.test(portText) || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer from 1 to 65535.');
  }
  const baseUrl = `http://127.0.0.1:${port}`;
  const httpServer = createServer((req, res) => {
    server.startHTTP({
      url: new URL(req.url ?? '/', baseUrl),
      httpPath: '/mcp',
      req,
      res,
    }).catch(() => {
      if (!res.headersSent) res.writeHead(500);
      res.end();
    });
  });
  httpServer.listen(port, '127.0.0.1');
}
