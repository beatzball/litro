import { html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { LitroPage } from 'litro/runtime';
import { definePageData } from 'litro';

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
  @state() declare serverData: HomeData | null;

  // Called on client-side navigation (not on the initial SSR load).
  override async fetchData() {
    const res = await fetch('/api/hello');
    return res.json() as Promise<HomeData>;
  }

  render() {
    if (this.loading) return html`<p>Loading…</p>`;
    return html`
      <main>
        <h1>${this.serverData?.message ?? 'Welcome to {{projectName}}'}</h1>
        <p><small>Rendered at: ${this.serverData?.timestamp ?? '—'}</small></p>
        <nav>
          <litro-link href="/blog">Go to Blog →</litro-link>
        </nav>
      </main>
    `;
  }
}

export default HomePage;
