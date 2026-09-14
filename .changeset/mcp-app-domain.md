---
'@beatzball/litro-agent': minor
---

`defineMcpApp` accepts `domain` and writes it to `_meta.ui.domain` in the resource descriptor. It asks the host for a dedicated sandbox origin — for an OAuth callback, a CORS policy, or an API key allowlist. The MCP Apps spec leaves the format to each host, so the value is carried through unchanged; a value that is not a non-empty string fails at `defineMcpApp` with a clear message.
