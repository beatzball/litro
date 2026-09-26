---
title: MCP Server
description: Serve a Litro agent's tools, and the ui:// documents it renders into, to any MCP host — over stdio with one command, or over HTTP as a Nitro route.
date: 2026-09-26
---

# MCP Server

One agent's tools, and the `ui://` documents [`litro mcp-app build`](/docs/mcp-apps) packed, in front of an MCP host. Two transports, the same server behind both:

- **stdio** — `litro mcp serve`. One command, no port, no server file to write. This is what a desktop host launches for itself.
- **Streamable HTTP** — a Nitro route, `/__litro/mcp/:agent`. Two lines in `nitro.config.ts`, and it deploys anywhere Nitro deploys.

```bash
litro mcp serve
```

It serves four methods:

| Method | What it answers |
| --- | --- |
| `tools/list` | every tool in the agent's `tools/` directory, with its description and `inputSchema` |
| `tools/call` | runs the tool and returns its result as `content` plus `structuredContent` |
| `resources/list` | every packed `ui://` document in `dist/mcp-apps/` |
| `resources/read` | one document's bytes, exactly as the packer wrote them |

## What makes it different

**A tool returns a component, and the reader sees it.**

The playground's `get-weather` tool returns a `ui()` result: structured `data` for the model, and a server-rendered `<demo-weather-card>` for the host to show.

```ts
async execute({ city }) {
  const tempC = 21;
  const summary = 'sunny';
  return ui(html`<demo-weather-card .city=${city} .tempC=${tempC} .summary=${summary}></demo-weather-card>`, {
    data: { city, tempC, summary },
  });
}
```

In a desktop host, that one call produces two different things at once. The model reads `{"city":"Lisbon","tempC":21,"summary":"sunny"}` and says **21°C** in its own sentence. The card on screen says **70°F**, because the component converts the reading itself before it paints.

Neither number is wrong, and neither channel wrote the other. That is the whole design: the model reasons over data, the reader sees a component, and the component is free to present the data however it likes.

The `html` never reaches the model. A `UIResult`'s markup is not on the `tools/call` wire at all — the host reads the view separately, with `resources/read`, and fills it from `structuredContent`.

## Host configuration

A host launches the command itself. Both halves of this configuration are load-bearing:

```json
{
  "mcpServers": {
    "my-app": {
      "command": "/absolute/path/to/my-app/node_modules/.bin/litro",
      "args": ["mcp", "serve", "--project", "/absolute/path/to/my-app"]
    }
  }
}
```

- **Name the binary with a path.** `npx litro` resolves the name from the *current* directory, and the host's current directory is not your project. From anywhere else it goes to the public registry and fails with `npm error code ENOVERSIONS / No versions available for litro`, which says nothing about the real cause.
- **Pass `--project`.** Without it the project is the host's working directory. At least one desktop host also ignores a `cwd` field in its server configuration entirely, so `--project` is the only thing that reliably locates the project.

This is the plain form, and it is what to use. An earlier shell wrapper — `sh -c 'cd <project> && exec ...'` — is no longer needed now that `--project` exists.

Run `litro mcp-app build` before starting a host if your tools name an app. A tool that names an app the manifest does not list is a **startup** failure, not a silent blank panel, because the MCP Apps specification requires the resource to exist on the server.

## Flags

| Flag | Default | What it does |
| --- | --- | --- |
| `--project <dir>` | the working directory | the project root to load the agent from |
| `--agent <name>` | the project's only agent | which agent to serve. **Required** when the project has more than one |
| `--apps-dir <dir>` | `dist/mcp-apps` | where `litro mcp-app build` wrote the packed documents |
| `--timeout <ms>` | `30000` | how long one `tools/call` may run before it answers with an error |
| `--max-result-bytes <n>` | `1048576` | how large one tool result may be |

`--timeout` and `--max-result-bytes` each take a positive whole number; anything else is rejected before the server starts.

**One server serves one agent.** Tool names are unique inside an agent, not across a project, so a project with two agents is two entries in the host configuration. Starting without `--agent` there fails at startup rather than guessing:

```
litro mcp serve: this project has 2 agents (demo, support), so --agent is required.
  A second agent is a second server entry in the host configuration.
```

Only the chosen agent's modules are loaded, so a second agent with a broken import cannot stop the one you are serving from starting.

Run it in a directory that is not a project and it says so rather than failing four steps later:

```
litro mcp serve: /tmp/scratch has no package.json, so it is not a project directory.
  This command takes the project from the working directory. Pass --project <dir> when the host launches it somewhere else.
```

## The SDK is an optional peer dependency

Install it only in a project that serves MCP:

```bash
pnpm add -D @modelcontextprotocol/sdk
```

