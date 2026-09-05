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

There is no `uri` in that file. The packer derives one from where the file sits, the way `pages/blog/index.ts` serves `/blog`:

| File in `mcp-apps/` | Address |
|---|---|
| `weather/card.ts` | `ui://weather/card` |
| `dashboard/charts/bar.ts` | `ui://dashboard/charts/bar` |
| `weather-card.ts` | `ui://<package name>/weather-card` |

A `ui://` address needs a host and a path, so a single segment is not enough on its own. For a file sitting flat in `mcp-apps/`, the **package name** fills the first segment — `weather-card.ts` in a package named `playground` becomes `ui://playground/weather-card`. Give the file a folder instead if you would rather see the whole address in the file tree.

**`index.ts` is not special.** In `pages/`, `blog/index.ts` serves the folder root. Here `weather/index.ts` is `ui://weather/index` — collapsing it would leave `ui://weather`, a host with no path, which is the one shape this convention avoids.

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

For each `mcp-apps/*.ts` this writes, into `dist/mcp-apps/`:

| File | Contents |
|---|---|
| `<name>.html` | the self-contained document |
| `<name>.json` | the resource descriptor — `text/html;profile=mcp-app` plus `_meta.ui` |
| `manifest.json` | every app, so a server can load them in one read |

`--dir` and `--out` override the defaults. The build **fails** if two apps declare the same `ui://` address: a host caches templates by URI, so a collision does not merge or warn — one app would quietly serve the other's markup.

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
