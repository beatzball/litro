/**
 * Dynamic blog post page — playground/pages/blog/[slug].ts
 *
 * Route: /blog/:slug
 *
 * This file demonstrates two Litro conventions:
 *   1. `pageData` — server-side data fetching (I-5 convention)
 *   2. `generateRoutes` — SSG path enumeration (I-6 convention)
 *
 * During SSG builds (LITRO_MODE=static), the `litro:ssg` plugin calls
 * `generateRoutes()` and adds each returned path to Nitro's prerender list.
 * The page is then rendered once per path and saved as a static HTML file.
 *
 * During SSR builds (default), `generateRoutes` is ignored. The page is
 * rendered on demand for any :slug value by the catch-all Nitro handler.
 */

import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { definePageData } from 'litro';

// ---------------------------------------------------------------------------
// Server-side data fetching
// ---------------------------------------------------------------------------

/**
 * pageData is called server-side per request (SSR) or per path (SSG).
 * The result is serialized into <script type="application/json" id="__litro_data__">
 * in the page shell and read client-side via getServerData().
 */
export const pageData = definePageData(async (event) => {
  const slug = event.context.params?.slug ?? '';
  return {
    slug,
    title: `Post: ${slug}`,
    content: `Content for ${slug}`,
  };
});

// ---------------------------------------------------------------------------
// SSG: generateRoutes
// ---------------------------------------------------------------------------

/**
 * Returns the concrete URL paths to prerender for this dynamic route.
 *
 * Called at build time by the `litro:ssg` plugin (ssg.ts) when
 * LITRO_MODE=static. In real applications, fetch this list from a CMS,
 * database, or flat-file content directory.
 *
 * Contract:
 *   - Return absolute paths (starting with /)
 *   - Must match the route pattern /blog/:slug — no other prefixes
 *   - async is allowed: network/filesystem calls are fine here
 */
export async function generateRoutes(): Promise<string[]> {
  // In a real app: fetch from a CMS or read from the filesystem, e.g.:
  //   const posts = await fetch('https://cms.example.com/api/posts').then(r => r.json());
  //   return posts.map((p: { slug: string }) => `/blog/${p.slug}`);
  return [
    '/blog/hello-world',
    '/blog/getting-started',
    '/blog/about-litro',
  ];
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

@customElement('page-blog-slug')
export class BlogPostPage extends LitElement {
  @property() slug = '';

  render() {
    return html`
      <article>
        <h1>Blog Post: ${this.slug}</h1>
        <p>This is a dynamic blog post page rendered for slug: <strong>${this.slug}</strong>.</p>
        <litro-link href="/blog">← Back to Blog</litro-link>
        &nbsp;|&nbsp;
        <litro-link href="/">← Back Home</litro-link>
      </article>
    `;
  }
}

export default BlogPostPage;
