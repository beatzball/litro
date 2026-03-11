---
"@beatzball/litro": patch
---

The content plugin now generates `litro-content.js` stubs using a path relative to the stub file rather than an absolute path. This prevents machine-specific directory paths from being baked into generated files.
