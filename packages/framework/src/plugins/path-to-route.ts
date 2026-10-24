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

/** What kind of route segment a file-path segment turned into. */
type SegmentKind = 'static' | 'index' | 'dynamic' | 'optional' | 'catch-all';

interface TransformedSegment {
  /** The route-path spelling of the segment ('' for `index`). */
  value: string;
  kind: SegmentKind;
}

/**
 * Characters a prefix before the bracket may use.
 *
 * Found by testing, not by reading specs: every printable ASCII character was
 * put in front of a param (`/x<c>:id`) and run through native `URLPattern`,
 * the router's own fallback for browsers without it, and the server builder
 * in `server/routes/[...].ts`. These are the only characters for which all
 * three construct, capture the param, and refuse a decoy URL. The rest fail:
 *
 *   ( ) { } ? + :   native URLPattern throws, which kills every client route
 *   *               native URLPattern reads it as a wildcard
 *   . | $ [         the router fallback reads them as regex syntax
 *   space " < > ^ ` and non-ASCII
 *                   the request URL percent-encodes them, so the server
 *                   never sees the literal character
 *   # ? \           the URL parser treats them as a fragment, a query, or /
 *   %               passed the probe, but "%" + two hex digits is an escape
 *
 * The test "every prefix the scanner accepts matches the same URL in
 * URLPattern and in the server matcher" fails if this set grows a character
 * that breaks either matcher.
 */
