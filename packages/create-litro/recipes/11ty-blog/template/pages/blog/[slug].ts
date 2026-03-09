import { html } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { customElement, state } from 'lit/decorators.js';
import { LitroPage } from '@beatzball/litro/runtime';
import { definePageData } from '@beatzball/litro';
import { createError } from 'h3';
import type { Post } from 'litro:content';
import { getPost, getPosts } from 'litro:content';

export interface PostData {
  post: Post;
}

function toDate(d: Date | string): Date { return d instanceof Date ? d : new Date(d as string); }

export const pageData = definePageData(async (event) => {
  const slug = event.context.params?.slug ?? '';
  const post = await getPost(slug);
  if (!post) {
    throw createError({ statusCode: 404, message: `Post not found: ${slug}` });
  }
  return { post } satisfies PostData;
});

export async function generateRoutes(): Promise<string[]> {
  const posts = await getPosts();
  return posts.map(post => post.url);
}

@customElement('page-blog-slug')
export class BlogPostPage extends LitroPage {
  @state() declare serverData: PostData | null;

  render() {
    const { post } = this.serverData ?? {};
    if (!post) return html`<p>Loading…</p>`;
    return html`
      <article>
        <header>
          <h1>${post.title}</h1>
          <time datetime="${toDate(post.date).toISOString()}">${toDate(post.date).toLocaleDateString()}</time>
          ${post.tags.length > 0 ? html`
            <ul class="tags">
              ${post.tags.map(tag => html`
                <li><a href="/tags/${tag}">#${tag}</a></li>
              `)}
            </ul>
          ` : ''}
        </header>
        <div class="post-body">
          <!-- unsafeHTML renders the Markdown-generated HTML directly.
               The content directory is trusted-author-only; do not place
               user-submitted or untrusted content here without first
               sanitizing with a library such as rehype-sanitize. -->
          ${unsafeHTML(post.body)}
        </div>
        <footer>
          <a href="/blog">← Back to Blog</a>
        </footer>
      </article>
    `;
  }
}

export default BlogPostPage;
