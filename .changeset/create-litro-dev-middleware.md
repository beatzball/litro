---
'@beatzball/create-litro': patch
---

Recipe templates' `server/middleware/vite-dev.ts` now builds its dev Vite server from `litroViteDevConfig()` (and pre-warms the client entry via `warmupLitroViteServer()`), so scaffolded apps get the live-source dev entry fix for issue 97 instead of serving a stale pre-built bundle.
