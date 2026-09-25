---
'@beatzball/litro-agent': minor
---

Add an MCP server behind a new `./mcp-server` subpath: one agent's tools, and
the `ui://` documents `litro mcp-app build` packed, in front of an MCP host over
stdio.

- `tools/list` from the agent's tools, with `inputSchema` from the tool's
  Standard Schema and `_meta.ui.resourceUri` for a tool that names an app.
- `tools/call` validates through the tool's schema, executes, drains a generator
  to its final value, and answers with text in `content` and data in
  `structuredContent`. A `UIResult`'s `html` is never sent; the `ui://` document
  is the view.
- `resources/list` and `resources/read` from `manifest.json`, bytes untouched. A
  uri from a request is looked up in that manifest or refused, and never becomes
  a file path.
- Result hygiene: a non-object result is wrapped under one key (the SDK rejects a
  non-record `structuredContent`), a result over 1 MiB is truncated with a marker
  and the real size logged, a call has a 30s timeout, and a tool that throws
  answers `isError: true` rather than a protocol error. An unknown tool and
  invalid arguments are protocol errors, as the specification groups them.
- New optional `app` field on `defineTool`, naming a `manifest.json` entry or a
  literal `ui://` address, with optional `visibility`. An app the manifest does
  not list is a startup failure. The chat loop ignores the field.
- `@modelcontextprotocol/sdk` is an **optional peer dependency**. A project that
  does not serve MCP is unaffected; one that does gets an actionable message
  naming the package when it is missing.

The pure half of a tool call — look up, validate, execute, drain, split a
`UIResult` — moves to one function that the chat loop and the server both call.
Every store append, its order, and every span stay in the loop.

Streamable HTTP, auth, progress notifications and `outputSchema` are later
phases.
