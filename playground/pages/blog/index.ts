/**
 * Blog index page — playground/pages/blog/index.ts
 *
 * Route: /blog
 *
 * This is a static route. The pages plugin (I-2) automatically adds it to
 * nitro.options.prerender.routes for SSG builds — no generateRoutes() needed.
 *
 * The links here use <litro-link> (a client-side SPA router link component)
 * so that navigation between blog posts does not trigger a full page reload.
 * During SSG, Nitro's crawlLinks option will also pick up the <a> elements
 * rendered by <litro-link> in the prerendered HTML, potentially adding them
 * to the prerender queue (though generateRoutes is the explicit, reliable
 * mechanism for dynamic routes).
 */

import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';

@customElement('page-blog')
export class BlogIndexPage extends LitElement {
  render() {
    return html`
      <main>
        <h1>Blog</h1>
        <p>Welcome to the Litro blog. Choose a post below:</p>
        <ul>
          <li><litro-link href="/blog/hello-world">Hello World</litro-link></li>
          <li><litro-link href="/blog/getting-started">Getting Started</litro-link></li>
          <li><litro-link href="/blog/about-litro">About Litro</litro-link></li>
        </ul>
        <litro-link href="/">← Back Home</litro-link>
      </main>
    `;
  }
}

export default BlogIndexPage;
