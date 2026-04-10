/**
 * HTML injected into every page's <head> via routeMeta.head.
 *
 * Elena uses light DOM — no Shoelace dependency. Only starlight.css
 * and highlight.css are needed. The inline script sets data-theme from
 * localStorage before first paint, preventing a theme flash.
 */
export const starlightHead = [
  '<link rel="stylesheet" href="/styles/starlight.css" />',
  '<link rel="stylesheet" href="/styles/highlight.css" />',
  '<script>(function(){',
  'var s=localStorage.getItem("sl-theme");',
  'var t=s||(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");',
  'document.documentElement.setAttribute("data-theme",t);',
  '})();</script>',
].join('');
