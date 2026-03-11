---
"@beatzball/litro": patch
---

`litro dev` and `litro preview` now default to port 3000 and auto-increment when that port is taken, rather than crashing with an opaque `EADDRINUSE` error. A connect-based TCP probe detects all listeners including Docker Desktop's port-forwarding on macOS. Passing `--port`/`-p` explicitly still errors out if that port is already in use.
