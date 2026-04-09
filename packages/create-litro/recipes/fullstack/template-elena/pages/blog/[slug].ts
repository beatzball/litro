import { html } from '@elenajs/core';
import { LitroPage } from '@beatzball/litro/adapter/elena/page';
import { definePageData } from '@beatzball/litro';
import type { LitroLocation } from '@beatzball/litro-router';

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

export class BlogPostPage extends LitroPage {
  static override tagName = 'page-blog-slug';

  // Called by LitroRouter on client-side navigation to fetch data for the new slug.
  override async fetchData(location: LitroLocation): Promise<PostData> {
    const slug = location.params['slug'] ?? '';
    return {
      slug,
      title: `Post: ${slug}`,
      content: `This is the content for the "${slug}" post.`,
    };
  }

  render() {
    const data = this.serverData as PostData | null;
    return html`
      <article>
        <h1>${data?.title ?? 'Loading\u2026'}</h1>
        <p>${data?.content ?? ''}</p>
        <litro-link href="/blog">\u2190 Back to Blog</litro-link>
        \u00a0|\u00a0
        <litro-link href="/">\u2190 Home</litro-link>
      </article>
    `;
  }
}

BlogPostPage.define();

export default BlogPostPage;