Every other project builds and runs without it, and nothing in `@beatzball/litro-agent` imports it statically. When it is missing, the command says what to add:

```
litro mcp serve: @beatzball/litro-agent is not installed in this project.
  pnpm add @beatzball/litro-agent
```

The SDK owns the JSON-RPC layer, the handshake and the schemas. It is loaded through the project's own resolver, so the copy that answers is the version the project pinned.

## `inputSchema` is only as good as your schema library

`tools/list` builds each tool's `inputSchema` from its Standard Schema, through the converter half of the [Standard JSON Schema](https://standardschema.dev) interface — `~standard.jsonSchema.input`.

A hand-rolled `~standard` object can implement `validate` but not that converter, so it publishes the permissive fallback:

```json
"inputSchema": { "type": "object" }
```

That is valid, and it tells a host nothing about the arguments. A library with a converter publishes the real thing:

```ts
import { z } from 'zod';

const getWeatherSchema = z.object({
  city: z.string().trim().min(1).max(80).describe('The city name, e.g. "Lisbon".'),
});
```

```json
"inputSchema": {
  "type": "object",
  "properties": {
    "city": {
      "type": "string",
      "minLength": 1,
      "maxLength": 80,
      "description": "The city name, e.g. \"Lisbon\"."
    }
  },
  "required": ["city"],
  "$schema": "https://json-schema.org/draft/2020-12/schema"
}
```

Zod 4 and ArkType implement the converter today; Valibot does not yet. `@beatzball/litro-agent` takes no schema library of its own — any Standard Schema vendor works, and the converter is used when it is there.

## Tool names are global to a host

A host merges the tools of every server it is connected to into one flat list. **Two servers exposing `get-weather` is ambiguous**: the host picks one, and the reader cannot tell which answered. This confused a real person during testing.

Name a tool for what it does in the world, not just within its project.

Names outside MCP's guidance — 1 to 128 characters of letters, digits, `_`, `-` and `.` — are reported on stderr at startup. They are not rejected and not rewritten, because a tool's name is its filename and renaming it behind your back would be worse.

## `ctx.event` is `undefined` over stdio

There is no HTTP request. A tool that reads a cookie, a header or a session has nothing to read when a host calls it directly. The same tool does get a real `H3Event` over the HTTP route, and when the [agent endpoints](/docs/agents) run it.

## Several servers side by side

The command opens no port and no hot-reload socket, so two Litro projects configured in the same host do not collide. Each server exits when its host disconnects.

## Streamable HTTP as a Nitro route

The same tools and the same documents, over HTTP, for a host that is given a URL instead of a command.

### Turn it on

Two static handler entries in `nitro.config.ts`, beside the agent ones the project already has:

```ts
handlers: [
  // ... the agent route entries
  { route: '/__litro/mcp/:agent', method: 'post', handler: resolve('./server/stubs/mcp-handler.ts') },
  { route: '/__litro/mcp/:agent', method: 'options', handler: resolve('./server/stubs/mcp-handler.ts') },
],
```

`server/stubs/mcp-handler.ts` is generated for you by the agents plugin, exactly as `agent-handler.ts` is. The routes must be declared here and not pushed from a build hook: the dev server reads handler config before `build:before` fires, so a route added there never reaches `litro dev`.

**Two entries, one route.** POST is the whole JSON-RPC channel. OPTIONS is the CORS preflight a browser-based inspector sends before it, and it answers without the token, because a browser will not attach an `Authorization` header to a preflight. GET is not served: it exists in the current SDK only for the standalone server-initiated stream, protocol revision 2026-07-28 removes it, and this route is stateless.

**One URL per agent.** `/__litro/mcp/demo` serves the `demo` agent and nothing else, the same way `litro mcp serve --agent demo` does. A host holds one entry per URL.

### It will not start without a token

An MCP route on a deployed server has to say who may call it, and there is no sensible default for that, so a build that has neither a token nor a local marker **refuses to start**:

```
AgentError: LITRO_MCP_TOKEN is not set, and this MCP route is not local.
  Set LITRO_MCP_TOKEN to a shared secret; a host sends it as "Authorization: Bearer <token>".
  Set LITRO_MCP_LOCAL=1 instead only when the route is reachable from localhost alone.
  A route with no token answers every request that reaches it, so there is no default for this.
```

`litro dev` needs nothing: a dev server binds to localhost, and it is recognized as one.

| Variable | What it does |
| --- | --- |
| `LITRO_MCP_TOKEN` | the shared secret. A host sends it as `Authorization: Bearer <token>`. Compared in constant time |
| `LITRO_MCP_LOCAL` | `1` says the route is reachable from this machine only, and no token is needed. `0` forces the token check on |
| `LITRO_MCP_ORIGINS` | comma-separated exact origins a browser-based host may call from |
| `LITRO_MCP_APPS_DIR` | where `litro mcp-app build` wrote. Defaults to `dist/mcp-apps` under the working directory |

