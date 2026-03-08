import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';

@customElement('page-blog')
export class BlogPage extends LitElement {
  render() {
    return html`
      <main>
        <h1>Blog</h1>
        <p>Choose a post:</p>
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

export default BlogPage;
