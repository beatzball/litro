---
"@beatzball/litro": minor
"@beatzball/litro-router": patch
---

Phase 2: docs-ssr fullstack SSR site, LitroLink styles, router scroll-to-top, content plugin production fix

- Scaffold `docs-ssr/` workspace — fullstack SSR replica of the docs site using shared `docs-content` and `docs-ui` packages
- LitroLink: add `static override styles` with text-only inheritance (fixes double anchor point on CTA buttons)
- LitroRouter: scroll to top after SPA page swap (unless hash fragment present)
- Content plugin: embed absolute path fallback for production builds where `import.meta.url` resolves incorrectly after Rollup bundling
- CLI: pass `PORT` env var alongside `--port` flag for reliable dev server port binding
- Shared components: `?hidden` attribute pattern replaces structural ternaries for SSR hydration safety; `spaNav` prop enables SPA navigation in SSR contexts
- Blog pages: strip duplicate h1 from markdown body (title already rendered from frontmatter)
- Content negotiation: `Accept: application/json` returns pageData as JSON for client-side SPA data fetching
- SSR preset: `ssrPreset()` required in nitro.config.ts for correct production output directory
