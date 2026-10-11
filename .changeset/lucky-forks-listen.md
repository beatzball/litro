---
'@beatzball/litro-agent': patch
---

Raise the `@modelcontextprotocol/sdk` optional peer dependency range from
`^1.30.0` to `^1.31.0`, so an app that opts into the MCP server starts from a
release patched against GHSA-6qxp-vccf-f47h (High, CVSS 7.5), where an OAuth
client could send credentials to an authorization server chosen by the MCP
server.
