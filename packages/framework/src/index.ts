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

export const version = '0.0.1';

export { createPageHandler } from './runtime/create-page-handler.js';
export { renderToStream } from './runtime/ssr.js';
export { definePageData, getServerData } from './runtime/page-data.js';
export { LitroPage, LitroPageMixin } from './runtime/LitroPage.js';
export type { LitroRoute, LitroRouteMeta } from './types/route.js';
export type { PageHandlerOptions } from './runtime/create-page-handler.js';
export type { PageDataFetcher } from './runtime/page-data.js';

// SSG plugin and config presets (I-6)
export { default as ssgPlugin } from './plugins/ssg.js';
export { ssgPreset, ssrPreset } from './config/presets.js';
