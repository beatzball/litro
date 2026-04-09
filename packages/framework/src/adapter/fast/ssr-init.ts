/**
 * adapter/fast/ssr-init.ts — FAST SSR initialization (server-only)
 *
 * This module MUST be imported before any FAST Element component code is
 * evaluated on the server. It:
 *   1. Installs the DOM shim (provides globalThis.document, HTMLElement, etc.)
 *   2. Calls fastSSR() which patches FAST Element's internals to use
 *      SSR-compatible rendering (SSRElementController, SSR template compiler)
 *
 * The templateRenderer is stored as a module-level singleton so the adapter's
 * renderPage() can access it without re-initializing.
 *
 * Import order matters:
 *   DOM shim → fastSSR() → component imports → render
 *   If components are defined before fastSSR(), their templates use the
 *   browser compiler which accesses DOM APIs that don't exist in Node.
 */

import '@microsoft/fast-ssr/install-dom-shim.js';
import fastSSR from '@microsoft/fast-ssr';

const ssrResult = fastSSR({ renderMode: 'async' });

export const templateRenderer: ReturnType<typeof fastSSR>['templateRenderer'] = ssrResult.templateRenderer;
