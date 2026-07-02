---
"@beatzball/litro": minor
---

Upgrade Vite from 5 to 8 (Rolldown + Oxc bundler). Builds are substantially faster and the toolchain moves onto the Oxc transform pipeline. The Lit decorator transpile (`experimentalDecorators` / `useDefineForClassFields` from `tsconfig.json`) is honored by Oxc exactly as it was by esbuild, so client bundles are unchanged. No Litro config changes were required — `build.rollupOptions` is accepted via Vite's compatibility layer.

**Breaking for consumers:** Vite 8 requires Node `^20.19.0 || >=22.12.0` (Node 18 is no longer supported). Existing projects should bump their own `vite` dependency to `^8` and ensure they are on a supported Node version. See the Vite 8 upgrade note for details.
