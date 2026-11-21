# Eve native MCP fixture

Eve means [vercel/eve](https://github.com/vercel/eve). This fixture pins `eve` 1.0.0-rc.10, Zod 4.6.7, and esbuild 0.28.2 in its own npm lockfile. Use Node.js 24 or newer.

Install the common suite client first for the socket smoke check:

```sh
cd benchmarks/mcp
npm ci --workspaces=false --no-audit --no-fund
cd apps/eve
npm ci --workspaces=false --no-audit --no-fund
npm run build
npm run verify
```

`npm run verify` uses the parent suite's official `@modelcontextprotocol/client` 2.4.0. It starts a child on a free loopback port with no model credentials, pins protocol `2026-07-28`, and checks the tool list, city schema, deterministic call result, invalid inputs, and the cross-origin gate. The client is not charged to this app's install footprint.

To start the built server:

```sh
PORT=3000 node dist/server.mjs http
```

The endpoint is `http://127.0.0.1:3000/mcp`. The launcher binds loopback and imports Eve's native `.output/server/index.mjs`. The [channel](https://github.com/vercel/eve/blob/eve%401.0.0-rc.10/packages/eve/src/public/channels/mcp.ts) uses `mcpChannel({ auth: none(), agent: false, tools: true, route: '/mcp' })`. It publishes exactly the static authored `get-weather` tool, running without a model, turn, or workflow invocation. The tool uses `defineTool` from `eve/tools`, with `inputSchema: z.object({ city: z.string().trim().min(1).max(80) })`.

Eve's native compiler is required to register the authored tool and channel. Each build removes `dist`, `.output`, and `.eve`, runs `eve build --skip-sandbox-prewarm`, then builds only the launcher with esbuild `packages: 'external'`. The sandbox is never opened by this tool. This measures a full native Eve compile and server build; other fixtures may need less build machinery. The native compiler [fetches model catalog metadata](https://github.com/vercel/eve/blob/eve%401.0.0-rc.10/packages/eve/src/compiler/model-catalog.ts) into `.eve/cache/` even though no model is invoked. Cleaning `.eve` makes that fetch part of each cold build, so network variation affects build timing. Runtime weather calls require no external service. Keep `.output` with `dist` and the installed dependencies. Generated `.eve` and `.output` files are ignored because they can contain machine paths.

The native [published-tools implementation](https://github.com/vercel/eve/blob/eve%401.0.0-rc.10/packages/eve/src/internal/mcp/published-tools.ts) reconstructs the advertised JSON Schema before invoking the authored tool. Consequently, an 80-character city with surrounding whitespace is rejected by the raw `maxLength: 80` check before Zod can trim it. Normal padded inputs such as ` Lisbon ` trim correctly, and a raw 80-character city succeeds. The smoke check records this boundary difference from direct trim-then-length validation.

Native Streamable HTTP is supported. The channel has no documented MCP stdio or legacy SSE transport, and no public MCP Apps `ui://` resource option in this release; these measurements are **N/A**. Its optional skill resources are distinct from MCP Apps. See the pinned [channel guide](https://github.com/vercel/eve/blob/eve%401.0.0-rc.10/docs/channels/mcp.mdx) and [HTTP server source](https://github.com/vercel/eve/blob/eve%401.0.0-rc.10/packages/eve/src/internal/mcp/streamable-http-server.ts).
