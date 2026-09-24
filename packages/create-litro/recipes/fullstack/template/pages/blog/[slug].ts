import { css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { LitroPage } from '@beatzball/litro/runtime';
import { definePageData } from '@beatzball/litro';
import type { LitroLocation } from '@beatzball/litro-router';
import '../../src/components/litro-footer.js';

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
export class BlogPostPage extends LitroPage {
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
        <h1>${data?.title ?? 'Loading…'}</h1>
        <p>${data?.content ?? ''}</p>
        <litro-link href="/blog">← Back to Blog</litro-link>
        &nbsp;|&nbsp;
        <litro-link href="/">← Home</litro-link>
      </article>
      <!-- Credit line. Delete this element if you would rather not carry it. -->
      <litro-footer recipe="{{recipe}}"></litro-footer>
    `;
  }
}

export default BlogPostPage;
