# Design: a Litro MCP server (issue 157)

Status: Draft

Issue: https://github.com/beatzball/litro/issues/157

---

## 1. What the server does

1. It lists one agent's tools (`agents/<name>/tools/*.ts`) in `tools/list`, each with a real `inputSchema`.
2. It runs a tool on `tools/call`: validate, execute, return text in `content` and data in `structuredContent`.
3. It lists and reads the `ui://` documents that `litro mcp-app build` wrote, from `manifest.json`.
4. A tool that has an app points at it with `_meta.ui.resourceUri`.
5. It never re-packs or reshapes a document. It serves the bytes the build wrote.

---

## 2. Open questions

### 2.1 Transport

- **A. stdio.** A host starts the server as a child process. No network, no auth. Only one local host at a time.
- **B. Streamable HTTP.** A host connects by URL. Works remote and deployed. Needs auth, an Origin check and CORS rules.

Recommendation: **both, stdio first.** The SDK puts the same `Server` behind either transport. The playground already does this (`playground/mcp-server/index.ts`, the transport setup at the end of the file). stdio has no auth question, so it ships first.

### 2.2 Where it runs

- **A. A CLI command, `litro mcp serve`.** Needed for stdio: a host must start a process. It loads project source at run time.
- **B. A Nitro route.** Needed for a deployed HTTP server. Uses the build-time agent manifest, like the chat endpoint.

Recommendation: **A first (stdio), then B (HTTP).** A Nitro route cannot speak stdio. A CLI HTTP server duplicates what Nitro already deploys. So: CLI = stdio, Nitro route = HTTP.

### 2.3 Auth for HTTP

- **A. Reuse the agent's `access` guard.** `agent.ts` can already export `access(event)`; the chat handler runs it before every request (`packages/litro-agent/src/runtime/handler.ts`: `buildAgent` reads it, `createAgentHandler` calls it). Same rule for chat and MCP. Simple. It is not the MCP authorization flow, so a host that expects that flow gets a plain 401/403.
- **B. The MCP authorization spec (OAuth 2.1).** What a remote host expects. Much bigger: metadata endpoints, token checks, an issuer.

Recommendation: **A.** Also: refuse a bad `Origin` header, bind to localhost when not deployed, and never send `Access-Control-Allow-Origin: *` (the playground does, in the HTTP branch of `playground/mcp-server/index.ts`; that is fine for a test rig only). Leave B as a later phase, only if someone asks for it.

stdio gets no auth. The MCP spec says a stdio server takes its credentials from the environment.

### 2.4 Which agent's tools

Tools belong to an agent: the scanner walks `agents/*/agent.ts` (`packages/litro-agent/src/plugin.ts` `scanAgents`) and then `tools/*.ts` per agent (`plugin.ts` `scanTools`). Tool names are only unique inside one agent.

- **A. One agent per server.** `--agent <name>`. It may be left out when the project has only one agent. Names stay as they are.
- **B. All agents in one server.** Names need a prefix (`demo.get-weather`), or a clash must fail.

Recommendation: **A.** The `access` guard is per agent too (`handler.ts` `AgentManifestEntry` and `ResolvedAgent`), so one agent per server keeps one auth rule per server. A second agent is a second server entry in the host.

### 2.5 How a tool names its `ui://` app

A derived app has no uri on its definition. `uri` is optional (`packages/litro-agent/src/mcp-app/index.ts` `McpAppConfig`). The build decides it (`mcp-app/index.ts` `buildMcpAppDocument`) and writes it into the manifest (`packages/framework/src/cli/mcp-app.ts`, where it writes `manifest.json`). So a tool cannot import an app and read its uri.

- **A. An explicit field on `defineTool`: `app: 'weather-card'`.** The value is the manifest `name` (the source path stem). The server looks it up in `manifest.json` and fails at start if it is missing. A literal `ui://...` is also accepted.
- **B. A naming rule.** `tools/weather-card.ts` gets `mcp-apps/weather-card.ts` if one exists. No new field. A rename silently breaks the link, and one app cannot serve two tools.

Recommendation: **A.** It is explicit, it is checked at start, and several tools can share one app. The field is ignored by the chat loop.

The same field later needs `visibility`. An app that calls its tool back needs `"app"` in it (the `tools/list` handler in `playground/mcp-server/index.ts`). Default: `['model', 'app']`.

---

## 3. What it reuses

**Tool discovery (agent layer).**
- The scanner finds tools and writes `agentEntries` (`packages/litro-agent/src/plugin.ts` `scanTools`, `generateAgentManifest`).
- `buildAgent` turns one entry into a `Map<name, ToolDefinition>` plus the `access` guard (`packages/litro-agent/src/runtime/handler.ts` `buildAgent`). The server takes the same `AgentManifestEntry` (`handler.ts`). `buildAgent` should be exported inside the package so both call it.
- The CLI path cannot use the build-time manifest. It loads project source with the project's Vite server, as `mcp-app build` does (`packages/framework/src/cli/mcp-app.ts`, `createServer` and `ssrLoadModule`). Not jiti: field decorators fail under it (see the comment above `createServer` in the same file).

**Input schema (part 1).**
- `toolInputJSONSchema(schema, { target })` (`packages/litro-agent/src/runtime/json-schema.ts`). The loop calls it (`packages/litro-agent/src/runtime/loop.ts`). The server calls it for `inputSchema`. A vendor with no converter gives `{ type: 'object' }` (`json-schema.ts` `PERMISSIVE_OBJECT_SCHEMA`).

