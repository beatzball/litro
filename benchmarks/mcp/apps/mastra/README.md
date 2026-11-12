# Mastra MCP benchmark app

This standalone fixture pins `@mastra/mcp@2.8.0` and `@mastra/core@1.82.0`, the npm `latest` releases checked on 2026-11-12. Both require Node >=22.13.0 and use Apache-2.0. All resolved dependencies are in this app's `package-lock.json`.

Run from this directory:

```sh
npm ci --workspaces=false
npm run build
PORT=4317 node dist/server.mjs http
# Or let an MCP client launch this command:
node dist/server.mjs stdio
```

Install and build are separate. The build cleans `dist`, bundles the browser entry and official `@modelcontextprotocol/ext-apps@2.0.3` into `dist/weather.html`, and bundles local server code with package imports external into `dist/server.mjs`. Keep `node_modules` next to `dist`. The HTML contains all JavaScript and CSS and needs no network requests. Its size includes the full browser SDK dependency graph.

`get-weather` accepts `{city: string}` with Zod trimming followed by a 1–80 character check. It always returns `{city, tempC: 21, summary: 'sunny'}`. Mastra requires an explicit `outputSchema` to expose a plain return value as `structuredContent`; without one its native `toCallToolResult` sends JSON text only. The fixture therefore keeps an output schema, with equivalent JSON text in `content`. This adds output validation work compared with frameworks that emit structured data without an output schema. The UI fills a static placeholder from tool-result notifications using `App.ontoolresult` and `textContent`.

The server uses native [`MCPServer`](https://mastra.ai/reference/tools/mcp-server) APIs: `startStdio()`, `startHTTP({url,httpPath,req,res})`, `appResources`, and the tool's `mcp._meta.ui.resourceUri`. Native `appResources` serves `ui://bench-weather/card` through `resources/list` and `resources/read`; MIME type is `text/html;profile=mcp-app`. The official guest SDK is bundled only for browser communication; resource registration belongs to Mastra. See the [MCP Apps guide](https://mastra.ai/docs/connections/mcp#build-mcp-apps) and [official guest SDK](https://github.com/modelcontextprotocol/ext-apps).

HTTP binds `127.0.0.1` at the required `PORT`, at `/mcp`. Stdio stdout is reserved for protocol messages; the inherited `__setLogger(noopLogger)` API silences application logging in both transports. This local measurement fixture does not configure authentication or optional Host/Origin guards.

Mastra 2.x uses MCP revision `2026-07-28`. `legacy: 'stateless'` enables older clients over HTTP; native stdio rejects older handshakes. Legacy HTTP creates no protocol session and does not support session GET/DELETE. The former standalone SSE server transport is absent. See the [2.x migration guide](https://mastra.ai/reference/migrations/mcp-v2), [transport implementation](https://github.com/mastra-ai/mastra/blob/%40mastra%2Fmcp%402.8.0/packages/mcp/src/server/server.ts), and [MCP 2.0 announcement](https://mastra.ai/blog/introducing-mcp-2).

The parent suite owns the common official SDK client and smoke checks. This app declares no benchmark client dependency. Native HTTP and stdio have been checked with `@modelcontextprotocol/client@2.4.0`, including discovery, bounds, trimmed output, and exact resource bytes. HTTP also passed a separate older `@modelcontextprotocol/sdk@1.32.2` interoperability check. These checks cover resource delivery; iframe rendering has not been checked.

The v2 client defaults to the legacy handshake. Use the following options for this app:

```js
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

const client = new Client({ name: 'benchmark', version: '1.0.0' }, {
  capabilities: {},
  versionNegotiation: { mode: { pin: '2026-07-28' } },
});
// Pick one transport:
const http = new StreamableHTTPClientTransport(new URL(endpoint));
const stdio = new StdioClientTransport({
  command: process.execPath, args: [entry, 'stdio'], cwd: appDir, stderr: 'pipe',
});
await client.connect(http); // Or stdio.
```

For frameworks using older MCP revisions, the same v2 client can use its default legacy mode. `mode: 'auto'` negotiates both eras but the official stdio transport starts an extra disposable process to probe the server. Disclose that extra startup if measuring auto mode; use explicit protocol selection to measure one server process. This behavior is documented in the [official client guide](https://ts.sdk.modelcontextprotocol.io/v2/clients/connect) and the installed `@modelcontextprotocol/client/dist/client-BTIWJvaF.d.mts` declaration.
