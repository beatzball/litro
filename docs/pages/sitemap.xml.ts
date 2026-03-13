import { defineEventHandler, setResponseHeader } from 'h3';

const SITE_URL = (process.env.SITE_URL ?? 'https://litro.dev').replace(/\/$/, '');

// Static route list — generated at build time by the SSG plugin.
// For the docs site we enumerate known routes directly.
const STATIC_ROUTES = [
  '/',
  '/blog',
  '/docs/introduction',
  '/docs/getting-started',
  '/docs/configuration',
  '/docs/core-concepts/routing',
  '/docs/core-concepts/ssr',
  '/docs/core-concepts/data-fetching',
  '/docs/core-concepts/client-router',
  '/docs/api-routes',
  '/docs/content-layer',
  '/docs/ssg',
  '/docs/litro-router',
  '/docs/recipes/fullstack',
  '/docs/recipes/11ty-blog',
  '/docs/recipes/starlight',
  '/docs/deployment/github-pages',
  '/docs/deployment/coolify',
  '/docs/contributing',
  '/docs/packages/litro',
  '/docs/packages/litro-router',
  '/docs/packages/create-litro',
];

export default defineEventHandler((event) => {
  setResponseHeader(event, 'content-type', 'application/xml; charset=utf-8');

  const urlEntries = STATIC_ROUTES.map(path => `
  <url>
    <loc>${SITE_URL}${path}</loc>
    <changefreq>weekly</changefreq>
    <priority>${path === '/' ? '1.0' : '0.8'}</priority>
  </url>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urlEntries}
</urlset>`;
});
