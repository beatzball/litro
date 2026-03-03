/**
 * Shared route type definitions for Litro's page scanner and runtime.
 *
 * LitroRoute is the canonical shape produced by the page scanner plugin
 * and consumed by:
 *   - The #litro/page-manifest virtual module (Nitro server side)
 *   - The routes.generated.ts file (LitroRouter client side)
 */

export interface LitroRoute {
  /**
   * The route path in h3/Litro syntax.
   * e.g. '/', '/about', '/blog/:slug', '/:all(.*)*'
   */
  path: string;

  /**
   * Absolute path to the source page file on disk.
   * e.g. '/home/user/my-app/pages/blog/[slug].ts'
   */
  filePath: string;

  /**
   * Valid custom element tag name derived from the file path.
   * Always hyphenated — a requirement for Custom Elements.
   * e.g. 'page-home', 'page-about', 'page-blog-slug'
   */
  componentTag: string;

  /**
   * True if the route contains any dynamic parameter segments (:param).
   * Static routes have isDynamic: false and can be safely added to prerender.routes.
   */
  isDynamic: boolean;

  /**
   * True if the route is a catch-all (contains (.*)*).
   * Derived from the [...param] file naming convention.
   */
  isCatchAll: boolean;
}

export interface LitroRouteMeta {
  title?: string;
  description?: string;
  /** Guards, layout, and custom metadata can be added here by page authors. */
  [key: string]: unknown;
}
