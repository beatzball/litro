/**
 * shell.ts — HTML document shell builder
 *
 * Produces the full HTML document wrapping an SSR'd Lit component. The shell
 * is split into two parts — `head` and `foot` — so the streamed SSR content
 * can be piped between them:
 *
 *   response.write(shell.head)       // DOCTYPE, <head>, <body>, opening wrapper
 *   // ... stream SSR DSD output ... // Lit component with shadow DOM HTML
 *   response.write(shell.foot)       // closing wrapper, </body>, </html>
 *
 * Script loading order in <head> is CRITICAL for hydration correctness:
 *
 *   1. DSD polyfill (inline, synchronous) — must run as the parser encounters
 *      <template shadowrootmode> elements. A type="module" script is deferred
 *      and arrives too late; a plain inline script runs synchronously.
 *
 *   2. lit-element-hydrate-support.js (type="module") — monkey-patches
 *      LitElement.prototype.createRenderRoot() to enter hydration mode.
 *      MUST load before any LitElement subclass is evaluated. Loading it as a
 *      module in <head> (before app.js) ensures correct ordering.
 *
 *   3. app.js (type="module") — the Vite-built client bundle, loaded after
 *      the hydration support module has already patched LitElement.
 *
 * The path /_litro/app.js must match the `baseURL` in nitro.config.ts
 * publicAssets (currently '/_litro/'). If that base changes, update here.
 */

/** Minified MutationObserver-based DSD polyfill.
 *
 * Targets the ~4% of browsers that do not yet support the native
 * Declarative Shadow DOM `shadowrootmode` attribute (pre-Firefox 119,
 * pre-Safari 16.4). The polyfill watches for newly added <template> elements
 * with a `shadowrootmode` attribute and promotes them to real shadow roots.
 *
 * Source (expanded for reference):
 *   if (!HTMLTemplateElement.prototype.hasOwnProperty('shadowRootMode')) {
 *     const observer = new MutationObserver(mutations => {
 *       for (const mutation of mutations) {
 *         for (const node of mutation.addedNodes) {
 *           if (node instanceof HTMLTemplateElement && node.getAttribute('shadowrootmode')) {
 *             const mode = node.getAttribute('shadowrootmode');
 *             const parent = node.parentNode;
 *             if (parent) {
 *               const shadow = parent.attachShadow({ mode });
 *               shadow.appendChild(node.content.cloneNode(true));
 *               node.remove();
 *             }
 *           }
 *         }
 *       }
 *     });
 *     observer.observe(document.documentElement, { childList: true, subtree: true });
 *   }
 */
const DSD_POLYFILL =
  `(function(){if(!HTMLTemplateElement.prototype.hasOwnProperty('shadowRootMode')){const t=new MutationObserver(e=>{for(const n of e)for(const o of n.addedNodes)if(o instanceof HTMLTemplateElement&&o.getAttribute('shadowrootmode')){const e=o.getAttribute('shadowrootmode'),t=o.parentNode;if(t){const n=t.attachShadow({mode:e});n.appendChild(o.content.cloneNode(!0));o.remove()}}});t.observe(document.documentElement,{childList:!0,subtree:!0})}})();`;

export interface ShellOptions {
  /** Document <title> text. Defaults to 'Litro'. */
  title?: string;
  /** Raw HTML to inject into <head> (e.g. <meta> tags from routeMeta). */
  head?: string;
  /** Additional attributes to place on the <body> element. */
  bodyAttrs?: string;
  /**
   * JSON-serialized server data blob.
   * When provided, injected as <script type="application/json" id="__litro_data__">.
   * Used by I-5 (data fetching) so the client can read initial server data
   * without an extra round-trip.
   */
  serverDataJson?: string;
}

/**
 * Builds the HTML shell for a Lit page component.
 *
 * Returns a `{ head, foot }` pair so the caller can stream the SSR output
 * between the two halves:
 *
 *   response.write(shell.head);
 *   // stream SSR chunks
 *   response.write(shell.foot);
 *
 * @param componentTag  - The custom element tag name, e.g. 'page-home'.
 *                        Used in shell.foot's closing tag comment only; the
 *                        actual opening tag is produced by the SSR template.
 * @param _ssrContent   - Reserved for future use (static build path). The
 *                        streaming path does not use this parameter — the SSR
 *                        output is piped between head and foot externally.
 * @param options       - Optional shell configuration (title, extra head, etc.)
 */
export function buildShell(
  componentTag: string,
  _ssrContent: string,
  options?: ShellOptions,
): { head: string; foot: string } {
  const title = options?.title ?? 'Litro';
  const extraHead = options?.head ?? '';
  const bodyAttrs = options?.bodyAttrs ? ` ${options.bodyAttrs}` : '';
  const serverDataScript = options?.serverDataJson
    ? `\n  <script type="application/json" id="__litro_data__">${options.serverDataJson}</script>`
    : '';

  const head = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <!--
    DSD polyfill — required for ~4% of browsers (pre-Firefox 119, pre-Safari 16.4)
    that do not natively support Declarative Shadow DOM (shadowrootmode attribute).
    Must be a plain synchronous inline <script> — a type="module" script is deferred
    by the browser and arrives after the parser has already processed the DSD templates,
    making it too late to upgrade them.
  -->
  <script>${DSD_POLYFILL}</script>
  <!--
    CRITICAL IMPORT ORDER: @lit-labs/ssr-client/lit-element-hydrate-support.js
    MUST load as a module script in <head> BEFORE app.js (the Lit component bundle).
    It monkey-patches LitElement.prototype.createRenderRoot() to enter hydration mode
    (claim the existing DSD shadow root) instead of creating a fresh empty shadow root.
    If any LitElement subclass loads first, those components will not hydrate correctly.
  -->
  <script type="module" src="/_litro/lit-element-hydrate-support.js"></script>${extraHead}${serverDataScript}
</head>
<body${bodyAttrs}>
`;

  const foot = `
  <!--
    App bundle — loads AFTER the hydration support script in <head>.
    /_litro/ maps to dist/client/ (Vite output) via publicAssets in nitro.config.ts.
    Content-hashed filenames produced by Vite allow 1-year cache headers.
  -->
  <script type="module" src="/_litro/app.js"></script>
</body>
</html>
<!-- /${componentTag} -->
`;

  return { head, foot };
}
