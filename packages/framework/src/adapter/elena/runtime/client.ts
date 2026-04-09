/**
 * Elena client runtime entry point.
 *
 * Equivalent to the Lit/FAST client.ts. Wires together:
 * 1. LitroRouter
 * 2. Elena runtime custom elements (Outlet, Link)
 *
 * NO HYDRATION SUPPORT SCRIPT NEEDED
 * ───────────────────────────────────
 * Elena uses progressive enhancement — components upgrade in place when
 * JavaScript loads. No prototype patching or hydration controller required.
 * This is the simplest client entry of all three adapters.
 *
 * Server-side safety
 * ──────────────────
 * This file must NOT be imported by any Nitro/server code path.
 */

// Router and custom elements
import { LitroRouter } from '@beatzball/litro-router';
import './LitroOutlet.js';
import './LitroLink.js';

export { LitroRouter };
export { LitroOutlet, initRouter } from './LitroOutlet.js';
export { LitroLink } from './LitroLink.js';
export { LitroPage } from './LitroPage.js';