**Running a tool.**
- Validation is in `loop.ts` `runToolCall` (the `~standard` `validate` call). Generator tools are drained there too. A `UIResult` sends only `data` to the model (`loop.ts` `finalizeToolResult`).
- These live inside `runToolCall`, which also writes session events. Pull the pure part (validate, execute, drain, split `UIResult`) into one function that both call. MCP mapping: `data` goes to `structuredContent`; `html` is never sent, because the `ui://` document is the view.
- `ToolContext.event` may already be `undefined` (`packages/litro-agent/src/index.ts` `ToolContext`). A stdio call has no H3 event, so tools stay valid.

**The build manifest.**
- `litro mcp-app build` writes `manifest.json`: `{ name, uri, html, descriptor }` per app (`packages/framework/src/cli/mcp-app.ts`).
- The descriptor already has the `resources/*` shape: `uri`, `name`, `mimeType`, `_meta.ui` (`packages/litro-agent/src/mcp-app/index.ts` `McpAppDescriptor`).

**What `playground/mcp-server/index.ts` does by hand, and the server replaces:**
- reads the manifest and every file;
- `resources/list` and `resources/read`;
- a hand-typed `tools/list` with hand-typed `inputSchema` and `_meta.ui`;
- `tools/call` as a name `if` chain;
- stdio and stateless Streamable HTTP with CORS.

The weather fetch, caches and limits stay in the playground. They become a real tool in `playground/agents/demo/tools/`. The rig keeps its job: it is how a host we did not write gets a turn.

---

## 4. The MCP SDK, and who owns the server

**Is it a dependency today?** Only in the playground: `@modelcontextprotocol/sdk` `^1.30.0` (`playground/package.json`). No published package depends on it. The installed 1.30.0 speaks protocol `2025-11-25` (its `LATEST_PROTOCOL_VERSION`). It brings 17 runtime dependencies, an HTTP framework among them, and needs `zod` (its `package.json`).

**Who owns the server.**
- **A. `@beatzball/litro-agent`, new subpath `./mcp-server`.** It already has the tools, the schema function, `UIResult` and the `mcp-app` packager (`packages/litro-agent/package.json`, the `./mcp-app` export). The framework CLI adds a thin `litro mcp serve` that loads the subpath at run time, the same way `mcp-app build` loads the packager (`packages/framework/src/cli/mcp-app.ts`, "WHY THE PACKAGER IS IMPORTED AT RUNTIME"). No dependency cycle.
- **B. The framework CLI.** It would import agent-layer code. That is the cycle `mcp-app.ts` avoids. It also makes every Litro project carry the SDK.

Recommendation: **A.** Add the SDK as an **optional peer dependency** of `@beatzball/litro-agent`, not a dependency. Only a project that serves MCP installs it. The subpath fails with a clear "install `@modelcontextprotocol/sdk`" message, like `mcp-app build` does for a missing packager.

Do not hand-write the JSON-RPC layer. That would be one more place where our reading of the spec checks itself.

---

## 5. Phases (each ships alone)

1. **Tools over stdio, as a library.** `createMcpServer(entry)` in `@beatzball/litro-agent/mcp-server`: `tools/list` (with `toolInputJSONSchema`) and `tools/call`. No apps. Extract the shared tool runner from `loop.ts`. Tests use the SDK's in-memory client. Check it in one real host.
2. **Apps.** Read `manifest.json`. Add `resources/list`, `resources/read`, the `defineTool` `app` field and `_meta.ui.resourceUri`. Fail at start on a missing app name. Move the playground rig onto it.
3. **`litro mcp serve` (stdio).** Loads the agent through Vite. `--agent`, `--apps <dir>`. Docs page. Drops "No MCP server" from the MCP Apps limitations (`packages/docs-content/content/docs/mcp-apps.md`).
4. **Streamable HTTP as a Nitro route.** The `access` guard, the Origin check, no wildcard CORS. Generated stub, like the agent handler.
5. **(Only if asked.) MCP OAuth.**

---

## 6. Risks, and what a real host must check

The lesson from the MCP Apps work: a suite written against our own reading of the spec cannot check that reading. It passed while a real host rejected the handshake. So every phase ends with a real host, not only our tests.

**Risks.**
- **stdout is the wire in stdio.** One stray byte breaks the framing (see the manifest-read error path in `playground/mcp-server/index.ts`). Vite prints info lines with `console.log`. The CLI must send all Vite and project logging to stderr.
- **Schema dialect.** We ask for `draft-2020-12` (`json-schema.ts`). A host on an older protocol may assume draft-07, and a vendor schema may carry `$schema`. Unknown until a host sees one.
- **`structuredContent` must be an object.** A tool that returns an array or a string needs a rule: wrap it, or send text only.
- **Generator tools.** Drain to the final value first. Progress notifications can come later.
- **Tools without a request.** A tool that reads `ctx.event` (cookies, headers) gets `undefined` over stdio. The `access` guard does not run over stdio.
- **Vendors with no converter** still publish `{ type: 'object' }`. The host then shows a tool it cannot fill in. Say so in the docs.
- **The shared tool runner.** Extracting it from `runToolCall` touches the chat loop's hot path. The loop's ordering tests must stay green.

**Check in a real MCP host, per phase.**
1. The handshake completes over stdio. Over HTTP too, in phase 4.
2. `tools/list` is accepted, and a real `inputSchema` shows its fields (one converting vendor, one not).
3. The model calls a tool and gets `content`. `structuredContent` arrives.
4. The `ui://` app renders from `resources/read`, bytes unchanged.
5. The app calls its tool back (`visibility` includes `"app"`), and the round trip works.
6. HTTP: a wrong Origin is refused. A failing `access` guard gives 401/403, and the host shows it as an auth failure, not a crash.
