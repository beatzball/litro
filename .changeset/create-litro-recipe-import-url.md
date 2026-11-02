---
'@beatzball/create-litro': patch
---

Fix "Error: no recipes available." when the scaffolder runs on Windows, or from any folder whose path holds a `#` or `%`.

Each recipe config was loaded with `import()` on an absolute path. Node rejects that on Windows, where `C:\` reads as a URL scheme, and misreads it on every OS when the path holds URL syntax. A silent `catch` then dropped every recipe. The configs now load through a `file://` URL. A recipe that still fails to load is named on stderr with the reason, and `--recipe <name>` reports the load error instead of "not found".
