# Flue native tool fixture

Flue means [withastro/flue](https://github.com/withastro/flue). This fixture pins `@flue/runtime` 2.3.0, Valibot 1.5.0, and esbuild 0.28.2 in its own npm lockfile. Use Node.js 24 or newer for this suite.

```sh
cd benchmarks/mcp/apps/flue
npm ci --workspaces=false --no-audit --no-fund
npm run build
npm run verify
```

`weather.ts` uses native `defineTool` from `@flue/runtime/tool`. The input trims `city`, then requires 1–80 characters. Its `run` callback returns Flue's native `{ output }` envelope containing `{ city, tempC: 21, summary: 'sunny' }`. Verification parses the declared Valibot schema and calls that callback directly with a minimal context. It checks valid boundaries and rejects missing, empty, whitespace-only, oversized, and nonstring cities. It requires no model, credentials, or network request.

This is a direct tool execution check. Flue's native MCP APIs connect an agent to remote servers; they do not expose the tool as an MCP server. `createMcpConnection` creates an SDK client, discovers remote tools, and adapts them for Flue. Its transport union is `streamable-http | sse`. These are client capabilities. See the pinned [MCP guide](https://github.com/withastro/flue/blob/v2.3.0/apps/docs/src/content/docs/guide/mcp.md), [implementation](https://github.com/withastro/flue/blob/v2.3.0/packages/runtime/src/mcp.ts), [public exports](https://github.com/withastro/flue/blob/v2.3.0/packages/runtime/src/index.ts), and [tool implementation](https://github.com/withastro/flue/blob/v2.3.0/packages/runtime/src/tool.ts).

MCP server HTTP, stdio, legacy SSE, protocol latency, server idle memory, and MCP Apps resource size are **N/A** for this fixture. There is no `dist/server.mjs`; the build emits `dist/weather.mjs` and `dist/verify.mjs`. Install/build costs here describe a native tool sample and must not be presented as Flue MCP server measurements. An SDK server wrapper would measure a different implementation.
