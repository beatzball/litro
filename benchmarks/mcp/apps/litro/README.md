# Litro weather fixture

Published `@beatzball/litro-agent@0.7.3`, with the optional SDK v1 installed.
`npm ci` then `npm run build` writes an external-package ESM server and packs a
data-free HTML document with the public `buildMcpAppDocument` API.

`PORT=3111 node dist/server.mjs http` serves `/mcp/weather` on loopback with the
native `createMcpHandler` origin gate and explicit local mode. This uses h3's
Node listener, without the full Nitro application build. `node dist/server.mjs
stdio` connects the native `createMcpServer` to the official SDK transport.
Both use pre-resolved tools; the filesystem scanner, Vite loader and `litro mcp
serve` CLI startup are outside this measurement.

The tool uses Zod 4's Standard Schema converter, trims city input, requires
1–80 characters and returns `{city,tempC:21,summary:'sunny'}`. It returns data
without per-call component rendering. The native MCP Apps bridge fills a
static HTML shell from `structuredContent`. There is no browser component
runtime in this fixture. No model or provider executes; the agent's model
field is unused by the MCP tool path.

The suite's official SDK v2 client uses legacy negotiation for this v1 server.
Run the protocol, validation and resource checks from the suite with
`node run.mjs --verify-only --app litro`. The browser check is separate from
all timing samples.
