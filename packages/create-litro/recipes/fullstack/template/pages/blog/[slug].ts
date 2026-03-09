import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { definePageData } from '@beatzball/litro';

export interface PostData {
  slug: string;
  title: string;
  content: string;
}

// Runs on the server; event.context.params contains the matched route params.
export const pageData = definePageData(async (event) => {
  const slug = event.context.params?.slug ?? '';
  return {
    slug,
    title: `Post: ${slug}`,
    content: `This is the content for the "${slug}" post.`,
  } satisfies PostData;
});

// Tells the SSG which concrete paths to prerender when LITRO_MODE=static.
export async function generateRoutes(): Promise<string[]> {
  return ['/blog/hello-world', '/blog/getting-started', '/blog/about-litro'];
}

@customElement('page-blog-slug')
export class BlogPostPage extends LitElement {
  @state() declare serverData: PostData | null;

  render() {
    return html`
      <article>
        <h1>${this.serverData?.title ?? 'Loading…'}</h1>
        <p>${this.serverData?.content ?? ''}</p>
        <litro-link href="/blog">← Back to Blog</litro-link>
        &nbsp;|&nbsp;
        <litro-link href="/">← Home</litro-link>
      </article>
    `;
  }
}

export default BlogPostPage;
