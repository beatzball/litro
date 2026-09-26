/**
 * Path canonicalization shared by every Litro route matcher.
 *
 * This module is deliberately dependency-free and environment-free: no
 * `window`, no `node:` builtin, no import of the router itself. That is what
 * lets the client router, the framework's OG handler and a scaffolded app's
 * server handler all reach the same implementation without a cycle and
 * without pulling client-only code into a server bundle.
 *
 * Why it exists (issue 203)
 * -------------------------
 * `/docs/getting-started` and `/docs/getting-started/` are the same page, but
 * neither matcher used to say so. The client router builds a `URLPattern`,
 * which anchors the pathname exactly:
 *
 *   new URLPattern({ pathname: '/docs/:slug' }).test({ pathname: '/docs/a/' })
 *   // false
 *
 * and a scaffolded server handler builds a RegExp that ends in `$` with no
 * optional slash, so it is equally strict.
 *
 * The two halves disagreeing is what made the failure invisible. An SSG build
 * uses Nitro's `autoSubfolderIndex`, so `/docs/getting-started` is written to
 * `docs/getting-started/index.html`, and a static host happily answers the
 * trailing-slash URL with 200 and every asset. Only the client router missed:
 * the page component was never defined, and the recipe's
 * `:not(:defined) { visibility: hidden }` rule then hid a document that was
 * fully present in the DOM. A blank page, 200, no console error.
 *
 * Accept, do not redirect
 * -----------------------
 * Litro canonicalizes by ACCEPTING a trailing slash, not by redirecting to the
 * bare path. Three reasons:
 *
 * 1. A static host already accepts it. An SSG deploy never reaches our code —
 *    nginx serves `index.html` out of the subfolder. If the SSR server
 *    redirected, the same app would answer the same URL differently depending
 *    on how it was deployed.
 * 2. The client router has no HTTP layer, so "redirect" there can only mean
 *    rewriting the address bar. Mirroring a 301 faithfully on both halves is
 *    not possible; accepting is the one behavior both halves can actually
 *    share.
 * 3. A host that adds trailing slashes of its own and a server that strips
 *    them is a redirect loop.
 *
 * Pages that care about the duplicate-URL cost should emit a canonical link
 * tag; that is a page-level concern, not a router one.
 */

/**
 * Returns the canonical form of a pathname for route matching.
 *
 * Removes a single trailing slash. The root path `/` is returned unchanged,
 * because stripping it would leave the empty string, which matches no route.
 *
 *   normalizePathname('/')                      // '/'
 *   normalizePathname('/about')                 // '/about'
 *   normalizePathname('/about/')                // '/about'
 *   normalizePathname('/docs/getting-started/') // '/docs/getting-started'
 *
 * Only the last slash of a repeated run comes off (`'/docs//'` → `'/docs/'`).
 * A path with a doubled slash is a distinct path, not a formatting variant,
 * and collapsing it would silently merge two routes.
 */
export function normalizePathname(pathname: string): string {
  return pathname.length > 1 && pathname.endsWith('/')
    ? pathname.slice(0, -1)
    : pathname;
}
