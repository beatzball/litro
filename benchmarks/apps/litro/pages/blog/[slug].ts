import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { LitroPage } from '@beatzball/litro/runtime';
import { definePageData } from '@beatzball/litro';

interface BlogData {
  title: string;
  body: string;
}

export const pageData = definePageData(async (event) => {
  const slug = event.context.params?.slug ?? '';
  if (slug === 'hello') {
    return {
      title: 'Hello World',
      body: 'This is a sample blog post used to benchmark dynamic route handling.',
    } satisfies BlogData;
  }
  throw new Error(`Unknown slug: ${slug}`);
});

export async function generateRoutes(): Promise<string[]> {
  return ['/blog/hello'];
}

@customElement('page-blog-slug')
export class BlogPost extends LitroPage {
  static override properties = { serverData: { state: true } };

  render() {
    const data = this.serverData as BlogData | null;
    return html`
      <h1>${data?.title}</h1>
      <p>${data?.body}</p>
      <a href="/">Back to home</a>
    `;
  }
}

export default BlogPost;
