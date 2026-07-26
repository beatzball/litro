---
'@beatzball/litro': patch
---

`litro dev` now serves the live client entry (`/app.ts`) through Vite instead of a stale pre-built `dist/client/app.js` — source edits reflect in the browser without a rebuild (issue 97). The new `litroViteDevConfig()`/`warmupLitroViteServer()` helpers (`@beatzball/litro/runtime/vite-dev.js`) centralise the dev Vite config: dev `base: '/'` so module URLs stay clear of the `/_litro/` static mount, dependency pre-optimization and page warmup to prevent mid-load full reloads, and watcher ignores for `.nitro/`/`.litro/` so Nitro regenerating its types no longer forces a full browser reload. The actions Vite plugin now also stubs `@beatzball/litro/actions/server` by resolved path, which live-source dev requires to keep `node:crypto` imports out of the browser graph.

Backwards compatible for existing apps: the live entry only activates when the app's `server/middleware/vite-dev.ts` builds its Vite server from `litroViteDevConfig()` (which sets `LITRO_DEV_LIVE_ENTRY`). Apps still running a previously-scaffolded middleware keep their prior dev behavior unchanged after upgrading; update the middleware to the current template to opt in to the live entry.
