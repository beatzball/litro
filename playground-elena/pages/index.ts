/**
 * pages/index.ts — Home page (route: /)
 *
 * Elena version of the playground home page. Demonstrates the same
 * Litro data fetching convention as the Lit/FAST playgrounds, but using
 * Elena's component model (mixin, static props, html template, light DOM).
 */

import { html } from '@elenajs/core';
import { LitroPage } from '@beatzball/litro/adapter/elena/page';
import { definePageData } from '@beatzball/litro/runtime/page-data.js';

export interface HomePageData {
  message: string;
  timestamp: string;
}

export const pageData = definePageData(async (_event) => {
  return {
    message: 'Hello from the server (Elena)!',
    timestamp: new Date().toISOString(),
  } satisfies HomePageData;
});

export class HomePage extends LitroPage {
  static override tagName = 'page-home';

  override async fetchData() {
    const res = await fetch('/api/hello');
    return res.json() as Promise<HomePageData>;
  }

  render() {
    const data = this.serverData as HomePageData | null;
    return html`
      <h1>Welcome to Litro (Elena)</h1>
      <p>${data?.message ?? 'No data yet'}</p>
      <p><small>Timestamp: ${data?.timestamp ?? '\u2014'}</small></p>
      <nav>
        <litro-link href="/about">Go to About \u2192</litro-link>
      </nav>
    `;
  }
}

HomePage.define();

export default HomePage;