const SAFE_PREFIX = /^[A-Za-z0-9_~@!&',;=-]*$/;

/** Where a segment came from, so an error can name the real file. */
interface SegmentSource {
  /** The page file as the author sees it, e.g. `pages/@[...all].tsx`. */
  file: string;
  /** The file's extension, e.g. `.tsx`. */
  ext: string;
}

/**
 * Transforms a single file-path segment into its route-path equivalent.
 *
 * Conversion table:
 *   index            → '' (stripped — represents parent route)
 *   [param]          → :param
 *   prefix[param]    → prefix:param   (e.g. @[handle] → @:handle)
 *   [...param]       → :param(.*)* (catch-all)
 *   [[param]]        → :param? (optional)
 *   anything else    → unchanged (static segment)
 *
 * Deliberately NOT supported (issue 234):
 *   [param]suffix    → the two matchers disagree. `:idsuffix` swallows the
 *                      suffix into the param name, and the URLPattern spelling
 *                      `:id{suffix}` throws inside each app's own
 *                      server/routes/[...].ts regex builder, which the
 *                      framework cannot upgrade. Rejected at scan time.
 *                      Tracked in issue 248.
 *   prefix[...param] → `@:...all` is not a valid param name anywhere.
 *   prefix[[param]]  → same. Both are rejected at scan time.
 *   a prefix with a character outside SAFE_PREFIX → rejected at scan time.
 *
 * @param segment  One file-path segment, extension already stripped.
 * @param source   The page file, for error messages.
 */
function transformSegment(segment: string, source: SegmentSource): TransformedSegment {
  // BRANCH ORDER IS LOAD-BEARING. DO NOT REORDER.
  //
  // The dynamic branch below accepts any single bracket pair with an optional
  // prefix, so on its own it turns `[...all]` into `:...all` and leaves
  // `[[lang]]` alone. Catch-all and optional come out right only because
  // their branches run first. The test "catch-all and optional win over the
  // prefixed dynamic branch because branch order is load-bearing" in
  // __tests__/path-to-route.test.ts fails if this order changes.

  // Catch-all: [...param] → :param(.*)*
  const catchAllMatch = segment.match(/^\[\.\.\.(.+)\]$/);
  if (catchAllMatch) {
    return { value: `:${catchAllMatch[1]}(.*)*`, kind: 'catch-all' };
  }

  // Optional: [[param]] → :param?
  const optionalMatch = segment.match(/^\[\[(.+)\]\]$/);
  if (optionalMatch) {
    return { value: `:${optionalMatch[1]}?`, kind: 'optional' };
  }

  // Dynamic with an optional prefix: prefix[param] → prefix:param
  // (suffix deliberately not supported, see above)
  //
  // A param name that starts with '...' can only be a PREFIXED catch-all
  // (`@[...all]`): the bare form already matched above. It must not become
  // `@:...all`, so it falls through to the rejection below.
  const dynamicMatch = segment.match(/^([^\[\]]*)\[([^\[\]]+)\]$/);
  if (dynamicMatch && !dynamicMatch[2].startsWith('...')) {
    const [, prefix, param] = dynamicMatch;
    if (!SAFE_PREFIX.test(prefix)) {
      throw new Error(unsafePrefixMessage(prefix, param, source));
    }
    return { value: `${prefix}:${param}`, kind: 'dynamic' };
  }

  // Anything else that still carries a bracket is a dynamic form this scanner
  // does not support. Say so now: left alone it would scan as a static path
  // the author never wanted, and an SSG build would try to prerender it.
  if (/[\[\]]/.test(segment)) {
    throw new Error(unsupportedBracketMessage(segment, source));
  }

  // index → '' (stripped by the caller)
  if (segment === 'index') {
    return { value: '', kind: 'index' };
  }

  return { value: segment, kind: 'static' };
}

/** Appended to errors a non-page file in pages/ is likely to raise. */
const NOT_A_PAGE_HINT =
  `If this file is not a page (a story, a fixture, a helper), move it out of ` +
  `pages/ or start its name with "-", which the scanner skips.`;

/**
 * Builds the error for a prefix that one of the matchers cannot take.
 * Names the file and the characters, and says what a prefix may contain.
 */
function unsafePrefixMessage(prefix: string, param: string, { file, ext }: SegmentSource): string {
  const bad = [...new Set([...prefix].filter(c => !SAFE_PREFIX.test(c)))]
    .map(c => JSON.stringify(c))
    .join(', ');
  return (
    `[litro] ${file}: the prefix "${prefix}" before [${param}] contains ${bad}, ` +
    `which the client router (URLPattern) or the server route matcher reads as ` +
    `pattern syntax or receives percent-encoded. A prefix may use letters, digits ` +
    `and _ ~ @ ! & ' , ; = - only. Rename the file, for example to [${param}]${ext}.`
  );
}

/**
 * Builds the error for a bracket segment the scanner cannot turn into a route.
 * Names the file and says what to rename it to.
 */
function unsupportedBracketMessage(segment: string, { file, ext }: SegmentSource): string {
  const prefixedCatchAll = segment.match(/^([^\[\]]+)\[\.\.\.(.+)\]$/);
  if (prefixedCatchAll) {
    return (
      `[litro] ${file}: a catch-all segment cannot carry a prefix. ` +
      `Drop the "${prefixedCatchAll[1]}" and name the file [...${prefixedCatchAll[2]}]${ext}.`
    );
  }
  const prefixedOptional = segment.match(/^([^\[\]]+)\[\[(.+)\]\]$/);
  if (prefixedOptional) {
    return (
      `[litro] ${file}: an optional segment cannot carry a prefix. ` +
      `Drop the "${prefixedOptional[1]}" and name the file [[${prefixedOptional[2]}]]${ext}.`
    );
  }
  const suffixed = segment.match(/^([^\[\]]*)\[([^\[\]]+)\]([^\[\]]+)$/);
  if (suffixed) {
    return (
      `[litro] ${file}: a dynamic segment cannot carry a suffix after the bracket. ` +
      `The suffix form ("${suffixed[3]}") is not supported (tracked in issue 248). ` +
      `A prefix is: rename the file to ${suffixed[1]}[${suffixed[2]}]${ext}, ` +
      `or move the suffix into a nested folder. ${NOT_A_PAGE_HINT}`
    );
  }
  return (
    `[litro] ${file}: "${segment}" is not a route segment Litro understands. ` +
    `Supported forms: [param], prefix[param], [...param], [[param]]. ${NOT_A_PAGE_HINT}`
  );
}

/**
 * Returns true if a transformed route segment carries a param: a dynamic
 * segment (with or without a prefix), an optional segment, or a catch-all.
 *
 * Decided from the segment's kind, not from its spelling. The old check
 * `startsWith(':')` missed `@:handle`, and the suggested `/:[A-Za-z_]/` would
 * promote a static segment that happens to contain a colon (`foo:bar`) into
 * the dynamic tier, where the server would turn `:bar` into a param.
 */
function isSegmentDynamic(seg: TransformedSegment): boolean {
  return seg.kind === 'dynamic' || seg.kind === 'optional' || seg.kind === 'catch-all';
}

/**
 * Returns true if a transformed route segment is a catch-all.
 */
function isSegmentCatchAll(seg: TransformedSegment): boolean {
  return seg.kind === 'catch-all';
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
 * @throws          When a segment carries a bracket in a form the scanner does
 *                  not support (prefixed catch-all or optional, any suffix, or
 *                  a prefix with a character outside SAFE_PREFIX).
 *
 * Examples:
 *   pages/index.ts             → path: '/'
 *   pages/about.ts             → path: '/about'
 *   pages/blog/index.ts        → path: '/blog'
 *   pages/blog/[slug].ts       → path: '/blog/:slug'
 *   pages/@[handle].ts         → path: '/@:handle'
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
  const source: SegmentSource = { file: `pages/${relWithExt}`, ext };
  const transformed = rawSegments.map(seg => transformSegment(seg, source));
  const transformedSegments = transformed.map(t => t.value);

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
  const isDynamic = transformed.some(isSegmentDynamic);
  const isCatchAll = transformed.some(isSegmentCatchAll);

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
 *   pages/@[handle].ts       → page-handle (the @ becomes a hyphen, then the
 *                              leading hyphen is stripped)
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
 * Within the dynamic tier, a route with more literal text sorts first, so
 * `/@:handle` beats `/:slug`. Ties, and the other two tiers, are sorted
 * lexicographically by path.
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

  // Within the dynamic tier, the route that carries more literal text sorts
  // first. Both matchers take the FIRST route that matches, so without this
  // `/:slug` would sort before `/@:handle` (':' is 0x3A, '@' is 0x40) and
  // swallow every `/@alice` request. A literal prefix is strictly more
  // specific than a bare param. The same holds on a later segment
  // (`/:a/@:b` before `/:a/:b`) and across two segments (`/@:handle/:id`
  // before `/:slug/:id`).
  if (tier(a) === 1) {
    const lit = literalLength(b) - literalLength(a);
    if (lit !== 0) return lit;
  }

  // Otherwise sort lexicographically by path so the order is stable
  return a.path < b.path ? -1 : a.path > b.path ? 1 : 0;
}

/**
 * Counts the characters of a route path that are not part of a param token.
 * Uses the same token rule as the server builder (`:` up to the next `/`), so
 * `/@:handle/:id` counts `/@/` (3) and `/:slug/:id` counts `//` (2).
 */
function literalLength(route: LitroRoute): number {
  return route.path.replace(/:[^/]+/g, '').length;
}

// ---------------------------------------------------------------------------
// assertUniqueComponentTags
// ---------------------------------------------------------------------------

/**
 * Throws when two or more routes derive the same `componentTag`.
 *
 * Component tags are filename-derived, and the page manifest imports every
 * page module statically. Two pages that derive the same tag both call
 * `customElements.define()` with it at module evaluation, before any request
 * is served, and the server dies with "the name has already been used with
 * this registry". The known pair is `pages/index.ts` (the root index is
 * special-cased to `page-home`) next to `pages/home.ts`.
 *
 * The message names the tag and every page file that claims it, as
 * root-relative paths, one per line and sorted so the output is stable across
 * runs and platforms. Several colliding tags are reported in one error.
 *
 * @param routes   Routes produced by `fileToRoute` for every page file
 * @param rootDir  Project root, used to print root-relative paths
 */
export function assertUniqueComponentTags(routes: LitroRoute[], rootDir: string): void {
  const byTag = new Map<string, string[]>();
  for (const route of routes) {
    const bucket = byTag.get(route.componentTag);
    if (bucket) bucket.push(route.filePath);
    else byTag.set(route.componentTag, [route.filePath]);
  }

  const blocks: string[] = [];
  for (const [tag, files] of [...byTag].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    if (files.length < 2) continue;
    const listed = files
      .map(f => relative(rootDir, f))
      .sort()
      .map(f => `  ${f}`)
      .join('\n');
    blocks.push(
      `Page component tags are filename-derived and must be unique across pages/; ` +
        `"${tag}" is claimed by ${files.length} files:\n${listed}`,
    );
  }

  if (blocks.length === 0) return;

  throw new Error(
    `${blocks.join('\n\n')}\n` +
      `Rename one of these files so each page derives its own tag.`,
  );
}
