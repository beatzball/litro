/**
 * shell.ts — HTML document shell builder
 *
 * Produces the full HTML document wrapping an SSR'd page component. The shell
 * is split into two parts — `head` and `foot` — so the streamed SSR content
 * can be piped between them:
 *
 *   response.write(shell.head)       // DOCTYPE, <head>, <body>, opening wrapper
 *   // ... stream SSR output ...     // Component HTML (DSD or plain, per adapter)
 *   response.write(shell.foot)       // closing wrapper, </body>, </html>
 *
 * Script loading order in <head> is CRITICAL for hydration correctness:
 *
 *   1. DSD polyfill (inline, synchronous) — included only when the adapter
 *      sets `needsDSDPolyfill: true` (Shadow DOM frameworks like Lit/FAST).
 *      Must run as the parser encounters <template shadowrootmode> elements.
 *      Omitted for light DOM adapters (Elena).
 *
 *   2. app.js (type="module" in the foot) — the Vite-built client bundle.
 *      The framework adapter's client entry is the first import, setting up
 *      any hydration patches before components are evaluated.
 *
 * The default app script path `/_litro/app.js` maps to `dist/client/app.js`
 * via the `publicAssets` entry in nitro.config.ts. In dev mode, pass
 * `appScriptUrl: '/_litro/app.ts'` so Vite's middleware (base: '/_litro/')
 * can transform the module on the fly (no pre-built bundle required).
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

/** Inline script that powers skip links across shadow DOM boundaries.
 *
 * Three responsibilities:
 * 1. Click handler — walks shadow roots to find the target element and focuses it.
 * 2. Visibility — hides skip links (via `hidden`) when their target doesn't exist
 *    on the current page. "Skip to navigation" is hidden on pages without a sidebar.
 * 3. SPA reactivity — a MutationObserver on `<litro-outlet>` re-checks visibility
 *    after each SPA page swap so skip links stay in sync during client navigation.
 *
 * Recipe/site layers can handle special skip link actions (e.g. opening a search
 * modal) by listening for click events on their own skip link anchors.
 */
const SKIP_LINK_SCRIPT =
  `(function(){function f(r,id){var s='#'+CSS.escape(id),d=r.querySelector(s);if(d)return d;var a=r.querySelectorAll('*');for(var i=0;i<a.length;i++){if(a[i].shadowRoot){var x=f(a[i].shadowRoot,id);if(x)return x}}return null}function u(){var ls=document.querySelectorAll('.skip-link[href^=\"#\"]');for(var i=0;i<ls.length;i++){var id=ls[i].getAttribute('href').slice(1);if(id==='_litro_main')continue;var t=document.getElementById(id)||f(document,id);if(t)ls[i].removeAttribute('hidden');else ls[i].setAttribute('hidden','')}}document.addEventListener('click',function(e){var l=e.target.closest('.skip-link');if(!l||l.hasAttribute('hidden'))return;var h=l.getAttribute('href');if(!h||h[0]!=='#')return;var id=h.slice(1);e.preventDefault();var t=document.getElementById(id)||f(document,id);if(t){if(!t.hasAttribute('tabindex'))t.setAttribute('tabindex','-1');t.focus({preventScroll:true});t.scrollIntoView()}});document.addEventListener('DOMContentLoaded',function(){requestAnimationFrame(u);var o=document.querySelector('litro-outlet');if(o)new MutationObserver(function(){requestAnimationFrame(u)}).observe(o,{childList:true})})})();`;

/** A single skip link rendered at the top of the document body. */
export interface SkipLink {
  /** Visible text shown when the link is focused (e.g. "Skip to content"). */
  label: string;
  /** Fragment href (e.g. "#_litro_main"). Must start with "#". */
  href: string;
}

/**
 * Default skip links included in every Litro shell. Contains a single
 * "Skip to content" link targeting the `<litro-outlet>` wrapper.
 *
 * Sites can extend this with spread syntax:
 *   skipLinks: [...DEFAULT_SKIP_LINKS, { label: 'Skip to navigation', href: '#_litro_nav' }]
 *
 * Or replace it entirely:
 *   skipLinks: [{ label: 'Skip to main', href: '#main' }]
 */
