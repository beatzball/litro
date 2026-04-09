import { Elena, html } from '@elenajs/core';

export class BlogPage extends Elena(HTMLElement) {
  static tagName = 'page-blog';

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
        <litro-link href="/">\u2190 Back Home</litro-link>
      </main>
    `;
  }
}

BlogPage.define();

export default BlogPage;
