import { html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { LitroPage } from 'litro/runtime';
import { definePageData } from 'litro';
import type { Post } from 'litro:content';
import { getPosts, getTags } from 'litro:content';

export interface TagData {
  tag: string;
  posts: Post[];
}

function toDate(d: Date | string): Date { return d instanceof Date ? d : new Date(d as string); }

export const pageData = definePageData(async (event) => {
  const tag = event.context.params?.tag ?? '';
  const posts = await getPosts({ tag });
  return { tag, posts } satisfies TagData;
});

export async function generateRoutes(): Promise<string[]> {
  const tags = await getTags();
  return tags.map(tag => `/tags/${tag}`);
}

@customElement('page-tags-tag')
export class TagPage extends LitroPage {
  @state() declare serverData: TagData | null;

  render() {
    const { tag = '', posts = [] } = this.serverData ?? {};
    return html`
      <main>
        <h1>Posts tagged: #${tag}</h1>
        <ul>
          ${posts.map(post => html`
            <li>
              <a href="${post.url}">${post.title}</a>
              <time datetime="${toDate(post.date).toISOString()}">${toDate(post.date).toLocaleDateString()}</time>
            </li>
          `)}
        </ul>
        <p>
          <a href="/blog">← All Posts</a>
          &nbsp;|&nbsp;
          <a href="/">← Home</a>
        </p>
      </main>
    `;
  }
}

export default TagPage;
