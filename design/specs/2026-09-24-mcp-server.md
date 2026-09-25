# Design: a Litro MCP server

Status: Draft

Issue: https://github.com/beatzball/litro/issues/157

Supersedes: `design/specs/2026-09-14-mcp-server.md`

---

## 1. What it is

A server that puts a Litro project's agent tools, and the `ui://` documents
`litro mcp-app build` packs, in front of an MCP host:

1. `tools/list` from the tools the agent layer already discovers, each with a
   real `inputSchema`.
2. `tools/call` runs the tool: validate, execute, return text in `content` and
   data in `structuredContent`.
3. `resources/list` and `resources/read` from the build's `manifest.json`.
4. A tool that has an app points at it with `_meta.ui.resourceUri`.
5. It never re-packs or reshapes a document. It serves the bytes the build
   wrote.

Litro can pack a document today. It cannot serve one. The docs say so, in the
MCP Apps limitations list: "**No MCP server.** This produces the artifact a
server publishes; serving `resources/list` and `tools/list` is a separate piece
of work."

This spec replaces the draft of 2026-09-14. Every claim in it was re-checked
against the code and against a running server, and three of its answers changed
as a result. Those changes are marked **Changed from the earlier draft**.

## 2. What exists today, and what does not

Each line was verified in this repo on 2026-09-24.

| Claim | Verified how | Result |
|---|---|---|
| Litro packs a `ui://` document | `pnpm --filter playground mcp-app` | 4 apps, 13.0-19.0 KB each, plus `manifest.json` |
| The manifest shape | read `dist/mcp-apps/manifest.json` | `{ name, uri, html, descriptor }` per app |
| The descriptor shape | read `dist/mcp-apps/weather-card.json` | `{ uri, name, mimeType, _meta: { ui } }` |
| Litro cannot serve one | `packages/framework/src/cli/index.ts` | `mcp-app` has one subcommand, `build` |
| The hand-written rig works | ran it, drove it with the SDK's own client over Streamable HTTP | `tools/list`, `resources/list`, `resources/read`, `tools/call` all answered |
| Tools are discovered per agent | `scanAgents` / `scanTools` in `packages/litro-agent/src/plugin.ts` | `agents/*/agent.ts`, then `agents/<name>/tools/*.ts`; the tool name is the filename stem |
| A tool has no app field | `ToolConfig` in `packages/litro-agent/src/index.ts` | `description`, `input`, `execute`. Nothing else |
| Tool names are unique per agent, not per project | same scanner | two agents may both have `tools/search.ts` |

### 2.1 The blocker: mostly gone, with one catch

Issue 154 closed, and `toolInputJSONSchema` in
`packages/litro-agent/src/runtime/json-schema.ts` does what it says. Run against
real schema libraries it produced:

| Schema library | Has `~standard.jsonSchema.input`? | What came out |
|---|---|---|
| zod 4.6.5 | yes | `{"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","properties":{"city":{"type":"string","maxLength":80,"description":"City name"}},"required":["city"]}` |
| arktype 2.2.3 | yes | full object schema |
| valibot 1.5.0 | no | `{"type":"object"}` |
| the repo's own hand-rolled schema | no | `{"type":"object"}` |

Asked for `draft-07` instead, zod returned `"$schema":"http://json-schema.org/draft-07/schema#"`
and the same body, so the `target` option is honored rather than ignored.

**So the mechanism works, and the catch is the data.** The only tool that ships
in this repo — `playground/agents/demo/tools/get-weather.ts` — is a hand-rolled
Standard Schema with no converter, so it still publishes `{ type: 'object' }`,
and its description carries the parameter contract in prose instead. A project
that writes its tools with zod or arktype gets a real schema with no further
work; a project that hand-rolls one, or uses a library with no converter, does
not.

Two consequences for this design:

- The server does not need any new schema work. It calls the same function the
  chat loop calls.
