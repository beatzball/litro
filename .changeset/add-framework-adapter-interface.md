---
"@beatzball/litro": minor
---

Add framework adapter interface for pluggable web component framework support (Lit, FAST, Elena). Extract Lit-specific SSR and hydration code behind FrameworkAdapter contract. DSD polyfill is now conditional via shell options. Default adapter is 'lit' — zero breaking changes for existing projects.
