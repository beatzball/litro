---
"@beatzball/litro": minor
---

Add shared content + UI packages and dev-mode content live reload

- Extract `docs/content/` into new private workspace `@beatzball/litro-docs-content` so both the SSG docs site and the upcoming SSR docs site can share the same Markdown source
- Extract `docs/src/` into new private workspace `@beatzball/litro-docs-ui` (Lit components, SEO utilities, highlight helpers) for the same reason
- Add `devMode` option to `buildShell` / `ShellOptions`: when true, injects a polling script that fetches `/_litro/_litro-version.json` every 2.5 s and reloads the browser when the version changes
- Vite content plugin (`litroContentPlugin`) now writes `dist/client/_litro-version.json` on every Markdown file change and sends a `litro:content-update` WebSocket event, enabling live browser reload on content edits in dev mode
- Fix: add `"sideEffects": ["./src/components/*.ts"]` to `@beatzball/litro-docs-ui` so Rollup does not tree-shake side-effect-only custom element registration imports
