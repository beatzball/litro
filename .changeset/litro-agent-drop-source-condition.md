---
'@beatzball/litro-agent': patch
---

Remove the `source` export condition so consumers always resolve the compiled
output. Publishing `source` pointed installed apps at TypeScript that Vite does
not transpile inside `node_modules`, which produced an unparseable client
bundle on Vite 8. No API change.
