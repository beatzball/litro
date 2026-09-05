---
'@beatzball/litro-agent': minor
---

MCP Apps: `uri` is now optional in `defineMcpApp()`

`buildMcpAppDocument(app, { uri })` takes a fallback address, which is what
lets `litro mcp-app build` derive one from the file path. An app that declares
its own `uri` keeps it — the config wins over the fallback — so no existing app
needs an edit.

URI validation moved from `defineMcpApp()` to `buildMcpAppDocument()`. An
absent `uri` is only an error once it is known that no fallback is coming, and
`defineMcpApp()` cannot know that. A malformed one is still rejected, and now
a path-derived address is held to the same standard as a hand-written one.

Calling `buildMcpAppDocument()` standalone is unchanged: with no file there is
nothing to derive from, so it throws unless the config carries a `uri` or one
is passed in.
