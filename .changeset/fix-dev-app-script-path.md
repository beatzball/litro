---
'@beatzball/litro': patch
---

Fix dev mode serving stale client bundles by referencing `/_litro/app.ts` instead of the built `/_litro/app.js` when `litro dev` is running.
