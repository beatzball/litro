# playground MCP server — a host validation rig

**This is a test rig, not the production MCP server.** It is not published, not
wired into any recipe, and not the deferred Litro MCP server. Its only job is to
put the packed `ui://` documents in front of a **real** MCP host and record what
that host actually does.

It exists because everything else that exercises the packager uses a fake host
we wrote ourselves, from the same reading of the spec that produced the packager.
All of it could be wrong in the same direction and stay green. It was, once —
see [Traps a real host exposed](#traps-a-real-host-exposed).

It does not re-implement the packer. It reads `dist/mcp-apps/manifest.json` and
serves the bytes untouched, so a host renders exactly what `litro mcp-app build`
produced.

## Run

```bash
pnpm --filter playground mcp-app             # pack first; the server needs the manifest
node playground/mcp-server/index.ts          # stdio (default) — for Claude Desktop
node playground/mcp-server/index.ts --http   # http — for MCP Inspector
```

Node 24 strips the TypeScript types, so there is no build step.

**stdio is the default** and is the transport a host launches on its own. The
`--http` flag exists only because MCP Inspector V2 auto-connects to a URL and
cannot spawn a stdio command. Both serve the same handlers from the same
`buildServer()`, so neither host is shown a different server from the other.

| Env var | Effect |
| --- | --- |
| `LITRO_MCP_APPS_DIR` | Where to read the packed apps from. Default `playground/dist/mcp-apps`. |
| `LITRO_MCP_TOOL_DELAY_MS` | Delays every `tools/call`. Needed to see the shell hold the screen before the result — with an instant tool the two are indistinguishable. |
| `PORT` | HTTP port, `--http` only. Default `3111`. |

## Three apps

| Tool | View | What it shows |
| --- | --- | --- |
| `get-weather` | `weather-card` | A read-only card. The shell paints, then the result fills it. |
| `weather-refresh-demo` | `weather-refresh` | One button that calls a tool back from inside the iframe. |
| `weather-explorer` | `weather-explorer` | A form, Refresh, Reset and a °F/°C toggle — state the VIEW owns, that the model never sees. |
| `weather-live-demo` | `weather-live` | The same card as a LIVE web component: the element defines itself, so property assignment re-renders it. |

### Inert vs live, which is the thing to look at

`weather-card` and `weather-live` ship the SAME Lit component, server-rendered
to the same declarative shadow DOM. Both paint before any script runs. They
differ in one way:

| | `weather-card` | `weather-live` |
| --- | --- | --- |
| element defined in the iframe | no | yes |
| `Object.assign(el, data)` | does nothing | re-renders |
| fill step | a custom `apply` writing into the shadow root by hand | the default |
| size | 11.5 KB | 12.5 KB |

SSR sends an element's rendered OUTPUT, never its class. So the default card is
inert markup: assigning `.city` sets a property nothing is watching, which is
why it needs a hand-written `apply`. `weather-live` inlines a `runtime` that
calls `customElements.define()`, which upgrades the tag SSR already painted —
first paint is still server-rendered, and from then on the component is real.

The kilobyte between them is a hand-written definition. Inlining Lit and its
hydration support instead would be tens of kilobytes, in every document that
wanted one, because self-containment shares nothing between documents. That
trade is the reason the other demos do not do it.

The explorer is the one that shows the data/model split clearly: typing a city,
switching units and refreshing all happen between the view and the server. The
model sees only the first result.

Its default unit is decided ONCE, from the first reading that carries a country:
US gets Fahrenheit, everywhere else Celsius. After that the user owns it — a
later lookup in another country must not flip the unit under someone who has
just chosen one.

## What this rig bounds, and what it does not

Two limits exist because a demo is the thing people copy, and both were found
by review rather than by design.

**The caches are bounded.** `geoCache` and `wxCache` are keyed by text the
CALLER supplies, and the explorer hands that key to anyone who can type. Each
holds at most 200 entries, oldest evicted first, and each sweeps expired
entries rather than merely ignoring them on read — a TTL checked only at read
time frees nothing. A geocode miss expires after an hour instead of being
remembered for the life of the process.

**What reaches the model is capped.** A tool result is read by the model, so
whatever is typed inside the iframe travels to the server and comes back in
`content[0].text`. That means a person can put arbitrary text into a model's
context through a weather card. The city is capped at 80 characters — in the
input, in every tool schema, and again in the server before anything echoes it,
because a schema is a request to the host and this rig must not depend on one
being enforced. Truncation is marked with an ellipsis rather than hidden.

**Capping is not safety.** It bounds the text; it does not make it trustworthy.
The real defence is that a model must not treat tool output as instructions,
and that belongs to whoever writes the agent, not to this server.

## The weather is real

`get-weather` calls [Open-Meteo](https://open-meteo.com) — no API key, no
account. Two requests: a city name to coordinates, then coordinates to a
current reading. Both are cached for five minutes, because the Refresh button
exists to prove a round trip happened, not to hammer a free public API.

**The SERVER fetches, not the view**, and that is the part worth noticing: the
packed document still declares no CSP and still loads nothing from the network.
Data reaches it as `structuredContent` over `postMessage`. Adding a live
upstream changed nothing about the sandbox.

Offline, or for a place the geocoder does not know, it returns a placeholder
labelled as one — `live: false` in `structuredContent`, and "NOT a real
reading." in the text the model sees. A demo that quietly invents weather is
worse than one that says it could not reach the network.

## What this rig proved

Against MCP Inspector V2 (`@mcp-use/inspector@20.3.7`), with
`LITRO_MCP_TOOL_DELAY_MS=4000`:

```
10593ms   — 0°C Waiting for the forecast…          <- server-rendered shell
14380ms   Reykjavik 3°C Windy, snow showers        <- tool result arrives
```

**That is the central claim of the whole design, measured against a host we did
not write.** A server-rendered shell is real, styled markup in the first byte,
where a client-rendered bundle would show an empty iframe for those 3.8 seconds.
Nothing else in this repo proves it.

Also confirmed on the wire: the document renders under the host's **restrictive
default CSP** with zero violations (the demo apps declare no `csp` at all, so
this is the strict path, not a declared-domains one); `_meta.ui` is read in the
nested shape the packer emits; `structuredContent` arrives as
`{city, tempC, summary}` exactly as the bridge's fill step expects; and the
`weather-refresh` button's own `tools/call` round-trips back to this server and
updates the view.

## Reproduce it

```bash
node playground/mcp-server/index.ts --http &
npx @mcp-use/inspector --url http://localhost:3111/mcp --no-open
node playground/mcp-server/inspector-probe.mjs
```

The probe drives the Inspector headlessly and prints the host↔view wire, the
shell-before-result timeline, and the refresh round-trip. Every claim above came
out of it, so a claim here that the probe no longer prints is a regression.

## Traps a real host exposed

Three protocol defects in the view bridge were found this way and fixed in
[PR 130](https://github.com/beatzball/litro/pull/130); the trail is in that PR's
[review record](https://github.com/beatzball/litro/pull/130#issuecomment-5550086270).
The short version: the host rejected our `ui/initialize` with `-32602` for three
missing params, and the demo only rendered because Inspector injects a
compatibility shim that completed the handshake for us. Fifteen green unit tests
had no idea.

Two host behaviours are not bugs but will be rediscovered the hard way:

- **`_meta.ui` is read from the `resources/read` contents, not from the
  `resources/list` entry.** Omitting it from `list` changed nothing. Serving it
  in both places is harmless; serving it *only* on `list` would not work.
- **The host sends `ui/notifications/tool-input` 2–3 times, and `tool-result`
  more than once, per call.** The bridge is idempotent so nothing breaks. Do not
  "fix" it into assuming exactly-once delivery.

## Claude Desktop

Not automatable from here — it needs a config edit and an app restart. Add to
`~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "litro-playground": {
      "command": "node",
      "args": ["/absolute/path/to/litro/playground/mcp-server/index.ts"]
    }
  }
}
```

Restart Claude Desktop, then ask it for the weather in Tokyo.

Note: `modelcontextprotocol/ext-apps` issue 671 reports a valid self-contained
document failing to render in Claude Desktop while Inspector shows a correct
exchange. Test in Inspector first; a difference between the two is likely not
ours.

## Tool visibility

`get-weather` is published with `_meta.ui.visibility: ["model", "app"]`.

`"app"` is required, not a default worth leaning on: the `weather-refresh`
document's button calls this same tool back through `tools/call`, and the spec
says a host MUST reject a call from an app for a tool whose visibility omits
`"app"`. `"model"` is kept because the tool genuinely answers a question a user
would ask in words — hiding it would buy nothing and would make the demo
undrivable from a chat prompt, which is how a real host gets used.
