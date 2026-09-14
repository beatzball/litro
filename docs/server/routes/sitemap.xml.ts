import { defineEventHandler, setResponseHeader } from 'h3';
import { getPosts } from 'litro:content';
import { ALL_PACKAGE_SLUGS } from '@beatzball/litro-docs-ui/src/packages.js';

const SITE_URL = (process.env.SITE_URL ?? 'https://litro.dev').replace(/\/$/, '');

// Static routes that are always present. Docs pages and blog posts are added
// dynamically, from the same sources their page routes build from
// (pages/docs/[...slug].ts and pages/docs/packages/[pkg].ts), so a new doc
// page cannot be left out of the sitemap.
const STATIC_ROUTES: Array<{ path: string; priority: string }> = [
  { path: '/', priority: '1.0' },
  { path: '/why-web-components', priority: '0.9' },
  { path: '/compare/nextjs', priority: '0.9' },
  { path: '/compare/nuxt', priority: '0.9' },
  { path: '/compare/enhance', priority: '0.9' },
  { path: '/blog', priority: '0.8' },
];

// Package pages and the contributing guide rank below the core docs.
function docsPriority(path: string): string {
  return path.startsWith('/docs/packages/') || path === '/docs/contributing' ? '0.6' : '0.8';
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'content-type', 'application/xml; charset=utf-8');

  const allPosts = await getPosts();
  const blogPosts = allPosts.filter(p => p.url.startsWith('/content/blog/'));
  const docsPaths = [
    ...allPosts
      .filter(p => p.url.startsWith('/content/docs/'))
      .map(p => '/docs' + p.url.slice('/content/docs'.length)),
    ...ALL_PACKAGE_SLUGS.map(slug => `/docs/packages/${slug}`),
  ].sort();

  const staticEntries = STATIC_ROUTES.map(({ path, priority }) => `
  <url>
    <loc>${SITE_URL}${path}</loc>
    <changefreq>${path === '/' ? 'weekly' : 'monthly'}</changefreq>
    <priority>${priority}</priority>
  </url>`);

  const docsEntries = docsPaths.map(path => `
  <url>
    <loc>${SITE_URL}${path}</loc>
    <changefreq>monthly</changefreq>
    <priority>${docsPriority(path)}</priority>
  </url>`);

  const blogEntries = blogPosts.map(post => {
    const slug = post.url.slice('/content/blog/'.length);
    const lastmod = post.date ? new Date(post.date).toISOString().slice(0, 10) : '';
    return `
  <url>
    <loc>${SITE_URL}/blog/${slug}</loc>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ''}
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${staticEntries.join('')}${docsEntries.join('')}${blogEntries.join('')}
</urlset>`;
});
