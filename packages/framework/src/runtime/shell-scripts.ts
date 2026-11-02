/**
 * shell-scripts.ts — the classic scripts the page shell runs, in one registry.
 *
 * `buildShell()` (runtime/shell.ts) writes each of these into the page either
 * inline (the default) or, with `inlineScripts: false`, as a `<script src>`
 * that names a file under `/_litro/assets/`. `litroShellScriptsPlugin()`
 * (vite/shell-scripts.ts) emits those files into the client build, and the
 * pages plugin checks they are there (plugins/pages.ts). Serving them as
 * files is what lets an app run under `script-src 'self'` with no
 * `'unsafe-inline'` (issue 290).
 *
 * THE FILE NAME CARRIES THE CONTENT HASH. Everything under `/_litro/assets/`
 * is served `immutable` (BUILD-010), so a script that changed under the same
 * name would stay cached forever. `fileName` is a literal, not computed at
 * runtime, so this module needs no `node:crypto` on an edge runtime; the test
 * in `__tests__/shell-scripts.test.ts` fails when a source and its hash
 * disagree, and prints the hash to use.
 *
 * ADDING A SCRIPT. A new classic script in the shell goes in this registry and
 * is written through `scriptTag()`. The guard test renders `buildShell()` with
 * `inlineScripts: false` and every option on, and fails on any `<script>`
 * that has no `src` and is not a data block.
 */

/** One classic script the shell can write inline or load as a file. */
export interface ShellScript {
  /** File name under `/_litro/assets/`: `litro-<id>-<first 8 hex of sha256(source)>.js`. */
  fileName: string;
  /** The script body, exactly as it is written inline. */
  source: string;
}

/** Minified MutationObserver-based DSD polyfill.
 *
 * Targets the ~4% of browsers that do not yet support the native
 * Declarative Shadow DOM `shadowrootmode` attribute (pre-Firefox 119,
 * pre-Safari 16.4). The polyfill watches for newly added <template> elements
 * with a `shadowrootmode` attribute and promotes them to real shadow roots.
 *
 * It must stay a synchronous CLASSIC script, inline or `<script src>` with no
 * `defer`, `async` or `type="module"`: it has to be running before the parser
 * reaches the first `<template shadowrootmode>`.
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
export const DSD_POLYFILL: ShellScript = {
  fileName: 'litro-dsd-polyfill-54da96d3.js',
  source:
    `(function(){if(!HTMLTemplateElement.prototype.hasOwnProperty('shadowRootMode')){const t=new MutationObserver(e=>{for(const n of e)for(const o of n.addedNodes)if(o instanceof HTMLTemplateElement&&o.getAttribute('shadowrootmode')){const e=o.getAttribute('shadowrootmode'),t=o.parentNode;if(t){const n=t.attachShadow({mode:e});n.appendChild(o.content.cloneNode(!0));o.remove()}}});t.observe(document.documentElement,{childList:!0,subtree:!0})}})();`,
};

/** Script that powers skip links across shadow DOM boundaries.
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
 *
 * As a file it loads with `defer`: it only registers listeners, and a deferred
 * script runs before `DOMContentLoaded`, the event it waits for.
 */
export const SKIP_LINK_SCRIPT: ShellScript = {
  fileName: 'litro-skip-links-0071e730.js',
  source:
    `(function(){function f(r,id){var s='#'+CSS.escape(id),d=r.querySelector(s);if(d)return d;var a=r.querySelectorAll('*');for(var i=0;i<a.length;i++){if(a[i].shadowRoot){var x=f(a[i].shadowRoot,id);if(x)return x}}return null}function u(){var ls=document.querySelectorAll('.skip-link[href^=\"#\"]');for(var i=0;i<ls.length;i++){var id=ls[i].getAttribute('href').slice(1);if(id==='_litro_main')continue;var t=document.getElementById(id)||f(document,id);if(t)ls[i].removeAttribute('hidden');else ls[i].setAttribute('hidden','')}}document.addEventListener('click',function(e){var l=e.target.closest('.skip-link');if(!l||l.hasAttribute('hidden'))return;var h=l.getAttribute('href');if(!h||h[0]!=='#')return;var id=h.slice(1);e.preventDefault();var t=document.getElementById(id)||f(document,id);if(t){if(!t.hasAttribute('tabindex'))t.setAttribute('tabindex','-1');t.focus({preventScroll:true});t.scrollIntoView()}});document.addEventListener('DOMContentLoaded',function(){requestAnimationFrame(u);var o=document.querySelector('litro-outlet');if(o)new MutationObserver(function(){requestAnimationFrame(u)}).observe(o,{childList:true})})})();`,
};

/**
 * Dev-only content reload: polls `/_litro/_litro-version.json` every 2.5s and
 * reloads the page when the version changes. Written only when
 * `contentDevPolling` is set, which `createPageHandler()` does only under
 * `litro dev`. Under `litro dev` the page handler keeps every script inline
 * (the client build that would hold the files does not exist yet), so the
 * file form exists for completeness and for the guard test.
 */
export const DEV_CONTENT_RELOAD_SCRIPT: ShellScript = {
  fileName: 'litro-dev-reload-573e4ad0.js',
  source:
    `(function(){var v=null;setInterval(function(){fetch('/_litro/_litro-version.json?_t='+Date.now()).then(function(r){return r.json()}).then(function(d){if(v===null){v=d.v}else if(v!==d.v){location.reload()}}).catch(function(){})},2500)})();`,
};

/** Every script in the registry. The Vite plugin emits each one. */
export const SHELL_SCRIPTS: readonly ShellScript[] = [
  DSD_POLYFILL,
  SKIP_LINK_SCRIPT,
  DEV_CONTENT_RELOAD_SCRIPT,
];

/**
 * The scripts a production page can load as files. The dev content reload is
 * not one of them (production never writes it), so a build without its file
 * still counts as complete.
 */
export const PRODUCTION_SHELL_SCRIPTS: readonly ShellScript[] = [DSD_POLYFILL, SKIP_LINK_SCRIPT];

/** Directory, inside the client build, that the files are emitted to. */
export const SHELL_SCRIPTS_DIR = 'assets';

/**
 * The global the generated page manifest sets (see plugins/pages.ts): `true`
 * when the build found every file in `PRODUCTION_SHELL_SCRIPTS`, `false` when
 * it found only some. Unset when it found none.
 */
export const LITRO_SHELL_SCRIPTS_GLOBAL = '__litro_shell_scripts__';

/** What the build found: every production file, only some, or none. */
export type ShellScriptFiles = 'all' | 'partial' | 'none';

/** Reads what the page manifest reported for this build. */
export function shellScriptFiles(): ShellScriptFiles {
  const v = (globalThis as Record<string, unknown>)[LITRO_SHELL_SCRIPTS_GLOBAL];
  return v === true ? 'all' : v === false ? 'partial' : 'none';
}

/** How `scriptTag()` writes a script. */
export interface ScriptTagOptions {
  /**
   * URL of the directory the files are served from, without a trailing
   * slash, such as `/_litro/assets`. Undefined writes the script inline.
   */
  filesUrl?: string;
  /** Add `defer` to the file form. Never set for the DSD polyfill. */
  defer?: boolean;
}

/**
 * Writes one registry script as an HTML `<script>` element: inline by default,
 * or `<script src>` when `filesUrl` is set.
 */
export function scriptTag(script: ShellScript, options: ScriptTagOptions = {}): string {
  if (options.filesUrl === undefined) return `<script>${script.source}</script>`;
  const defer = options.defer ? ' defer' : '';
  return `<script src="${options.filesUrl}/${script.fileName}"${defer}></script>`;
}
