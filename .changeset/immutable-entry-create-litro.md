---
'@beatzball/create-litro': patch
---

New apps no longer cache the client entry forever (issue 253). Every template now marks only the hashed `/_litro/assets/**` chunks immutable, sends `no-cache` for `/_litro/app.js`, and adds `litroEntryPlugin()` to `vite.config.ts` so the page loads the entry as `app.js?v=<content hash>`. The nginx config that `--for-repo` writes follows the same split.
