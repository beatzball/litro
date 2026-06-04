---
"@beatzball/create-litro": patch
---

Fix port mismatch and stale references in scaffolder output and recipe templates: post-scaffold success message, recipe playwright configs, and recipe content all said `localhost:3030` while the default Litro dev server listens on `3000`.
