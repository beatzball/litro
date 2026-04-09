import { html } from '@elenajs/core';
import { LitroPage } from '@beatzball/litro/adapter/elena/page';
import { definePageData } from '@beatzball/litro';

export interface HomeData {
  message: string;
  timestamp: string;
}

// Runs on the server before SSR — result injected as JSON into the HTML shell.
export const pageData = definePageData(async (_event) => {
  return {
    message: 'Hello from {{projectName}}!',
    timestamp: new Date().toISOString(),
  } satisfies HomeData;
});

export class HomePage extends LitroPage {
  static override tagName = 'page-home';

  // Called on client-side navigation (not on the initial SSR load).
  override async fetchData() {
    const res = await fetch('/api/hello');
    return res.json() as Promise<HomeData>;
  }

  render() {
    const data = this.serverData as HomeData | null;
    if (this.loading) return html`<p>Loading\u2026</p>`;
    return html`
      <main>
        <h1>${data?.message ?? 'Welcome to {{projectName}}'}</h1>
        <p><small>Rendered at: ${data?.timestamp ?? '\u2014'}</small></p>
        <nav>
          <litro-link href="/blog">Go to Blog \u2192</litro-link>
        </nav>
      </main>
    `;
  }
}

HomePage.define();

export default HomePage;