- The docs must say plainly that the quality of `tools/list` depends on the
  schema library, and the playground's demo tool should be rewritten on a
  library with a converter, so that the repo's own example shows the good path.
  That is a small, separate piece of work, and it is the honest first thing to
  fix.

### 2.2 The rig is the closest thing to a prototype, and it earned that

`playground/mcp-server/` lists tools, lists `ui://` resources, reads the
manifest and answers `tools/call`. Everything in it that the real server must
replace:

- reads the manifest and every file;
- `resources/list` and `resources/read`;
- a hand-typed `tools/list`, with hand-typed `inputSchema` and `_meta.ui`;
- `tools/call` as a chain of name comparisons;
- stdio, and stateless Streamable HTTP with wildcard CORS.

Everything in it that stays: the weather fetch, the caches, the input caps, and
its job as the place where a host nobody here wrote gets a turn (AGENT-012).
Its weather tool should become a real tool under `playground/agents/demo/tools/`
once the server can serve one.

## 3. The protocol moved, and the SDK has not caught up

This is the largest fact the earlier draft did not have.

- The current specification revision is **2026-07-28**. It removes the
  `initialize` handshake, removes protocol-level sessions, removes the GET
  stream and stream resumption, carries protocol version and client
  capabilities per request in `_meta.io.modelcontextprotocol/*`, requires
  `MCP-Protocol-Version`, `Mcp-Method` and `Mcp-Name` headers on every POST,
  and replaces server-initiated requests with multi round-trip results.
- The official TypeScript SDK, at **1.30.1** (the latest published version as of
  2026-09-24), still reports `LATEST_PROTOCOL_VERSION = '2025-11-25'` and
  supports `2025-11-25, 2025-06-18, 2025-03-26, 2024-11-05, 2024-10-07`.

Measured, against the rig built on that SDK: a client that sends a 2026-07-28
request is answered with HTTP 400 and
`{"code":-32000,"message":"Bad Request: Unsupported protocol version: 2026-07-28 (supported versions: 2025-11-25, ...)"}`.
A GET to the endpoint returns 406, where 2026-07-28 asks for 405.

`-32000` is not one of the errors the new revision teaches a client to
recognize, so a modern client reading that body follows its documented fallback
and retries with `initialize` — which the SDK server answers. **Interoperability
holds today, through the legacy path.** It is not a reason to do nothing, and it
is not a reason to hand-write a 2026-07-28 server either: see decision 6.

The MCP Apps extension is on **2026-01-26**, which is exactly what the packager
pins (`MCP_APPS_SPEC_VERSION` in `packages/litro-agent/src/mcp-app/index.ts`).
Nothing to change there.

## 4. Decision 1 — transport: both, stdio first

The specification defines two standard bindings, stdio and Streamable HTTP, and
says protocol semantics are identical on either. Host support follows the same
split: a local server is launched as a subprocess over stdio; a hosted one is
reached by URL over Streamable HTTP. One widely used coding host documents
stdio, HTTP (recommended for remote), a deprecated SSE form, and WebSocket, and
it can send a static `Authorization` header — a fact that sets the floor for
decision 3.

**Recommendation: support both, and ship stdio first.** The SDK puts the same
`Server` object behind either transport, so the second one is a transport line,
not a second server. stdio has no auth question, no CORS question and no Origin
question, so it reaches a working end-to-end result first.

Rejected:

- **stdio only.** It cannot be deployed, and Litro's whole point is that it
  deploys anywhere Nitro deploys.
- **HTTP only.** A host cannot launch an HTTP server for the user, and the local
  case is where someone tries this first.

## 5. Decision 2 — where it runs: the CLI speaks stdio, a Nitro route speaks HTTP

- **A CLI command, `litro mcp serve`.** Required for stdio: a host starts a
  process, so there must be a process to start. It loads project source at run
  time with the project's own Vite server, exactly as `litro mcp-app build`
  does. Not jiti — the comment above `createServer` in
  `packages/framework/src/cli/mcp-app.ts` records why: jiti mis-orders the
  decorator and class-property passes and fails on a Lit `@property` field.