export const DEFAULT_SKIP_LINKS: SkipLink[] = [
  { label: 'Skip to content', href: '#_litro_main' },
];

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
  /**
   * URL for the client-side app bundle `<script type="module">` tag.
   *
   * Production default: `/_litro/app.js` (served from dist/client/app.js via
   * the `publicAssets` Nitro config entry).
   *
   * Dev mode: pass `/_litro/app.ts` so Vite's middleware (base: '/_litro/')
   * serves and hot-reloads the entry module directly (no pre-built bundle).
   */
  appScriptUrl?: string;
  /**
   * When true, injects a polling script that checks /_litro/_litro-version.json
   * every 300 ms. Written by the Vite content plugin on each Markdown change;
   * served at /_litro/ by the existing publicAssets handler. When v changes the
   * browser calls location.reload(). Only injected in dev mode.
   */
  devMode?: boolean;
  /**
   * Skip links rendered at the top of `<body>`. Each link is visually hidden
   * until focused, allowing keyboard/screen reader users to jump to key
   * landmarks.
   *
   * Defaults to `DEFAULT_SKIP_LINKS` (a single "Skip to content" link).
   * Links whose target doesn't exist on the current page are automatically
   * hidden via a MutationObserver (the "#_litro_main" link is always visible).
   */
  skipLinks?: SkipLink[];
  /**
   * Whether to include the Declarative Shadow DOM polyfill inline script.
   *
   * Defaults to true for backward compatibility. Set to false for light DOM
   * adapters (Elena) where no DSD templates are present in the SSR output.
   *
   * @default true
   */
  includeDSDPolyfill?: boolean;
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
  // Escape </script sequences so the HTML parser does not terminate the
  // <script type="application/json"> element early. This happens when page
  // data includes rendered HTML (e.g. CHANGELOG entries mentioning </script>
  // in code spans). JSON parsers treat \/ as /, so the data round-trips
  // correctly: JSON.parse('<\/script>') === '</script>'.
  const safeJson = options?.serverDataJson?.replace(/<\/script/gi, '<\\/script') ?? '';
  const serverDataScript = options?.serverDataJson
    ? `\n  <script type="application/json" id="__litro_data__">${safeJson}</script>`
    : '';
  const appScriptUrl = options?.appScriptUrl ?? '/_litro/app.js';
  const devReloadScript = options?.devMode
    ? `\n  <script>(function(){var v=null;setInterval(function(){fetch('/_litro/_litro-version.json?_t='+Date.now()).then(function(r){return r.json()}).then(function(d){if(v===null){v=d.v}else if(v!==d.v){location.reload()}}).catch(function(){})},2500)})();</script>`
    : '';

  const skipLinks = options?.skipLinks ?? DEFAULT_SKIP_LINKS;
  const skipLinksHtml = skipLinks
    .map((link) => `\n<a class="skip-link" href="${link.href}">${link.label}</a>`)
    .join('');

  const includeDSD = options?.includeDSDPolyfill !== false;
  const dsdPolyfillBlock = includeDSD
    ? `
  <!--
    DSD polyfill — required for ~4% of browsers (pre-Firefox 119, pre-Safari 16.4)
    that do not natively support Declarative Shadow DOM (shadowrootmode attribute).
    Must be a plain synchronous inline <script> — a type="module" script is deferred
    by the browser and arrives after the parser has already processed the DSD templates,
    making it too late to upgrade them.
  -->
  <script>${DSD_POLYFILL}</script>`
    : '';

  const head = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>${dsdPolyfillBlock}${extraHead}${serverDataScript}${devReloadScript}
  <style>.skip-link{position:absolute;left:-9999px;top:auto;width:1px;height:1px;overflow:hidden;z-index:999}.skip-link:focus{position:fixed;top:0.5rem;left:50%;transform:translateX(-50%);width:auto;height:auto;padding:0.5rem 1.5rem;background:#fff;color:#23262f;border:2px solid currentColor;border-radius:0.375rem;font-size:0.875rem;font-weight:600;z-index:999;box-shadow:0 2px 8px rgba(0,0,0,0.15)}.skip-link[hidden]{display:none}</style>
  <script>${SKIP_LINK_SCRIPT}</script>
</head>
<body${bodyAttrs}>${skipLinksHtml}
<litro-outlet id="_litro_main" tabindex="-1" style="outline:none">
`;

  const foot = `</litro-outlet>

  <!--
    App bundle — framework adapter bootstrap + page components.
    /_litro/ maps to dist/client/ (Vite output) via publicAssets in nitro.config.ts.
  -->
  <script type="module" src="${appScriptUrl}"></script>
</body>
</html>
<!-- /${componentTag} -->
`;

  return { head, foot };
}
