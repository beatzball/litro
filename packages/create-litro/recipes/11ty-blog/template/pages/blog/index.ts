import { html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { LitroPage } from 'litro/runtime';
import { definePageData } from 'litro';
import type { Post } from 'litro:content';
import { getPosts } from 'litro:content';

export interface BlogIndexData {
  posts: Post[];
}

function toDate(d: Date | string): Date { return d instanceof Date ? d : new Date(d as string); }

export const pageData = definePageData(async (_event) => {
  const posts = await getPosts();
  return { posts } satisfies BlogIndexData;
});

@customElement('page-blog')
export class BlogIndexPage extends LitroPage {
  @state() declare serverData: BlogIndexData | null;

  render() {
    const { posts = [] } = this.serverData ?? {};
    return html`
      <main>
        <h1>Blog</h1>
        <ul>
          ${posts.map(post => html`
            <li>
              <a href="${post.url}">${post.title}</a>
              <time datetime="${toDate(post.date).toISOString()}">${toDate(post.date).toLocaleDateString()}</time>
              ${post.description ? html`<p>${post.description}</p>` : ''}
            </li>
          `)}
        </ul>
        <a href="/">← Home</a>
      </main>
    `;
  }
}

export default BlogIndexPage;