- **A Nitro route.** Required for a deployed HTTP server, and it comes for free
  in `litro dev` too, which is what a developer points a browser-based
  inspector at. It uses the build-time agent manifest, as the chat handler does.

**Recommendation: both, in that order.** They are not alternatives — a Nitro
route cannot speak stdio, and a CLI HTTP server would duplicate what Nitro
already deploys.

Costs to plan for:

- The CLI path must keep `stdout` clean. The specification is explicit: the
  server "**MUST NOT** write anything to its `stdout` that is not a valid MCP
  message". Measured: a server that prints one ordinary log line before
  connecting raised `Unexpected token 'l', "[litro] Sca"... is not valid JSON`
  on the client's transport. This SDK's client skipped the line and the session
  still worked, so the damage is a transport error per stray line rather than a
  dead connection — but a host that treats a transport error as fatal drops it,
  and the specification forbids it either way. Every Vite and project log goes
  to `stderr`, which the specification explicitly allows for any logging.
- The Nitro route must **not** reuse the agent handler's gate stack.
  `checkGates` in `packages/litro-agent/src/runtime/handler.ts` requires
  `x-litro-agent: 1` on every POST and requires `Origin` to equal `Host`. No
  MCP host sends that header, and a browser-based host's `Origin` is its own.
  Reusing those gates would answer 403 to every `tools/call`. See decision 3
  for the gates it needs instead.

## 6. Decision 6 — who owns the code, and which SDK

Kept from the earlier draft, because re-checking confirmed it.

**`@beatzball/litro-agent`, behind a new `./mcp-server` subpath.** That package
already holds the tools, the schema function, `UIResult` and the `mcp-app`
packager. The framework CLI adds a thin `litro mcp serve` that loads the subpath
at run time, the same way `mcp-app build` loads the packager, so there is no
dependency cycle and no import of agent internals from the framework.

Rejected: putting it in the framework CLI. That is the cycle `mcp-app.ts` was
written to avoid, and it would make every Litro project carry the SDK.

**The SDK is an optional peer dependency, not a dependency.** Only a project
that serves MCP installs it. The subpath fails with an "install
`@modelcontextprotocol/sdk`" message, distinguishing a resolution failure from
any other load error, as `mcp-app build` already does for the packager.

**Do not hand-write the JSON-RPC layer,** and do not hand-write a 2026-07-28
shim. AGENT-012 is exactly this trap: hundreds of green tests drove a fake host
built from the same misreading of the spec that produced the code. Pin the SDK
version the code was checked against, record it in the docs, and track the new
revision when the SDK ships it (phase 5).

## 7. Decision 3 — auth for the HTTP transport

The specification makes authorization **OPTIONAL**, and says an HTTP-based
implementation **SHOULD** conform to its OAuth 2.1 profile, while an stdio
implementation **SHOULD NOT** and should take credentials from the environment.
Separately, and not optionally, the Streamable HTTP binding requires three
things of any server:

1. Servers **MUST** validate `Origin` on all incoming connections, and **MUST**
   answer 403 when it is present and invalid.
2. When running locally, servers **SHOULD** bind only to localhost.
3. Servers **SHOULD** implement proper authentication for all connections.

**Recommendation — the minimum that is not negligent, in five parts:**

1. **Validate `Origin`.** Present and not allowlisted, answer 403. Absent (a CLI
   host sends none) is allowed.
2. **No wildcard CORS.** The rig sends `Access-Control-Allow-Origin: *`; that is
   a test rig only, and the real route echoes one allowlisted origin or none.
3. **Bind to localhost in dev.** Nitro's dev server already does; the route adds
   nothing here except not undoing it.
4. **Require a shared secret once the route is not local.** A static
   `Authorization: Bearer <token>` read from the environment, compared with a
   constant-time comparison. Hosts can already send a static header, so this
   costs the user one line of configuration and no OAuth flow anywhere. An
   unset token on a non-local deployment is a startup failure, not a default of
   "open".
