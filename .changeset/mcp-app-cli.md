---
'@beatzball/litro': minor
---

Add `litro mcp-app build` — packs every `mcp-apps/*.ts` into a self-contained MCP Apps `ui://` document.

Each app writes `dist/mcp-apps/<name>.html` and `<name>.json` (the `resources/*` descriptor), plus a `manifest.json` listing them all. The output is plain files, so any MCP server can serve them; nothing assumes the serving side is a Litro one. `--dir` and `--out` override the defaults.

The build fails if two apps declare the same `ui://` address: a host caches templates by URI, so a collision does not merge or warn — one app quietly serves the other's markup.

Requires `@beatzball/litro-agent`, which is loaded from the project at run time rather than imported (it depends on this package, so a static import would be a cycle) — a project without it gets an instruction instead of a resolver error.
