/**
 * HTML injected into every page's <head> via routeMeta.head.
 *
 * Order matters:
 *   1. Stylesheet link — loaded asynchronously by the browser; must come before
 *      the FOUC-prevention script so --sl-* tokens are available immediately.
 *   2. Inline script — synchronous, runs before first paint to set data-theme
 *      from the stored choice, or from the system when there is none. It is
 *      the ONLY code that decides the theme; see the comment beside it.
 */
export const starlightHead = [
  '<link rel="stylesheet" href="/shoelace/themes/light.css" />',
  '<link rel="stylesheet" href="/styles/starlight.css" />',
  '<link rel="stylesheet" href="/styles/highlight.css" />',
  // THE ONE PLACE THE THEME IS DECIDED. It runs synchronously in <head>, so
  // data-theme is on <html> before the first paint and there is no flash.
  //
  // Nothing else may recompute it. A component that resolves the theme again
  // in firstUpdated() answers a moment later, and if it answers differently
  // it overwrites a correct value with a wrong one — which is exactly what
  // starlight-header used to do with a bare ?? 'light' fallback. Read
  // data-theme; do not work it out a second time.
  //
  // localStorage throws rather than returning null in a browser with site
  // data blocked, so every read is guarded.
  '<script>(function(){',
  'var K="sl-theme";',
  'var m=window.matchMedia("(prefers-color-scheme: dark)");',
  'function g(){try{return localStorage.getItem(K)}catch(e){return null}}',
  'function a(){document.documentElement.setAttribute("data-theme",g()||(m.matches?"dark":"light"))}',
  'a();',
  // A reader who has chosen nothing follows the system, and keeps following
  // it if they change it while the page is open. A reader who HAS chosen is
  // left alone.
  'm.addEventListener("change",function(){if(!g())a()});',
  '})();</script>',
].join('');