5. **Keep the per-agent `access(event)` guard.** It already exists on
   `agent.ts`, the chat handler already runs it, and it gives a project a place
   to put its own rule. It runs after the gates above, and its failure becomes a
   401 or 403 the host can read as an auth failure.

stdio gets none of this: there is no Origin, no CORS and no network, and the
specification says credentials come from the environment.

Rejected for v1: **the OAuth 2.1 profile.** Doing it properly means protected
resource metadata (RFC 9728), authorization-server discovery, resource
indicators (RFC 8707), audience-bound token validation and correct
`WWW-Authenticate` challenges. That is a project of its own, it needs an
authorization server that Litro does not have, and no one has asked for it. It
becomes phase 6 if someone does.

**Changed from the earlier draft**, which said "reuse the agent's `access`
guard" and left it there. That is necessary and not sufficient: the guard runs
inside a handler whose gate stack rejects every MCP host, and a guard a project
never writes leaves the route open.

## 8. Decision 4 — which agent's tools: one agent per server

Tools belong to an agent. The scanner walks `agents/*/agent.ts` and then
`tools/*.ts` per agent, and a tool's name is its filename stem, so names are
unique inside one agent and not across a project. The `access` guard is per
agent too.

**Recommendation: one agent per server.** `litro mcp serve --agent <name>`. The
flag may be omitted when the project has exactly one agent. With more than one
and no flag, fail at startup and list the names. A second agent is a second
server entry in the host's configuration, which is how hosts already expect to
hold more than one server.

Rejected: **all agents in one server.** Names would need a prefix, and the
specification notes that clients aggregating tools from several servers
**SHOULD** disambiguate — that is the client's job, not ours. A prefix would
also make an MCP tool name differ from the name the same tool has in the chat
loop, and it would put two different `access` guards behind one endpoint with
one auth decision.

## 9. Decision 5 — how a tool declares its `ui://` app: an explicit field

The facts that decide this:

- A packed app usually has no uri of its own. `uri` is optional on
  `McpAppConfig`; `litro mcp-app build` derives it from the package name and the
  file path, and `appSegmentsFromFile` derives the output filename from the same
  place (AGENT-013). So a tool cannot import an app and read its address.
- The manifest is written by a different command, at a different time, and knows
  nothing about tools.
- The MCP Apps specification says the referenced resource **MUST** exist on the
  server, and that the host fetches it with `resources/read`.

Options:

- **A. An explicit field on `defineTool`:** `app: 'weather-card'`, naming the
  manifest entry, or a literal `ui://...`.
- **B. A filename convention:** `tools/weather-card.ts` gets
  `mcp-apps/weather-card.ts` when one exists.
- **C. The manifest declares which tools it serves.** A packed app names the
  tools it belongs to.

**Recommendation: A.** It is explicit, it is checkable at startup, and several
tools can share one app. The server resolves the name against `manifest.json`
and fails at startup when it does not resolve — which is the only way to honor
"the resource MUST exist" rather than discovering it in a host. The field is
ignored by the chat loop, so adding it changes nothing about chat.

Rejected: **B**, because a rename breaks the link silently and one app cannot
serve two tools; **C**, because it inverts the dependency — an app would have to
know tool names, and `mcp-app build` runs without ever looking at `agents/`.

The same field carries `visibility` when a tool needs one. **Changed from the
earlier draft**, which set a default of `['model', 'app']`: the extension
specification already defaults to exactly that when the field is omitted, so
the server emits `visibility` only when the author sets it. A tool whose app
calls it back needs no annotation at all; a tool that should be hidden from the
model sets `visibility: ['app']`.

## 10. What an existing Litro project has to change

Close to nothing, which was the goal.

