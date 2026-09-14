---
'@beatzball/litro': patch
---

`litro mcp-app build` no longer leaves partial output when it fails. It wrote each app's `.html` and `.json` as soon as that app packed, so a build that failed on a later app — one with no default export, or two apps claiming one `uri` — exited 1 with the earlier apps on disk and no `manifest.json`. Every app is now packed and checked first, and nothing is written unless all of them pass. A failed build leaves the output directory exactly as it was.
