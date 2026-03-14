/**
 * HTML injected into every page's <head> via routeMeta.head.
 *
 * Order matters:
 *   1. Stylesheet link — loaded asynchronously by the browser; must come before
 *      the FOUC-prevention script so --sl-* tokens are available immediately.
 *   2. Inline script — synchronous, runs before first paint to set data-theme
 *      from localStorage, preventing a flash of the wrong theme on reload.
 */
export const starlightHead = [
  '<link rel="icon" type="image/png" href="/logo.png" />',
  '<link rel="stylesheet" href="/shoelace/themes/light.css" />',
  '<link rel="stylesheet" href="/styles/starlight.css" />',
  '<link rel="stylesheet" href="/styles/highlight.css" />',
  '<script defer src="https://umami.litro.dev/script.js" data-website-id="b76614a6-2fb4-4f8c-b279-0075a2d54067"></script>',
  "<script>(function(){",
  'var s=localStorage.getItem("sl-theme");',
  'var t=s||(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");',
  'document.documentElement.setAttribute("data-theme",t);',
  "})();</script>",
].join("");
