import { defineEventHandler, setResponseHeader } from 'h3';
import { getPosts } from 'litro:content';

const SITE_URL = (process.env.SITE_URL ?? 'https://litro.dev').replace(/\/$/, '');

// Static routes that are always present. Blog posts are added dynamically.
const STATIC_ROUTES: Array<{ path: string; priority: string }> = [
  { path: '/', priority: '1.0' },
  { path: '/why-web-components', priority: '0.9' },
  { path: '/compare/nextjs', priority: '0.9' },
  { path: '/compare/nuxt', priority: '0.9' },
  { path: '/compare/enhance', priority: '0.9' },
  { path: '/blog', priority: '0.8' },
  { path: '/docs/introduction', priority: '0.8' },
  { path: '/docs/getting-started', priority: '0.8' },
  { path: '/docs/configuration', priority: '0.8' },
  { path: '/docs/core-concepts/routing', priority: '0.8' },
  { path: '/docs/core-concepts/ssr', priority: '0.8' },
  { path: '/docs/core-concepts/data-fetching', priority: '0.8' },
  { path: '/docs/core-concepts/client-router', priority: '0.8' },
  { path: '/docs/api-routes', priority: '0.8' },
  { path: '/docs/content-layer', priority: '0.8' },
  { path: '/docs/ssg', priority: '0.8' },
  { path: '/docs/litro-router', priority: '0.8' },
  { path: '/docs/recipes/fullstack', priority: '0.8' },
  { path: '/docs/recipes/11ty-blog', priority: '0.8' },
  { path: '/docs/recipes/starlight', priority: '0.8' },
  { path: '/docs/deployment/github-pages', priority: '0.8' },
  { path: '/docs/deployment/coolify', priority: '0.8' },
  { path: '/docs/migrate/from-nextjs', priority: '0.8' },
  { path: '/docs/migrate/from-nuxt', priority: '0.8' },
  { path: '/docs/migrate/from-react', priority: '0.8' },
  { path: '/docs/migrate/from-react-to-fast', priority: '0.8' },
  { path: '/docs/migrate/from-react-to-elena', priority: '0.8' },
  { path: '/docs/adapters/overview', priority: '0.8' },
  { path: '/docs/adapters/lit', priority: '0.8' },
  { path: '/docs/adapters/fast', priority: '0.8' },
  { path: '/docs/adapters/elena', priority: '0.8' },
  { path: '/docs/adapters/switching', priority: '0.8' },
  { path: '/docs/contributing', priority: '0.6' },
  { path: '/docs/packages/litro', priority: '0.6' },
  { path: '/docs/packages/litro-router', priority: '0.6' },
  { path: '/docs/packages/create-litro', priority: '0.6' },
];

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'content-type', 'application/xml; charset=utf-8');

  const allPosts = await getPosts();
  const blogPosts = allPosts.filter(p => p.url.startsWith('/content/blog/'));

  const staticEntries = STATIC_ROUTES.map(({ path, priority }) => `
  <url>
    <loc>${SITE_URL}${path}</loc>
    <changefreq>${path === '/' ? 'weekly' : 'monthly'}</changefreq>
    <priority>${priority}</priority>
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
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${staticEntries.join('')}${blogEntries.join('')}
</urlset>`;
});
