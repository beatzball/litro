/**
 * litro — main package entry
 *
 * Public API surface for the Litro framework package.
 *
 * Server-side (SSR pipeline):
 *   createPageHandler — factory that produces an H3 EventHandler for a page
 *   renderToStream    — thin wrapper around @lit-labs/ssr render()
 *   definePageData    — declare a server-side data fetcher for a page
 *
 * Client-side (data fetching):
 *   getServerData     — read server-serialized page data on first load
 *   LitroPage         — optional base class with built-in data fetching
 *   LitroPageMixin    — mixin version of LitroPage for multiple inheritance
 *   pageReset         — the shadow-root box model, for a component that
 *                       cannot extend LitroPage
 *
 * Build-time plugins:
 *   ssgPlugin  — Nitro build-time plugin for SSG dynamic-route resolution
 *
 * Config presets:
 *   ssgPreset  — Nitro config preset for static site generation
 *   ssrPreset  — Nitro config preset for server-side rendering
 *
 * Types:
 *   LitroRoute        — shape of a page manifest entry
 *   PageHandlerOptions — options accepted by createPageHandler
 *   PageDataFetcher   — shape of the definePageData return value
 */

// Client-safe exports — these are the only exports that should appear in the
// browser bundle. Server-only modules (createPageHandler, renderToStream,
// ssgPlugin, presets) must NOT be re-exported here: they pull in Node.js-only
// dependencies (@lit-labs/ssr, jiti, fast-glob) that cause Vite to fail when
// building the client bundle.
//
// Server-only imports:
//   createPageHandler → import from '@beatzball/litro/runtime/create-page-handler.js'
//   renderToStream    → import from '@beatzball/litro/runtime/ssr.js'
//   ssgPlugin         → import from '@beatzball/litro/plugins/ssg'
//   ssgPreset/ssrPreset → import from '@beatzball/litro/config'

export { definePageData, getServerData } from './runtime/page-data.js';
export { LitroPage, LitroPageMixin } from './runtime/LitroPage.js';
export { pageReset } from './runtime/page-reset.js';

// Skip links — exported so sites can extend DEFAULT_SKIP_LINKS.
export { DEFAULT_SKIP_LINKS } from './runtime/shell.js';

// Path canonicalization — the one implementation every Litro route matcher
// shares (issue 203). It lives in @beatzball/litro-router because that package
// is standalone and dependency-free, and is re-exported here because a
// scaffolded app depends on @beatzball/litro alone: its catch-all handler must
// strip a trailing slash exactly the way the client router does, or the two
// halves disagree and a page renders blank at '/docs/a/'. The module is pure
// string work, so it is safe in both the server and the browser bundle.
export { normalizePathname } from '@beatzball/litro-router/path';

// Type-only exports — erased at runtime, never cause module graph issues.
export type { LitroRoute, LitroRouteMeta } from './types/route.js';
export type { PageHandlerOptions } from './runtime/create-page-handler.js';
export type { PageDataFetcher } from './runtime/page-data.js';
export type { SkipLink } from './runtime/shell.js';
export type { LitroConfig } from './types/config.js';
export type { FrameworkAdapter, AdapterName } from './adapter/types.js';
