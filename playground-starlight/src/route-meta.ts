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
  '<link rel="stylesheet" href="/styles/starlight.css" />',
  '<script>(function(){',
  'var t=localStorage.getItem("sl-theme")||"light";',
  'document.documentElement.setAttribute("data-theme",t);',
  '})();</script>',
].join('');
