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
