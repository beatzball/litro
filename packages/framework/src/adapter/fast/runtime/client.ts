/**
 * FAST client runtime entry point.
 *
 * Equivalent to the Lit client.ts. Wires together:
 * 1. FAST hydration support (must be first import)
 * 2. LitroRouter
 * 3. FAST runtime custom elements (Outlet, Link)
 *
 * CRITICAL IMPORT ORDER
 * ─────────────────────
 * The hydration support import MUST come first. It installs
 * HydratableElementController which makes FASTElement respect the
 * defer-hydration attribute emitted by @microsoft/fast-ssr.
 *
 * Server-side safety
 * ──────────────────
 * This file must NOT be imported by any Nitro/server code path.
 */

// Step 1 — MUST BE FIRST: install FAST hydration support
import '@microsoft/fast-element/install-element-hydration.js';

// Step 2 — router and custom elements
import { LitroRouter } from '@beatzball/litro-router';
import './LitroOutlet.js';
import './LitroLink.js';

export { LitroRouter };
export { LitroOutlet, initRouter } from './LitroOutlet.js';
export { LitroLink } from './LitroLink.js';
export { LitroPage } from './LitroPage.js';
