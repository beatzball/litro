/**
 * HTML injected into every page's <head> via routeMeta.head.
 *
 * Order matters:
 *   1. Stylesheet link — loaded asynchronously by the browser; must come before
 *      the FOUC-prevention script so --sl-* tokens are available immediately.
 *   2. Inline script — synchronous, runs before first paint to set data-theme
 *      from localStorage, preventing a flash of the wrong theme on reload.
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
  "<script>(function(){",
  'var s=localStorage.getItem("sl-theme");',
  'var t=s||(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");',
  'document.documentElement.setAttribute("data-theme",t);',
  "})();</script>",
].join("");
