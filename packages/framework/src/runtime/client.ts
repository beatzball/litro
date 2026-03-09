/**
 * Litro client runtime entry point.
 *
 * This module is the canonical client-side entry that framework consumers
 * import (or that the Litro build pipeline injects as app.ts). It wires
 * together the hydration support patch, the router, and the custom elements.
 *
 * CRITICAL IMPORT ORDER
 * ─────────────────────
 * The very first import MUST be the ssr-client hydration support. It patches
 * LitElement.prototype.createRenderRoot() so that when a LitElement upgrades
 * on the client it enters "hydration mode" and attaches to the existing
 * Declarative Shadow DOM streamed by the server, rather than tearing it down
 * and creating a fresh shadow root.
 *
 * If ANY LitElement subclass is evaluated before this patch is applied, the
 * component will create a new shadow root and discard the SSR content. The
 * result is a flash of un-styled or blank content on first load.
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
