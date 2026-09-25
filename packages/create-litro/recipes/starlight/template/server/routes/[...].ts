import { defineEventHandler, setResponseHeader, setResponseStatus, getRequestURL } from 'h3';
import { createPageHandler } from '@beatzball/litro/runtime/create-page-handler.js';
import { DEFAULT_SKIP_LINKS, normalizePathname } from '@beatzball/litro';
import type { LitroRoute } from '@beatzball/litro';
import { routes, pageModules } from '#litro/page-manifest';

function matchRoute(
  pathname: string,
): { route: LitroRoute; params: Record<string, string> } | undefined {
  for (const route of routes) {
    if (route.isCatchAll) return { route, params: {} };

    if (!route.isDynamic) {
      if (pathname === route.path) return { route, params: {} };
      continue;
    }

    const regexStr =
      '^' +
      route.path
        .replace(/:([^/]+)\(\.\*\)\*/g, '(?<$1>.+)')
        .replace(/:([^/?]+)\?/g, '(?<$1>[^/]*)?')
        .replace(/:([^/]+)/g, '(?<$1>[^/]+)') +
      '$';

    try {
      const match = pathname.match(new RegExp(regexStr));
      if (match) return { route, params: (match.groups ?? {}) as Record<string, string> };
    } catch {
      // malformed pattern — skip
    }
  }
  return undefined;
}

export default defineEventHandler(async (event) => {
  // Canonicalize before matching: '/docs/a/' and '/docs/a' are one page.
  // The client router strips the same trailing slash, so both halves agree
  // (issue 203). A mismatch renders a blank 200 page, not an error.
  const pathname = normalizePathname(getRequestURL(event).pathname);
  const result = matchRoute(pathname);

  if (!result) {
    // A miss has to say 404 in the status, not only in the body. Without
    // this the 404 page goes out 200 OK, so crawlers index it and a
    // prerender counts it as a real page.
    setResponseStatus(event, 404);
    setResponseHeader(event, 'content-type', 'text/html; charset=utf-8');
    return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8" /><title>404</title></head>
<body><h1>404 — Not Found</h1><p>No page matched <code>${pathname}</code>.</p></body>
</html>`;
  }

  const { route: matched, params } = result;
  event.context.params = { ...event.context.params, ...params };

  const mod = pageModules[matched.filePath];
  const handler = createPageHandler({
    route: matched,
    routeMeta: (mod?.routeMeta as { title?: string; head?: string } | undefined),
    pageModule: mod,
    skipLinks: [
      ...DEFAULT_SKIP_LINKS,
      { label: 'Skip to navigation', href: '#_litro_nav' },
    ],
  });
  return handler(event);
});
