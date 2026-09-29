import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import '../../src/components/litro-footer.js';

@customElement('page-blog')
export class BlogPage extends LitElement {
  render() {
    // TEMPLATE NOTE — the note below was an HTML comment in the template. An
    // HTML comment is served to every reader, so the prose lives here, named by
    // the element it belongs to.
    //
    // <litro-footer recipe="{{recipe}}"></litro-footer>
    //     Credit line. Delete this element if you would rather not carry it.
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
      <litro-footer recipe="{{recipe}}"></litro-footer>
    `;
  }
}

export default BlogPage;
