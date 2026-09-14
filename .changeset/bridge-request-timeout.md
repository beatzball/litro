---
'@beatzball/litro-agent': patch
---

MCP App bridge: `window.litroMcp.callTool()` and `readResource()` now reject after 30 seconds when the host does not answer, instead of staying pending forever. The error is a `TimeoutError` whose message names the method, and a late answer is ignored. Pass `{ timeoutMs }` as the last argument to change it per call; `0` waits forever. `callTool(name, args)` works as before. The `ui/initialize` handshake has no timeout.
