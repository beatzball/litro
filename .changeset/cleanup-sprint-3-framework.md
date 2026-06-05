---
"@beatzball/litro": patch
---

npm metadata + dependency cleanup: rewrite the package description and keywords to reflect that all three adapters (Lit / FAST / Elena) are first-class, and drop the unused `execa` runtime dependency (the CLI uses `child_process.spawn` directly per `cli/index.ts:18`).
