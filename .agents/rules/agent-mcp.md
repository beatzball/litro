# Agent layer and MCP Apps rules

`@beatzball/litro-agent` rules. Several are product decisions that a refactor
could reverse without any test failing.

### AGENT-001 — Every session event is appended before it is sent

Every `SessionEvent` goes through `appendEmit()`: store the event, then emit it.
Do not write to the wire first.

**Why:** the HTTP stream is a tail of the stored log. Resuming after a crash,
reconnecting with `?from=`, and turns that survive a client disconnect all depend
on this order.

**Check:** `appendEmit` in `packages/litro-agent/src/runtime/loop.ts`. Any
direct emit of a session event outside it is the bug.

### AGENT-002 — The model and the traces never see a `UIResult`'s `html`

Only a `UIResult`'s `data` is fed back to the model. A `UIResult` nested inside
another return value is rejected with a tool error. Telemetry never records
`html`, and `captureContent` defaults to false.

**Why:** tools return rendered components so that the surface gets markup while
the model reasons over data. Sending the markup to the model or to a trace
backend breaks that design and leaks content.

**Check:** `finalizeToolResult` in `packages/litro-agent/src/runtime/loop.ts`
and `sanitizeForCapture` in `packages/litro-agent/src/telemetry/runtime.ts`.
Semantic-convention attribute names stay in that telemetry file, not in
`loop.ts`.

### AGENT-003 — A tool's UI component must be registered on the server

A tool file imports its component by name and references it with
`void Component;`.

**Why:** a bare side-effect import is tree-shaken from the server bundle
(BUILD-001, BUILD-002). The element is never defined on the server, so `ui()`
has nothing to render.

**Check:** `playground/agents/demo/tools/get-weather.ts`.

### AGENT-004 — Check the lease before each drain, and never abort on a lost lease

In the GET poll tail, read `isLeased` before each drain, never after it. When a
turn's lease is lost, stop the heartbeat and let the turn finish.

**Why:** reading the lease after the drain loses the tail when a remote turn ends
between "replay done" and "still leased?". Aborting a turn on lease loss would
break append-before-wire (AGENT-001).

**Check:** the DO-NOT-MOVE comment and `startLeaseHeartbeat` in
`packages/litro-agent/src/runtime/handler.ts`.

### AGENT-005 — The app brings OpenTelemetry; the package does not depend on it

`otelTracer(api)` takes the app's `@opentelemetry/api` namespace as an argument.
Do not add `@opentelemetry/api` to `packages/litro-agent/package.json`, not even
as an optional peer.

**Why:** the tracer must use the same API singleton the app registered its SDK
with. A second copy drops every span without an error.

**Check:** `grep opentelemetry packages/litro-agent/package.json` prints nothing.
See `packages/litro-agent/src/telemetry/otel.ts`.

### AGENT-006 — An alternative store matches the default store's setup, not only its interface

A second implementation behind a subpath (such as the SQLite session store)
does the same first-use setup as the default: create the parent directory, and
skip that for in-memory targets. Test the case where the directory does not
exist.

**Why:** the SQLite store passed every interface test, but SQLite does not create
parent directories. At the documented path inside a missing `.litro/`, it threw
while the agent config loaded, and every route returned 500. Tests that use a
temp directory always have the directory, so they cannot see this.

**Check:** `mkdirSync` in `packages/litro-agent/src/sessions/sqlite.ts`, matching
`packages/litro-agent/src/sessions/file.ts`. Run the documented wiring once in a
real dev server before merging.

### AGENT-007 — Error messages reach the client in production

Throw `AgentError` with a message written for users. Only the stack is removed in
production; `name` and `message` are always sent.

**Why:** a raw internal error message would be shown to every client.

**Check:** `errorPayload` in `packages/litro-agent/src/errors.ts`.

### AGENT-008 — A `ui://` resource is a static, data-free template

Build a data-free shell at build time. Data reaches the view later, through
`ui/notifications/tool-result`. Do not connect `ui()`'s per-call SSR output to a
`ui://` resource. The document has no external URLs.

**Why:** hosts prefetch a `ui://` resource and cache it across many tool calls.
Per-call data baked into it would be stale or wrong. The spec's default CSP
blocks every external load.

**Check:** the header comment in `packages/litro-agent/src/mcp-app/index.ts`.
`packages/litro-agent/src/mcp-app/external-urls.ts` flags external loads but not
`<a href>`, because a link is a navigation, not a load.

### AGENT-009 — `apply` is browser source as a string

The `apply` option of `defineMcpApp` is a string of browser code, never a
function.

**Why:** a function would be serialized with `Function.prototype.toString()`,
which drops its closure. The failure shows only inside the host's iframe.

**Check:** `defineMcpApp` in `packages/litro-agent/src/mcp-app/index.ts` throws
on a non-string.

### AGENT-010 — Never `Object.assign` server JSON onto an element

The bridge fills the view from `structuredContent` through its deny list. It
never copies server JSON straight onto a DOM element.

**Why:** a key such as `innerHTML` parses HTML, and the host's default CSP allows
inline script, so injected event handlers run with access to `callTool`. The
deny list covers `on*` handlers and the properties that load or parse content
(`innerHTML`, `outerHTML`, `srcdoc`, `src`, `href`, `action`, `formaction`,
`style`).

**Check:** the deny list in `packages/litro-agent/src/mcp-app/bridge.ts`. Add a
new risky property there, not at a call site.

### AGENT-011 — Bridge protocol details a strict host enforces

Keep these in `packages/litro-agent/src/mcp-app/bridge.ts`:

1. `ui/initialize` sends `protocolVersion`, `appInfo`, `clientInfo` and
   `appCapabilities` (with `availableDisplayModes`).
2. A `ping` without an `id` is a notification. Do not answer it.
3. `ui/resource-teardown` is a request. Answer it; the host waits.
4. Send `ui/notifications/size-changed`.

**Why:** a host rejects a short `ui/initialize` with `-32602`. The handshake
fails, `initialized` never fires, and the view hangs on its empty shell. A lax
host hides this, so self-written tests passed while a strict host failed.

**Check:** `packages/litro-agent/src/mcp-app/bridge.protocol.test.ts`, then
AGENT-012.

### AGENT-012 — Test protocol changes against a host this repo did not write

Before you trust a change to the bridge or the packaged document, run it against
the real host rig in `playground/mcp-server/` (`inspector-probe.mjs`). Pin the
spec version the code uses, and quote the spec file when a test encodes it.

**Why:** hundreds of unit and browser tests passed against a handshake a real
host rejected. Every test drove a fake host written from the same misreading of
the spec. A suite you wrote is a regression net, not a conformance check.

**Check:** the rig's `README.md` in `playground/mcp-server/`. Use it; do not
build another fake host.

### AGENT-013 — The `ui://` address and the output file come from one function

`litro mcp-app build` derives both the `ui://` uri and the output filename from
`appSegmentsFromFile`. Change them together. An explicit `uri` in the app config
wins over the derived one. Files with dynamic segments are rejected.

**Why:** a `ui://` address is visible to the protocol and cached by hosts, so its
shape is an API. If the uri and the file name are derived separately, the
manifest and the address drift apart.

**Check:** `appSegmentsFromFile` in `packages/framework/src/cli/mcp-app.ts`.
