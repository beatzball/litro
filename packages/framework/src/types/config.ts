/**
 * types/config.ts — Litro configuration types
 *
 * Defines the shape of user-facing Litro configuration. Currently the
 * `adapter` field is the only Litro-specific config; all other settings
 * (server, build, deploy) are Nitro and Vite config.
 *
 * The adapter field can be set:
 *   - In nitro.config.ts via `runtimeConfig.litro.adapter`
 *   - Via LITRO_ADAPTER environment variable
 *   - Via `create-litro --adapter <name>`
 *
 * When omitted, defaults to 'lit' for full backward compatibility.
 */

import type { AdapterName } from '../adapter/types.js';

export interface LitroConfig {
  /**
   * Which web component framework adapter to use.
   *
   * - `'lit'`   — Lit (default). Shadow DOM, DSD SSR, @lit-labs/ssr hydration.
   * - `'fast'`  — Microsoft FAST. Shadow DOM, DSD SSR, command buffer hydration.
   * - `'elena'` — Elena. Light DOM, @scope CSS, progressive enhancement.
   *
   * The adapter controls:
   *   - How page components are SSR-rendered (DSD vs. plain HTML)
   *   - What hydration scripts appear in <head>
   *   - Which internal components (Outlet, Link, Page) are registered
   *   - Nitro and Vite build configuration
   *
   * @default 'lit'
   */
  adapter?: AdapterName;
}
