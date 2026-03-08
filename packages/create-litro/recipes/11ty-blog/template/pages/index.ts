import { html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { LitroPage } from 'litro/runtime';
import { definePageData } from 'litro';
import type { Post } from 'litro:content';
import { getPosts, getGlobalData } from 'litro:content';

export interface HomeData {
  recentPosts: Post[];
  siteTitle: string;
  siteDescription: string;
}

function toDate(d: Date | string): Date { return d instanceof Date ? d : new Date(d as string); }

export const pageData = definePageData(async (_event) => {
  const [recentPosts, metadata] = await Promise.all([
    getPosts({ limit: 5 }),
    getGlobalData(),
  ]);
  return {
    recentPosts,
    siteTitle: String(metadata.title ?? '{{projectName}}'),
    siteDescription: String(metadata.description ?? ''),
  } satisfies HomeData;
});

@customElement('page-home')
export class HomePage extends LitroPage {
  @state() declare serverData: HomeData | null;

  render() {
    const { recentPosts = [], siteTitle = '{{projectName}}', siteDescription = '' } = this.serverData ?? {};
    return html`
      <main>
        <header>
          <h1>${siteTitle}</h1>
          ${siteDescription ? html`<p>${siteDescription}</p>` : ''}
        </header>
        <section>
          <h2>Recent Posts</h2>
          <ul>
            ${recentPosts.map(post => html`
              <li>
                <a href="${post.url}">${post.title}</a>
                <time datetime="${toDate(post.date).toISOString()}">${toDate(post.date).toLocaleDateString()}</time>
                ${post.description ? html`<p>${post.description}</p>` : ''}
              </li>
            `)}
          </ul>
          <p><a href="/blog">All Posts →</a></p>
        </section>
      </main>
    `;
  }
}

export default HomePage;
