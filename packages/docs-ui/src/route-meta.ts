/**
 * HTML injected into every page's <head> via routeMeta.head.
 *
 * Order matters:
 *   1. Stylesheet link — loaded asynchronously by the browser; must come before
 *      the FOUC-prevention script so --sl-* tokens are available immediately.
 *   2. Inline script — synchronous, runs before first paint to set data-theme
 *      from the stored choice, or from the system when there is none. It is
 *      the ONLY code that decides the theme; see the comment beside it.
 *
 * Umami analytics: opt-in via env vars at deploy time.
 *   UMAMI_WEBSITE_ID — required; if absent, no script is emitted
 *   UMAMI_SRC        — script URL (default: https://cloud.umami.is/script.js)
 *   UMAMI_DOMAINS    — data-domains allowlist (optional)
 */
// `globalThis.process?.` guard: this module is shared with browser-side page
// components. In the production client bundle the unused server-only exports
// (and with them these env reads) are tree-shaken away, but the dev server
// serves the module as live source where the whole body executes — a bare
// `process` reference would throw ReferenceError and kill the client graph.
const env = globalThis.process?.env ?? {};
const umamiScript = env.UMAMI_WEBSITE_ID
  ? `<script defer src="${env.UMAMI_SRC ?? 'https://cloud.umami.is/script.js'}" data-website-id="${env.UMAMI_WEBSITE_ID}"${env.UMAMI_DOMAINS ? ` data-domains="${env.UMAMI_DOMAINS}"` : ''}></script>`
  : '';

export const starlightHead = [
  '<link rel="icon" type="image/png" href="/logo.png" />',
  '<link rel="alternate" type="application/rss+xml" title="Litro Blog" href="/blog/rss.xml" />',
  '<link rel="sitemap" type="application/xml" href="/sitemap.xml" />',
  '<link rel="stylesheet" href="/shoelace/themes/light.css" />',
  '<link rel="stylesheet" href="/styles/starlight.css" />',
  '<link rel="stylesheet" href="/styles/highlight.css" />',
  umamiScript,
  // THE ONE PLACE THE THEME IS DECIDED. It runs synchronously in <head>, so
  // data-theme is on <html> before the first paint and there is no flash.
  //
  // Nothing else may recompute it. A component that resolves the theme again
  // in firstUpdated() answers a moment later, and if it answers differently
  // it overwrites a correct value with a wrong one — which is exactly what
  // starlight-header used to do with a bare `?? "light"` fallback. Read
  // data-theme; do not work it out a second time.
  //
  // localStorage throws rather than returning null in a browser with site
  // data blocked, so every read is guarded.
  "<script>(function(){",
  'var K="sl-theme";',
  'var m=window.matchMedia("(prefers-color-scheme: dark)");',
  'function g(){try{return localStorage.getItem(K)}catch(e){return null}}',
  'function a(){document.documentElement.setAttribute("data-theme",g()||(m.matches?"dark":"light"))}',
  "a();",
  // A reader who has chosen nothing follows the system, and keeps following
  // it if they change it while the page is open. A reader who HAS chosen is
  // left alone.
  'm.addEventListener("change",function(){if(!g())a()});',
  "})();</script>",
].join("");
