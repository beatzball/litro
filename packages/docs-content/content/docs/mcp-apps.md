---
title: MCP Apps
description: Package a Litro component as an MCP Apps ui:// resource — one self-contained document that paints a real, styled shell before any data arrives.
date: 2026-09-04
---

# MCP Apps

[MCP Apps](https://modelcontextprotocol.io/seps/1865-mcp-apps-interactive-user-interfaces-for-mcp) (SEP-1865) lets an MCP server hand the host a small web page to render beside a tool result. The host puts that page in a sandboxed iframe under a strict Content Security Policy and talks to it with JSON-RPC over `postMessage`.

`@beatzball/litro-agent/mcp-app` turns a Litro component into that page: **one self-contained HTML5 document**, server-rendered, with no external URL and nothing to download.

That last part is the difference. Every other MCP Apps implementation ships a client-rendered bundle, so the iframe starts empty and paints once the framework arrives. A Litro-packed document is real, styled markup in the first byte the host receives.

## The constraint that shapes everything

**A `ui://` resource is a static, cached, data-free template.**

The specification separates presentation from data on purpose, and hosts may prefetch a template and treat it as immutable across many tool calls. Data reaches the view *afterwards*, by notification:

| Step | Direction | Message |
|---|---|---|
| 1 | view → host | `ui/initialize` |
| 2 | host → view | `hostContext` — theme, locale, dimensions. **Not the tool result.** |
| 3 | host → view | `ui/notifications/tool-input` — the arguments |
| 4 | host → view | `ui/notifications/tool-result` — `structuredContent` |

So the `ui()` helper's per-call rendered html does **not** map onto a `ui://` resource, and the two must not be wired together. What you package is a data-free *shell*, rendered once. The bridge inside the document fills it at step 4.

## Defining an app

Apps live in `mcp-apps/`, one file each, default-exported:

```ts
// mcp-apps/weather-card.ts
import { defineMcpApp } from '@beatzball/litro-agent/mcp-app';
import { html } from 'lit';
import { DemoWeatherCard } from '../components/demo-weather-card.js';

void DemoWeatherCard; // named import + void: bare side-effect imports get tree-shaken

export default defineMcpApp({
  title: 'Weather',

  // Rendered with no data — a host caches this and reuses it every call.
  shell: html`<demo-weather-card city="—" summary="Waiting…"></demo-weather-card>`,

  styles: 'body { margin: 0; padding: 8px; background: transparent; }',

  prefersBorder: true,
});
```

`shell` is a template for whichever renderer `LITRO_ADAPTER` selects — a Lit `TemplateResult`, or an HTML string for FAST. Elena is not supported, because `ui()` does not support it yet.

## The uri comes from the file path

There is no `uri` in that file. The packer derives one: the **package name** is the authority, and the **file path** is the path.

For a project whose `package.json` says `"name": "playground"`:

| File in `mcp-apps/` | Address |
|---|---|
| `weather-card.ts` | `ui://playground/weather-card` |
| `weather/card.ts` | `ui://playground/weather/card` |
| `dashboard/charts/bar.ts` | `ui://playground/dashboard/charts/bar` |

One rule, no special cases: rename the package and every address moves together, which is what an authority is for.

The authority comes from the package rather than the first folder because a `ui://` address needs a host **and** a path. If the first folder were the authority, a file sitting flat in `mcp-apps/` would give host `weather-card` and an *empty* path — a different shape from every nested file, which a host that groups by authority treats differently. A scoped name contributes only its last part: `@beatzball/playground` gives `playground`. The name must be usable as a uri host — lowercase letters, digits, `.`, `_` and `-` — so a package called `@acme/MyApp` cannot supply one. Such a project still packs, but every app in it has to set `uri` itself.

**`index.ts` is not special.** In `pages/`, `blog/index.ts` serves the folder root. Here `weather/index.ts` is `ui://playground/weather/index` — collapsing it would silently merge with a sibling `weather.ts`.

**No dynamic segments.** `[slug]`, `[[opt]]` and `[...all]` mean something in `pages/` and nothing here. A `ui://` resource is a static template the host caches by address, so there is no request to fill a parameter from. The build rejects them rather than shipping a literal `[slug]` in a protocol-visible address.

### Setting one by hand

`uri` is still accepted, and an explicit one always wins over the derived value:

```ts
export default defineMcpApp({
  uri: 'ui://weather/current-conditions',
  shell,
});
```

Use it when the address must not follow the filename, or when you call `buildMcpAppDocument()` yourself — with no file there is nothing to derive from, and it throws unless the config carries a `uri` or you pass one:

```ts
await buildMcpAppDocument(app, { uri: 'ui://weather/card' });
```

## Building

```bash
litro mcp-app build
```

Every `.ts`, `.tsx` and `.mts` file under `mcp-apps/`, at any depth, is packed into `dist/mcp-apps/`. **The output mirrors the source tree**, so the file path, the output path and the address are the same path three times:

| Source | Output | Address |
|---|---|---|
| `mcp-apps/weather-card.ts` | `dist/mcp-apps/weather-card.html` + `.json` | `ui://playground/weather-card` |
| `mcp-apps/weather/card.ts` | `dist/mcp-apps/weather/card.html` + `.json` | `ui://playground/weather/card` |

`manifest.json` lists every app, so a server can load them in one read. Its `html` and `descriptor` entries are paths relative to the output directory, so a nested app is `weather/card.html`.

`--dir` and `--out` override the defaults.

### When the build refuses

It reports **every** problem it can see from the file paths alone, in one list, before loading a module or writing a byte:

- **Two files, one output.** `weather/card.ts` and `weather/card.tsx` both pack to `weather/card.html`. (`weather/card.ts` and `weather-card.ts` do **not** clash — mirroring the tree is what makes that impossible.)
- **A character a uri parser would rewrite**, in a file whose address is being derived. Names may use letters, digits, `.`, `_`, `~` and `-`. A space, `?`, `#`, `%` or a non-ASCII letter is refused, because a parser rewrites it — `big card.ts` would ship the address `ui://playground/big card` while a host caches under `ui://playground/big%20card`, and the descriptor would name a resource the host cannot find. **An app that sets its own `uri` is exempt:** the filename is only a filename then, and `big card.ts` packs happily to `big card.html`. Dynamic segments (`[slug]`, `[[opt]]`, `[...all]`) work the same way — refused for a derived address, fine alongside an explicit one.
- **A `.` or `..` segment**, always. That one no `uri` can excuse: it would write outside the output directory.
- **An app packing to `manifest` at the top level.** `manifest.json` is the index, and it would overwrite the app's own descriptor. Put it in a folder, or rename it.
- **Two apps claiming one address.** Only reachable by writing `uri` by hand. A host caches templates by URI, so a collision does not merge or warn — one app would quietly serve the other's markup. Compared by RFC 3986 equivalence, so `ui://PKG/a` and `ui://pkg/a` are one address, not two.

The output is plain files. Any MCP server can serve them; nothing assumes the serving side is a Litro one.

## What the fill step refuses

`structuredContent` is server JSON, and tool results routinely carry
third-party text. The default fill step therefore **refuses** any key that is a
scripting sink — anything starting with `on`, plus `innerHTML`, `outerHTML`,
`srcdoc`, `src`, `href`, `action`, `formaction`, `style` and friends. Refused
keys are reported to the host with `notifications/message`, not dropped
silently.

Without that, a result of `{ "innerHTML": "<img src=x onerror=…>" }` would
execute: the host's default CSP is `script-src 'self' 'unsafe-inline'`, which
permits inline event handlers, and the injected code would hold
`window.litroMcp.callTool`.

A custom `apply` bypasses the deny list — it is your code, so it is your call.

## Filling the shell

No component runtime is inlined by default, so the rendered Declarative Shadow DOM is static markup. Assigning `.city` on the element sets a property nothing is watching. Write to the DOM instead:

```ts
apply: `function (el, data) {
  var root = el.shadowRoot;
  if (!root) return;
  root.querySelector('.city').textContent = String(data.city);
  root.querySelector('.temp').textContent = data.tempC + '\\u00B0C';
}`,
```

`apply` is browser **source as a string**, never a function. A function would have to be serialized with `Function.prototype.toString()`, which silently drops everything it closed over — and that breaks inside the iframe, where nobody is watching.

Omit it and the default is a guarded property assignment (see [What the fill step refuses](#what-the-fill-step-refuses)), which is right when you *have* inlined a runtime through `runtime:`. That costs the runtime's bytes in every copy of every app, because self-containment means nothing can be shared between documents.

## Calling a tool back

The bridge exposes `window.litroMcp.callTool(name, args)`, which the host forwards to the server as `tools/call`. A view is not limited to the one result it was rendered for:

```ts
runtime: `
  document.addEventListener('click', function (event) {
    if (!event.target.closest('#refresh')) return;
    window.litroMcp.callTool('get-weather', { city: 'Doha' }).then(function (result) {
      window.litroMcpApply(document.getElementById('card'), result.structuredContent);
    });
  });
`,
```

`window.litroMcp.readResource(uri)` is available on the same channel.

## Self-containment is enforced

Packing **fails** if the document would load anything from outside itself — an external `src`, a `<link href>`, a CSS `url()` or `@import`. Inline the CSS and JS, and embed images as `data:` URIs.

This is an error rather than a warning because the host's default CSP is `default-src 'none'`. A blocked request inside that iframe produces no console you will see and no error the host reports. A missing stylesheet just renders as an unstyled card.

Fonts are the exception worth knowing: the default policy has no `font-src`, so `default-src 'none'` blocks a `data:` webfont too. Use the host's own fonts — it offers them through `hostContext.styles`.

An `<a href="https://…">` is **not** flagged. A link is a navigation, not a subresource load, and the default policy does not block it.

## Security notes

- `_meta.ui.csp` declares the origins the view may reach: `connectDomains`, `resourceDomains`, `frameDomains`, `baseUriDomains`. **Omit it entirely when the view needs no network** — the spec has the sandbox "apply restrictive defaults if no CSP metadata is provided", which is tighter than handing it an empty object to build a policy from.
- The bridge accepts messages only from the host frame and only JSON-RPC 2.0.
- The default CSP allows inline script, but a host **may** restrict further. A host that does will break every inline-script MCP App, not only Litro's.

## Limitations

- **Elena is not supported** — `ui()` does not support it yet. Its light-DOM output would give the smallest document of the three.
- **No MCP server.** This produces the artifact a server publishes; serving `resources/list` and `tools/list` is a separate piece of work.
- `sampling/createMessage`, host-registered tools, and `_meta.ui.domain` are not implemented.

## Worked examples

`playground/mcp-apps/` carries two: a read-only card, and one with a button that calls a tool back. Build them with `pnpm --filter playground mcp-app`.
