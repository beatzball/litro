/**
 * Litro client runtime barrel.
 *
 * This module wires the hydration support patch, the router and the custom
 * elements together and re-exports them, so a consumer can reach all of them
 * in one import.
 *
 * NOT A CLIENT ENTRY
 * ──────────────────
 * Do not use this file as an app's `app.ts`. The first import below is the
 * ssr-client hydration support, which only ASSIGNS
 * `globalThis.litElementHydrateSupport`. `lit-element` reads that hook once,
 * when its own module body runs, and the `?.` it reads it with makes a missing
 * hook a permanent silent no-op. Source order here cannot guarantee the
 * assignment wins: all of a module's static imports evaluate before its body,
 * and the bundler decides which chunk `lit-element` lands in.
 *
 * This file also cannot BE the two-statement bootstrap that BUILD-009 requires.
 * Its named exports need `lit-element` synchronously, so they cannot sit behind
 * a dynamic import. An app's entry is its own `app.ts` plus `app-main.ts` — see
 * BUILD-009, or any recipe's `app.ts`.
 *
 * What the patch itself does, once installed: it replaces
 * LitElement.prototype.createRenderRoot() so an upgrading element enters
 * "hydration mode" and attaches to the Declarative Shadow DOM the server
 * streamed, instead of tearing it down and building a fresh shadow root.
 *
 * Server-side safety
 * ──────────────────
 * This file must NOT be imported by any Nitro/server code path. It transitively
 * imports litro-router, which accesses window at runtime and will crash Node.js.
 */

// Step 1 — MUST BE FIRST: patch LitElement before any Lit code is evaluated.
import '@lit-labs/ssr-client/lit-element-hydrate-support.js';

// Step 2 — router and custom elements (safe to import after the patch)
import { LitroRouter } from '@beatzball/litro-router';
import './LitroOutlet.js';
import './LitroLink.js';

export { LitroRouter };
export { LitroOutlet, initRouter } from './LitroOutlet.js';
export { LitroLink } from './LitroLink.js';
