---
'@beatzball/litro-agent': minor
---

Serve an agent's tools and `ui://` apps over MCP Streamable HTTP, as a Nitro route.

The same server phase 1 put behind stdio now also answers over HTTP at
`/__litro/mcp/:agent`. One URL per agent, and one new subpath,
`@beatzball/litro-agent/mcp-handler`, that the agents plugin's generated
`server/stubs/mcp-handler.ts` feeds the build-time manifest into. A project turns
it on with two static handler entries in `nitro.config.ts` — POST for the
JSON-RPC channel, OPTIONS for the CORS preflight.

The gates, in order: `Origin` must be allowlisted when it is present (absent is
allowed, because a host that is not a browser sends none), then a static
`Authorization: Bearer` token compared in constant time, then the agent's own
`access(event)` guard. No wildcard CORS is ever sent. A build that is neither
marked local nor given a token **refuses to start**, and says which environment
variable to set; `litro dev` needs neither.

`LITRO_MCP_TOKEN`, `LITRO_MCP_LOCAL`, `LITRO_MCP_ORIGINS` and
`LITRO_MCP_APPS_DIR` configure it. The route is stateless — no session id is
issued or validated — so it works wherever Nitro deploys to more than one
instance, and a client that disconnects mid-call closes its transport instead of
leaking one.
