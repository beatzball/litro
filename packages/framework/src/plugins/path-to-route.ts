/**
 * Pure path-conversion utilities for Litro's page scanner.
 *
 * These functions have no Nitro or Node.js side-effects — they take string
 * inputs and return strings or LitroRoute objects. This makes them fully
 * unit-testable in isolation.
 *
 * All path operations use `pathe` (not Node's `path`) for cross-platform safety.
 * `pathe` always uses forward slashes, even on Windows.
 */

import { relative, extname } from 'pathe';
import type { LitroRoute } from '../types/route.js';

// ---------------------------------------------------------------------------
// Segment transformation
// ---------------------------------------------------------------------------

/**
 * Transforms a single file-path segment into its route-path equivalent.
 *
 * Conversion table:
 *   index            → '' (stripped — represents parent route)
 *   [param]          → :param
 *   [...param]       → :param(.*)* (catch-all)
 *   [[param]]        → :param? (optional)
 *   anything else    → unchanged (static segment)
 */
function transformSegment(segment: string): string {
  // Catch-all: [...param] → :param(.*)* — must be tested before single-bracket
  const catchAllMatch = segment.match(/^\[\.\.\.(.+)\]$/);
  if (catchAllMatch) {
    return `:${catchAllMatch[1]}(.*)*`;
  }

  // Optional: [[param]] → :param?
  const optionalMatch = segment.match(/^\[\[(.+)\]\]$/);
  if (optionalMatch) {
    return `:${optionalMatch[1]}?`;
  }

  // Dynamic: [param] → :param
  const dynamicMatch = segment.match(/^\[(.+)\]$/);
  if (dynamicMatch) {
    return `:${dynamicMatch[1]}`;
  }

  // index → '' (stripped by the caller)
  if (segment === 'index') {
    return '';
  }

  return segment;
}

/**
 * Returns true if a transformed route segment is dynamic (starts with ':')
 * or is a catch-all (contains '(.*)').
 */
function isSegmentDynamic(transformed: string): boolean {
  return transformed.startsWith(':');
}

/**
 * Returns true if a transformed route segment is a catch-all.
 */
function isSegmentCatchAll(transformed: string): boolean {
  return transformed.includes('(.*)');
}

// ---------------------------------------------------------------------------
// fileToRoute
// ---------------------------------------------------------------------------

/**
 * Converts an absolute page file path to a LitroRoute.
 *
 * @param filePath  Absolute path to the page file (e.g. '/app/pages/blog/[slug].ts')
 * @param pagesDir  Absolute path to the pages directory (e.g. '/app/pages')
 * @returns         A fully resolved LitroRoute
 *
 * Examples:
 *   pages/index.ts             → path: '/'
 *   pages/about.ts             → path: '/about'
 *   pages/blog/index.ts        → path: '/blog'
 *   pages/blog/[slug].ts       → path: '/blog/:slug'
 *   pages/[...all].ts          → path: '/:all(.*)*'
 *   pages/[[lang]]/index.ts    → path: '/:lang?'
 *   pages/users/[id]/posts.ts  → path: '/users/:id/posts'
 */
export function fileToRoute(filePath: string, pagesDir: string): LitroRoute {
  // Step 1: get the path relative to pagesDir, without extension
  const ext = extname(filePath);
  const relWithExt = relative(pagesDir, filePath);
  // Strip the extension (.ts or .tsx)
  const rel = relWithExt.slice(0, relWithExt.length - ext.length);

  // Step 2: split into segments
  const rawSegments = rel.split('/');

  // Step 3: transform each segment
  const transformedSegments = rawSegments.map(transformSegment);

  // Step 4: remove empty strings that resulted from `index` transformation,
  // but only if the result would not be completely empty (root index stays '').
  // Filter strategy: remove trailing empty if we have other segments; keep one
  // leading empty to form an absolute path when joined.
  const filteredSegments = transformedSegments.filter((seg, i) => {
    // Always keep non-empty segments
    if (seg !== '') return true;
    // Empty segment from 'index': drop it only if there are other non-empty
    // segments (e.g. blog/index → ['blog', ''] → ['blog'])
    const otherNonEmpty = transformedSegments.some((s, j) => j !== i && s !== '');
    return !otherNonEmpty;
  });

  // Step 5: build the path
  const path = '/' + filteredSegments.filter(s => s !== '').join('/');

  // Step 6: determine flags
  const isDynamic = transformedSegments.some(isSegmentDynamic);
  const isCatchAll = transformedSegments.some(isSegmentCatchAll);

  // Step 7: derive component tag
  const componentTag = fileToComponentTag(filePath, pagesDir);

  return {
    path,
    filePath,
    componentTag,
    isDynamic,
    isCatchAll,
  };
}

