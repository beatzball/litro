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

import { LitElement, css, html } from 'lit';
import { customElement } from 'lit/decorators.js';

@customElement('page-blog')
export class BlogIndexPage extends LitElement {
  static override styles = css`
    /* A document stylesheet stops at this shadow boundary, so the box-sizing
       reset has to be repeated inside it. Without it a padded full-width box
       measures its width PLUS its gutters, and a phone scrolls sideways by
       exactly the gutter.
       See .agents/rules/adapters-ssr.md (SSR-008). */
    *,
    *::before,
    *::after {
      box-sizing: border-box;
    }

    :host {
      display: block;
    }
  `;

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