| To get | Change needed |
|---|---|
| tools over stdio | nothing in the project. `litro mcp serve` |
| a tool's app linked to it | one field on that tool: `app: '<manifest name>'` |
| the apps served | nothing, if `litro mcp-app build` already ran. Otherwise, run it |
| HTTP | two static handler entries in `nitro.config.ts`, beside the agent ones the project already has, and a token in the environment |
| the SDK | `pnpm add -D @modelcontextprotocol/sdk` — an optional peer, so only these projects pay for it |

No new directory, no new config file, no change to `agents/`, no change to a
tool's `execute`. A project with no agents gets a clear "no agents found"
message.

## 11. How a developer tests it locally

Four tools, in the order a real person reaches for them:

1. **The SDK's in-memory transport**, for unit tests. `InMemoryTransport.createLinkedPair()`
   with the SDK's own `Client` on the other end. This is what caught three of
   the findings in section 14, in minutes, with no browser.
2. **An MCP inspector over HTTP**, for the view. `@mcp-use/inspector` auto-connects
   to a URL, which is why the rig has a `--http` flag. It is the only tool here
   that renders the `ui://` document and exercises the bridge.
3. **`playground/mcp-server/inspector-probe.mjs`**, which drives that inspector
   headlessly and prints the host-to-view wire, the shell-before-result
   timeline, and the view's own tool round trip. A claim the probe no longer
   prints is a regression.
4. **A desktop host over stdio**, by hand: a config entry naming the command,
   then a restart. Not automatable from here, and it is the only way to check
   the stdio path against a host nobody here wrote.

What a run of 2 and 3 produced on 2026-09-24, against the rig, with the tool
delayed by 4 seconds:

```
10381ms  — Waiting for the forecast…              <- server-rendered shell
16184ms  Reykjavik, IS 51°F Overcast (reading #1) <- tool result arrives
```

Also on the wire, from the same run: the host negotiated MCP Apps `2026-01-26`;
it applied its restrictive default CSP with no declared domains, because the
demo apps declare no `csp`; the view's own `tools/call` for `get-weather`
round-tripped to the server and back (`reading #2` to `reading #3`); and the
host sent `ui/notifications/tool-input` and `tool-result` twice each, which is
why the bridge must stay idempotent (AGENT-011).

That is the central claim of the whole design — a real, styled shell in the
first byte — measured again, today, against a host this repo did not write.

## 12. The smallest useful first version

**v1: `litro mcp serve` over stdio, one agent, tools and their apps.**

- `tools/list` from the agent's tools, with `inputSchema` from
  `toolInputJSONSchema`, and `_meta.ui.resourceUri` for a tool that names an app.
- `tools/call`: validate through the tool's Standard Schema, execute, drain a
  generator to its final value, return text in `content` and data in
  `structuredContent`. A `UIResult`'s `html` is never sent (AGENT-002) — the
  `ui://` document is the view.
- `resources/list` and `resources/read` from `manifest.json`, bytes untouched.
- The result hygiene from section 14 that is correctness rather than polish:
  wrap a non-object result, cap the size, time the call out, and map a thrown
  tool to `isError` instead of a protocol error.

Apps are in v1 on purpose. Reading the manifest is a small amount of code, and
without it a Litro MCP server has no reason to exist in preference to any other
framework's. A tools-only cut is possible behind the same command if the owner
wants v1 thinner; it is named in the report as a fork.

### Phases after it

Each ships alone.

1. **v1, as above.** Plus the extraction in section 13.
2. **Streamable HTTP as a Nitro route.** The gates and the token from decision
   3, a generated handler stub as the agent handler has, and the two static
   handler entries documented.
3. **Depth on the result.** Progress notifications from a generator tool,
   `outputSchema`, tool annotations, pagination if a project ever has enough
   tools to need it.
4. **Docs and the demo.** A docs page, the "No MCP server" line removed from the
   MCP Apps limitations, the playground's weather tool moved into
   `playground/agents/demo/tools/`, and the demo tool rewritten on a schema
   library with a converter so the repo's own example shows a real
   `inputSchema`.
