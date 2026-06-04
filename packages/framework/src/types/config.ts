/**
 * types/config.ts — Litro configuration types
 *
 * Defines the shape of user-facing Litro configuration. Currently the
 * `adapter` field is the only Litro-specific config; all other settings
 * (server, build, deploy) are Nitro and Vite config.
 *
 * The adapter is selected at build time by reading `process.env.LITRO_ADAPTER`
 * (see `adapter/resolve.ts`). The scaffolded `nitro.config.ts` sets this on
 * its first line: `process.env.LITRO_ADAPTER = 'fast'`. The variable can also
 * be set in the shell (`LITRO_ADAPTER=fast pnpm dev`) or, at scaffolding
 * time, via the `create-litro --adapter <name>` flag, which writes the
 * assignment into the generated `nitro.config.ts`.
 *
 * The `LitroConfig` type below is informational — it documents the shape of
 * the future `runtimeConfig.litro` block. No code currently reads it; if you
 * declare it in `nitro.config.ts`, it will not affect adapter selection.
 * Use the env-var path instead.
 *
 * When the env var is unset, the resolver defaults to 'lit' for backward
 * compatibility.
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
