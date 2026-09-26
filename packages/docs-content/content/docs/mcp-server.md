---
title: MCP Server
description: Serve a Litro agent's tools, and the ui:// documents it renders into, to any MCP host over stdio with one command.
date: 2026-09-25
---

# MCP Server

`litro mcp serve` puts one agent's tools, and the `ui://` documents [`litro mcp-app build`](/docs/mcp-apps) packed, in front of an MCP host over stdio. One command, no port, no server file to write.

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

There is no HTTP request. A tool that reads a cookie, a header or a session has nothing to read when a host calls it directly. The same tool still gets a real `H3Event` when the [agent endpoints](/docs/agents) run it.

## Several servers side by side

The command opens no port and no hot-reload socket, so two Litro projects configured in the same host do not collide. Each server exits when its host disconnects.

## Not built yet

These are later phases of the MCP server work, not gaps in the design:

- **Streamable HTTP.** stdio is the transport a host launches on its own, and it ships first.
- **Auth.** Nothing to authorize over stdio; it arrives with HTTP.
- **Progress notifications.** A long tool call is bounded by `--timeout` today.
- **`outputSchema`.** A tool describes its input, not yet its output.

## Try it

The playground carries a working agent, four packed apps and two probes:

```bash
pnpm --filter playground mcp-app                      # pack the ui:// documents
node playground/mcp-server/stdio-probe.mjs            # the full client transcript
node playground/mcp-server/stdio-probe.mjs --purity   # the stdout check
```

`stdio-probe.mjs` drives the real server with the SDK's own client and prints what the client received: `tools/list`, `tools/call`, `resources/read` on the document the tool names, and an unknown tool. `--purity` reads the raw stdout and fails on a single byte that is not an MCP message — the specification forbids a stdio server writing anything else there, and one stray log line raises a transport error on the client.