5. **Track protocol revision 2026-07-28** when the SDK ships it. A version bump
   and a conformance run, not a rewrite — if it is a rewrite, that is a finding
   worth its own spec.
6. **The OAuth 2.1 profile.** Only if someone asks.

Phases 1 to 3 each carry a `@beatzball/litro-agent` changeset; phase 1 also
carries a `@beatzball/litro` changeset for the CLI command. One file per
package.

## 13. What it reuses, and the one extraction

**Reused unchanged.** `toolInputJSONSchema` for `inputSchema`. The scanner's
`agentEntries` shape. The manifest and descriptor `litro mcp-app build` writes —
the descriptor is already the `resources/*` shape. `ToolContext.event` is
already `H3Event | undefined`, so a tool is valid over stdio where there is no
request; a tool that reads cookies or headers gets `undefined` there, and the
docs must say so.

**Needs exporting inside the package.** `buildAgent` in
`packages/litro-agent/src/runtime/handler.ts` turns one manifest entry into a
tool map plus the `access` guard. It is a private function today. The server
needs the same thing from the same entry shape, so both should call one
function.

**The one extraction.** The pure half of `runToolCall` in
`packages/litro-agent/src/runtime/loop.ts` — look the tool up, validate, execute,
drain a generator, split a `UIResult` into `data` and `html`, reject a nested
`UIResult` — is worth having in one place. Today it is interleaved with session
appends and telemetry spans, and both of those are the chat loop's concern, not
the server's.

This is the riskiest code change in the whole design, because it touches the
chat loop's hot path and the ordering the store depends on (AGENT-001). The rule
for it: extract a pure function that takes the tool and the input and returns
the outcome, leave every `appendEmit` and every span call where it is, and
require the loop's existing ordering tests to pass untouched. If that cannot be
done cleanly, duplicating twenty lines in the server is the better trade, and
the spec says so out loud so that nobody treats the extraction as mandatory.

## 14. What could go wrong

Everything in this section was run, on 2026-09-24, against the SDK's own client.
The measurement is quoted because a guess here is what produced two wrong lines
in the earlier draft.

| Case | What actually happened | What the server must do |
|---|---|---|
| **A tool throws** | escaped as a protocol error, `-32603`, carrying the raw message `upstream is down` | catch it, return `isError: true` with a message written for a reader (AGENT-007), never a stack. The specification reserves protocol errors for malformed requests, and says clients **SHOULD** give tool execution errors to the model so it can self-correct |
| **A result that is not an object** | the SDK **rejected it on the server side**: `-32602 Invalid tools/call result`, for both an array and a string, because its `structuredContent` is typed as a record | wrap a non-object in one named key, or send text only. Revision 2026-07-28 allows any JSON value, so this is an SDK-era constraint, not a permanent one — document which it is |
| **A huge result** | 8 MB of `structuredContent` passed through with no complaint from either end | cap it. There is no cap anywhere else in the stack. Truncate with a marker the model can read, and log the real size |
| **A slow tool** | no timeout anywhere in the path | a per-call timeout, with `isError` on expiry. The specification tells clients to implement timeouts; that does not excuse the server from one |
| **An unknown tool** | the rig's thrown `Error` became `-32603 Internal error` | answer the specification's shape: a protocol error naming the unknown tool, not an internal error |
| **Two tools with the same name** | cannot happen inside one agent — the name is a filename stem — and cannot be reached across agents under decision 4 | nothing, but the startup check must say which agent it served, so a user who expected the other one finds out immediately |
| **A malicious `ui://` document** | nothing here changes the sandbox: the host applies its restrictive default CSP, measured above, and the document declares no external URLs (AGENT-008) | serve the manifest's bytes and only those. Never accept a uri from a request to pick a file. `assertUniqueUris` already runs at pack time; the server resolves only addresses the manifest lists |
| **A tool name outside the MCP guidance** | not measured. Names **SHOULD** be 1-128 characters of letters, digits, `_`, `-` and `.`, and a filename stem can hold anything else | decide it: fail at startup naming the file, or normalize. Open question 4 |
| **A stray byte on stdout** | one log line raised a client transport error; this SDK's client skipped it and carried on | send everything but MCP messages to `stderr`. The specification says **MUST NOT**, whether or not a given client survives it |
| **`$schema` in an `inputSchema`** | passed through to the client untouched; the SDK's tool schema accepts unknown keys | leave it. It is legal, and the specification says the dialect defaults to 2020-12 when it is absent |
| **A vendor with no converter** | `{ type: 'object' }`, as designed | say so in the docs. The host then shows a tool whose arguments it cannot describe |
| **A host on an older protocol** | negotiated `2025-11-25` with this SDK on both ends; a `2026-07-28` request got HTTP 400 and the legacy fallback | pin the SDK version, and re-run the rig on every bump |