// ---------------------------------------------------------------------------
// fileToComponentTag
// ---------------------------------------------------------------------------

/**
 * Derives a valid custom element tag name from a page file path.
 *
 * Custom element names MUST be hyphenated. The 'page-' prefix ensures this
 * even for single-segment files like `about.ts`.
 *
 * Conversion rules:
 *   - Strip pagesDir prefix and extension
 *   - Remove bracket characters and leading dots from dynamic segment names
 *   - Replace path separators (/) with hyphens
 *   - Replace underscores with hyphens
 *   - Lowercase everything
 *   - index at the end → 'home' (for pages/index.ts → 'page-home')
 *   - Collapse consecutive hyphens
 *   - Prepend 'page-'
 *
 * Examples:
 *   pages/index.ts           → page-home
 *   pages/about.ts           → page-about
 *   pages/blog/index.ts      → page-blog
 *   pages/blog/[slug].ts     → page-blog-slug
 *   pages/[...all].ts        → page-all
 *   pages/[[lang]]/index.ts  → page-lang
 */
export function fileToComponentTag(filePath: string, pagesDir: string): string {
  const ext = extname(filePath);
  const relWithExt = relative(pagesDir, filePath);
  const rel = relWithExt.slice(0, relWithExt.length - ext.length);

  // Split into segments
  const segments = rel.split('/');

  // Strip special characters from each segment to get a clean identifier:
  // Remove brackets ([, ], ...), but keep the param name inside.
  const cleaned = segments
    .map(seg =>
      seg
        .replace(/\[\.\.\.(.+)\]/, '$1') // [...param] → param
        .replace(/\[\[(.+)\]\]/, '$1')   // [[param]] → param
        .replace(/\[(.+)\]/, '$1')       // [param] → param
        .replace(/[^a-z0-9-]/gi, '-')    // replace non-alphanumeric-hyphen with hyphen
        .toLowerCase()
    )
    .filter(Boolean);

  // Handle the root index case: ['index'] → 'home'
  if (cleaned.length === 1 && cleaned[0] === 'index') {
    return 'page-home';
  }

  // Remove trailing 'index' segments (blog/index → blog)
  while (cleaned.length > 1 && cleaned[cleaned.length - 1] === 'index') {
    cleaned.pop();
  }

  // Join with hyphens and collapse consecutive hyphens
  const tagBody = cleaned.join('-').replace(/-{2,}/g, '-').replace(/^-|-$/g, '');

  return `page-${tagBody}`;
}

// ---------------------------------------------------------------------------
// compareRoutes
// ---------------------------------------------------------------------------

/**
 * Comparator for sorting LitroRoute arrays.
 *
 * Sort order (ascending specificity, i.e. most specific first):
 *   1. Static routes  (isDynamic: false, isCatchAll: false)
 *   2. Dynamic routes (isDynamic: true,  isCatchAll: false)
 *   3. Catch-all routes (isCatchAll: true)
 *
 * Within each tier, routes are sorted lexicographically by path.
 *
 * This mirrors the Nitro/h3 router's own priority: static wins over params,
 * params win over catch-all.
 */
export function compareRoutes(a: LitroRoute, b: LitroRoute): number {
  const tier = (r: LitroRoute): number => {
    if (r.isCatchAll) return 2;
    if (r.isDynamic) return 1;
    return 0;
  };

  const diff = tier(a) - tier(b);
  if (diff !== 0) return diff;

  // Within the same tier, sort lexicographically by path so the order is stable
  return a.path < b.path ? -1 : a.path > b.path ? 1 : 0;
}
