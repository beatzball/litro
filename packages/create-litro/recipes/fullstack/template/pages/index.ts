import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { LitroPage } from '@beatzball/litro/runtime';
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

@customElement('page-home')
export class HomePage extends LitroPage {
  // Called on client-side navigation (not on the initial SSR load).
  override async fetchData() {
    const res = await fetch('/api/hello');
    return res.json() as Promise<HomeData>;
  }

  render() {
    const data = this.serverData as HomeData | null;
    if (this.loading) return html`<p>Loading…</p>`;
    return html`
      <main>
        <h1>${data?.message ?? 'Welcome to {{projectName}}'}</h1>
        <p><small>Rendered at: ${data?.timestamp ?? '—'}</small></p>
        <nav>
          <litro-link href="/blog">Go to Blog →</litro-link>
        </nav>
      </main>
    `;
  }
}

export default HomePage;