## 15. How each phase is verified

The lesson from the MCP Apps work, written into AGENT-012: a suite we wrote
cannot check our own reading of the spec. It passed while a real host rejected
the handshake. So every phase ends outside our own tests.

**Every phase, in CI:** unit tests through the SDK's in-memory client pair —
`tools/list` shape, one converting schema library and one that does not,
`tools/call` with `structuredContent`, each row of section 14, and the tool map
built from a manifest entry. The chat loop's existing ordering tests stay green,
unchanged.

**Phase 1:** the handshake completes over stdio against a host outside this
repo. A tool is called and its data arrives. The `ui://` document is read with
its bytes unchanged and renders. The app calls its tool back and the round trip
works. `stdout` carries nothing but MCP messages — checked by piping it through
a JSON-per-line reader with the project logging turned up.

**Phase 2:** the inspector connects over HTTP and the probe prints the same
timeline as section 11. A request with a wrong `Origin` is refused with 403. A
request with no token, or a wrong one, is refused. A failing `access` guard
reads as an auth failure and not a crash. No response carries a wildcard CORS
header.

**Phase 3:** a generator tool's progress reaches the host. A result that
violates a declared `outputSchema` is caught by our own tests before a host
sees it.

**Phase 4:** the docs build, the MCP Apps limitations list no longer says "No
MCP server", and the moved weather tool still works in both the chat loop and
the server.

**Phase 5:** the rig, re-run, on the new revision, before anything else.

By hand, once per phase: the whole path in a desktop host over stdio, because
that is the transport a person actually starts with and the one no script here
can drive.

## 16. Open questions, named plainly

These could not be settled from reading or from a spike.

1. **When the SDK ships revision 2026-07-28.** Everything in phase 5 waits on
   it, and nothing here depends on the date. If it slips far enough that hosts
   stop accepting the legacy fallback, this decision has to be revisited — that
   would be the one case for writing protocol code by hand, and it would need
   its own spec.
2. **Whether a desktop host renders a Litro `ui://` document over stdio.**
   Verified over HTTP, against a browser-based inspector. Not verified over
   stdio against a desktop host, and there is an upstream report of a valid
   document failing in one desktop host while an inspector shows a correct
   exchange. Phase 1's hand check is where this gets answered.
3. **Whether a real `inputSchema` improves tool calling in practice, and for
   which providers.** The schema converts, and it reaches the host. Whether a
   given model calls the tool more reliably with it than with the argument named
   in the description is unmeasured, and the repo has no benchmark for it.
4. **What to do with a tool whose filename is not a good MCP name.** Fail at
   startup naming the file, or normalize it and print what it became. Failing is
   honest; normalizing is kinder. This needs a ruling, not a spike — see the
   report.
5. **Whether `litro mcp serve` should load the project through Vite or through
   Nitro.** Vite is what `mcp-app build` uses and what this spec assumes. Reusing
   the dev server's Nitro would give a tool the same `event` it has in
   production, at the cost of starting a web server to answer stdio. Not tried.
6. **Whether anyone wants prompts or non-`ui://` resources.** Out of scope here,
   and cheap to add later. Nobody has asked.