### The gates, in order

1. **`Origin`.** Present and not allowlisted answers **403**. **Absent is allowed** — a CLI or desktop host sends none, and refusing that would refuse every host that is not a browser. A local route with no allowlist accepts any `localhost`, `127.0.0.1` or `[::1]` origin, which is where an inspector runs. A route that is not local accepts only what `LITRO_MCP_ORIGINS` names.
2. **The bearer token.** Missing or wrong answers **401**, and the message says nothing about the value that was sent.
3. **The agent's own `access(event)` guard**, last — the same guard the [agent endpoints](/docs/agents) run, and the place to put a project's own rule. Over HTTP it gets a real `H3Event`, which it never has over stdio.

**No wildcard CORS, ever.** The route echoes one allowlisted origin or none. `Access-Control-Allow-Origin: *` would let any page a reader visits drive their MCP route from their own browser, with whatever token their host had stored.

**No OAuth.** A static bearer token is what hosts can already send, and it costs one line of configuration instead of an authorization server. The OAuth 2.1 profile is a later phase, if anyone asks for it.

### Host configuration

```json
{
  "mcpServers": {
    "my-app": {
      "type": "http",
      "url": "https://my-app.example.com/__litro/mcp/demo",
      "headers": { "Authorization": "Bearer <the value of LITRO_MCP_TOKEN>" }
    }
  }
}
```

Field names differ between hosts — some call it `url` and `headers`, some `serverUrl`. What every host that supports HTTP has in common is a URL and a static header, which is exactly what this route needs.

### Sessions, streaming and a client that hangs up

**There are no sessions.** The route is stateless: no `Mcp-Session-Id` is issued and none is validated. Every tool list, schema and document is resolved when the server starts, and a `tools/call` carries its own arguments — so there is nothing for a session to hold. It also means the next request may reach a different instance and still work, which matters wherever Nitro deploys to more than one. Protocol revision 2026-07-28 removes protocol-level sessions anyway.

**A POST answers with an SSE stream**, which is the form the specification prefers. Behind a proxy that buffers responses, a deployment can ask for one JSON body instead and lose the streaming rather than the route.

**A client that disconnects mid-call** cancels the response stream. The transport and its server are closed on that signal, so nothing leaks per abandoned request. The tool itself runs to completion — a promise cannot be canceled — and its result is dropped instead of written. Nothing is appended to a session store on this path, so there is no half-written turn to recover.

### Apps over HTTP need the packed directory

The route reads `dist/mcp-apps/` from the filesystem when it starts, because `litro mcp-app build` is a separate command at a separate time and nothing in the Nitro build knows whether it has run. A deployment that serves apps ships that directory beside the server, or points `LITRO_MCP_APPS_DIR` at an absolute path. One that does not serves its tools and says so in the log.

A deployment of `.output`/`dist/server` **alone** also needs the SDK to be resolvable at run time. Nitro does not trace it, because it is loaded through a specifier it cannot analyze — that is the same indirection that lets every other project build without the SDK at all. Deploy with `node_modules`, or add it to `externals.traceInclude` in `nitro.config.ts`.

## Not built yet

These are later phases of the MCP server work, not gaps in the design:

- **OAuth 2.1.** A static bearer token is what ships; the full profile needs an authorization server Litro does not have.
- **Progress notifications.** A long tool call is bounded by the per-call timeout.
- **`outputSchema`.** A tool describes its input, not yet its output.

## Try it

The playground carries a working agent, four packed apps and two probes:

```bash
pnpm --filter playground mcp-app                      # pack the ui:// documents
node playground/mcp-server/stdio-probe.mjs            # the full client transcript
node playground/mcp-server/stdio-probe.mjs --purity   # the stdout check
```

`stdio-probe.mjs` drives the real server with the SDK's own client and prints what the client received: `tools/list`, `tools/call`, `resources/read` on the document the tool names, and an unknown tool. `--purity` reads the raw stdout and fails on a single byte that is not an MCP message — the specification forbids a stdio server writing anything else there, and one stray log line raises a transport error on the client.

For the HTTP route, over a real socket against a real production build:

```bash
pnpm --filter playground build
node playground/mcp-server/http-probe.mjs           # the gates and the protocol
node playground/mcp-server/http-probe.mjs --gates   # the gates only
```

`http-probe.mjs` boots `dist/server/server/index.mjs` once per scenario and prints the status and headers of every answer: a bad `Origin` refused with 403, no `Origin` allowed, a wrong token refused, the right one allowed, and a server that will not start without either. A production build is the only thing that can show this — `litro dev` never runs the bundler, so it cannot tell you whether the generated handler compiled.
