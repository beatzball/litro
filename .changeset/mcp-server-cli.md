---
'@beatzball/litro': minor
---

Add `litro mcp serve`: serves one agent's tools, and the `ui://` documents
`litro mcp-app build` packed, to an MCP host over stdio.

The command is thin. It compiles the project's source with the project's own
Vite config — not jiti, which mis-orders the decorator passes — loads
`@beatzball/litro-agent/mcp-server` from the project's dependencies at run time,
and keeps `stdout` for JSON-RPC and nothing else: the real stream is handed to
the MCP transport and `process.stdout.write` is pointed at stderr before Vite
starts, so a project's own `console.log` cannot desync the framing.

Flags: `--agent <name>` when a project has more than one agent, `--apps-dir
<dir>` for a build output other than `dist/mcp-apps`, `--timeout <ms>` and
`--max-result-bytes <n>`.

Also fixes `litro mcp-app build`'s "not installed" detection, which missed how
Vite 8 words a missing dependency ("Failed to load url ... Does the file
exist?") and so told the reader "could not load", with a Vite stack, instead of
naming the package to install.
