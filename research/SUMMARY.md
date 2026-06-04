# Research Findings Summary

These are archived summaries of the four research investigations (R-1 through R-4)
conducted during Litro's initial build phase (February 2026). Each research agent
explored a specific area of the architecture to inform implementation decisions.
The key decisions from these findings are also captured in CLAUDE.md under
"Research Findings -- Key Decisions."

Full findings for all four agents are preserved in git history.

---

## R-1: Nuxt Internals -- Page Scanning, Route Generation, Vite/Nitro Coordination

Researched how Nuxt implements its pages layer, route generation, and Vite/Nitro integration.

- File scanning uses `fast-glob` with `pathe` for cross-platform path normalization; bracket segments map to route params (`[slug]` -> `:slug`, `[...all]` -> `:all(.*)*`, `[[param]]` -> `:param?`)
- Routes are sorted static-before-dynamic-before-catch-all via a custom comparator
- Vite dev middleware is mounted into Nitro's middleware stack via `fromNodeMiddleware()` -- single port, no proxy
- Nitro is configured programmatically: virtual module aliases, `publicAssets` entries, and prerender routes are injected before `createNitro()` is called
- Production client assets use `publicAssets` (not `publicDir`) because `publicDir` is ignored by edge adapters

Full findings archived in git history (R-1-findings.md, ~1,400 lines).

---

## R-2: Lit SSR -- @lit-labs/ssr, Declarative Shadow DOM, Hydration, Streaming

Researched the Lit SSR pipeline: server rendering, DSD output, client hydration, and streaming.

- `@lit-labs/ssr` renders Lit components to DSD HTML via an async generator; `RenderResultReadable` wraps it as a Node.js `Readable` for streaming with Nitro's `sendStream()`
- `@lit-labs/ssr-client/lit-element-hydrate-support.js` must load as the first `<script type="module">` before any Lit code -- it patches `LitElement.prototype.createRenderRoot()`
- A MutationObserver-based DSD polyfill is needed for ~4% of browsers (pre-Firefox 119, pre-Safari 16.4)
- Components accessing `window`/`document` at module eval time crash the server; guard with `typeof window !== 'undefined'` or move the access into lifecycle hooks (`connectedCallback`, `firstUpdated`). VM sandbox mode is not recommended.
- Edge adapters (Cloudflare, Vercel Edge) require `externals.inline: ['@lit-labs/ssr']` in Nitro config; `RenderResultReadable` is Node-only so edge targets need manual `ReadableStream` conversion

Full findings archived in git history (R-2-findings.md, ~1,500 lines).

---

## R-3: Client Routing -- @vaadin/router Evaluation

Researched `@vaadin/router` for client-side SPA navigation with web components. This router was later replaced by the built-in `LitroRouter` (URLPattern API).

- `@vaadin/router` renders custom elements into an outlet DOM node; mount in `firstUpdated()` so the outlet exists in the DOM
- Lifecycle hooks (`onBeforeEnter`, `onAfterEnter`, `onBeforeLeave`, `onAfterLeave`) are methods on the custom element class
- The outlet element must be kept outside Lit's render root to avoid reconciliation conflicts
- Lazy loading supported via `action` callback with dynamic imports
- Post-research decision: `@vaadin/router` was deprecated and replaced with `LitroRouter`, a built-in router using the native URLPattern API with no external dependencies

Full findings archived in git history (R-3-findings.md, ~1,300 lines).

---

## R-4: Nitro Build Pipeline -- Dev Server, Production Bundling, Virtual Modules

Researched Nitro's standalone usage: config, plugins, routing, prerendering, and deployment adapters.

- Two plugin types: build-time (in `nitro.config.ts`, use `nitro.hooks`) vs runtime (`server/plugins/`, use `nitroApp.hooks`); build-time plugins must be directly awaited from `hooks['build:before']`
- Virtual modules are set via `nitro.options.virtual`; content must be plain JavaScript (TypeScript causes Rollup parse errors); a `package.json` `"imports"` stub is needed as a cold-start fallback
- Dev middleware: Vite runs in `middlewareMode: true` inside a Nitro server middleware; exclude from production via `ignore` + `handlers[env:'dev']` to prevent `@vercel/nft` from tracing Vite into the production bundle
- Prerendering uses `nitro.options.prerender.routes` for explicit routes and `crawlLinks` for discovery; `crawlLinks` only finds `<a href>` links, not client-router routes
- Nitro's esbuild needs `experimentalDecorators: true, useDefineForClassFields: false` in `tsconfigRaw` to handle Lit decorator syntax

Full findings archived in git history (R-4-findings.md, ~1,400 lines).
