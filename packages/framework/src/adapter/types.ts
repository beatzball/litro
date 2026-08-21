/**
 * adapter/types.ts — Framework adapter interface
 *
 * Defines the contract between Litro's infrastructure (SSR pipeline, shell
 * builder, CLI, Vite/Nitro config) and a concrete web component framework
 * (Lit, FAST, Elena).
 *
 * The adapter is selected per-project via the `adapter` field in
 * LitroConfig. Each adapter provides:
 *   - SSR rendering: turn a custom element tag + server data into an HTML stream
 *   - Shell customisation: hydration scripts, DSD polyfill toggle
 *   - Build config: Vite plugins, Nitro externals / esbuild options
 *   - Component registration: how page modules are registered on the server
 *
 * Users write native framework classes (LitElement, FASTElement, Elena mixin)
 * — the adapter does NOT define a component authoring API.
 */

import type { NitroConfig } from 'nitropack';
import type { Plugin as VitePlugin } from 'vite';

/** Supported adapter names. */
export type AdapterName = 'lit' | 'fast' | 'elena';

/**
 * Minimal page manifest entry used by adapter.registerComponents().
 * Mirrors the shape of a page manifest entry without depending on the full
 * LitroRoute type (which carries build-time metadata the adapter doesn't need).
 */
export interface PageManifestEntry {
  /** Custom element tag name, e.g. 'page-home'. */
  tag: string;
  /** Pre-imported module for this page (from #litro/page-manifest). */
  module: Record<string, unknown>;
}

export interface FrameworkAdapter {
  /** Framework identifier. */
  readonly name: AdapterName;

  /**
   * Render a page component to an async HTML stream.
   *
   * The adapter instantiates the custom element identified by `tag`, optionally
   * binds `serverData` as a property, and runs the framework's SSR engine.
   *
   * The returned iterable yields HTML string chunks — DSD-wrapped for Shadow DOM
   * frameworks (Lit, FAST) or plain HTML for light DOM frameworks (Elena).
   *
   * @param tag        - Custom element tag name, e.g. 'page-home'.
   * @param serverData - Result of definePageData() for this route, or undefined.
   * @returns Async iterable of HTML string chunks.
   */
  renderPage(tag: string, serverData: unknown): AsyncIterable<string>;

  /**
   * Raw HTML to inject into <head> for hydration and framework bootstrap.
   *
   * Called once per HTML response by shell.ts. Lit emits the hydrate-support
   * script; Elena emits nothing; FAST emits its command buffer bootstrap.
   *
   * The app bundle `<script type="module">` is handled separately by shell.ts —
   * this method only returns framework-specific head content.
   */
  getHeadScripts(options: { isDev: boolean; basePath: string }): string;

  /**
   * Whether the HTML shell should include the DSD polyfill inline script.
   *
   * true for Shadow DOM frameworks (Lit, FAST) whose SSR output contains
   * <template shadowrootmode="open"> elements. false for light DOM
   * frameworks (Elena) that render plain HTML.
   */
  readonly needsDSDPolyfill: boolean;

  /**
   * Path to the client entry module that bootstraps the framework runtime.
   *
   * This module is imported as the app entry point by Vite's client build.
   * It must set up hydration support (if needed), import the router, and
   * register the framework's Outlet/Link/Page custom elements.
   *
   * Example: './src/adapter/lit/client.ts' (resolved relative to framework package)
   */
  readonly clientEntryModule: string;

  /**
   * Vite plugin(s) the adapter requires in the client build.
   *
   * Merged into the project's vite.config.ts plugins array. Return an empty
   * array if no special Vite plugins are needed (Lit, for example, needs none).
   */
  vitePlugins(): VitePlugin[];

  /**
   * Additional Nitro config the adapter needs merged into the project's
   * nitro.config.ts.
   *
   * Common uses:
   *   - externals.inline for SSR packages (e.g. '@lit-labs/ssr')
   *   - esbuild.options for decorator/class field settings
   *
   * Return an empty object if no Nitro config overrides are needed.
   */
  nitroConfig(): Partial<NitroConfig>;

  /**
   * JavaScript import statement(s) to prepend to the generated
   * `#litro/page-manifest` virtual module.
   *
   * The manifest statically imports all page modules, which in turn import
   * the framework library. Some frameworks (e.g. FAST) require initialisation
   * code to run BEFORE the framework is first imported (DOM shims, SSR
   * patching). This preamble is injected at the very top of the manifest so
   * it is evaluated first in the Rollup bundle.
   *
   * Return an empty string if no preamble is needed (Lit only).
   */
  manifestPreamble?(): string;

  /**
   * JavaScript code to append AFTER the page module imports and exports
   * in the generated `#litro/page-manifest` virtual module.
   *
   * Unlike the preamble (which is hoisted with imports), the postamble runs
   * as top-level inline code AFTER all imports have been evaluated. This is
   * the right place for code that needs access to the imported page modules.
   *
   * The function receives the variable names of the imported page modules
   * (e.g. ['_page0', '_page1']) so the generated code can reference them.
   *
   * Return undefined or an empty string if no postamble is needed.
   */
  manifestPostamble?(pageModuleVars: string[]): string;
}
