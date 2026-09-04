---
'@beatzball/litro-agent': minor
---

Add `@beatzball/litro-agent/mcp-app` — packages a Litro component as an MCP Apps `ui://` resource.

`defineMcpApp()` declares the app; `buildMcpAppDocument()` server-renders the shell and returns one self-contained HTML5 document plus the `resources/*` descriptor (`text/html;profile=mcp-app`, nested `_meta.ui`).

A `ui://` resource is a static, cached, data-free template — hosts prefetch it and reuse it across tool calls — so the shell is rendered with no data, and the inlined bridge fills it from `structuredContent` when `ui/notifications/tool-result` arrives after the `ui/initialize` handshake. The bridge also answers `ping` and exposes `window.litroMcp.callTool()`.

Packing fails if the document would load anything from outside itself, because the host's default CSP is `default-src 'none'` and such a fetch fails silently inside the iframe.

Lit only for now; FAST follows.
