/**
 * pages/index.ts — Home page (route: /)
 *
 * FAST Element version of the playground home page. Demonstrates the same
 * Litro data fetching convention as the Lit playground, but using FAST's
 * component model (FASTElement, @attr, @observable, html template).
 */

import { FASTElement, observable, html, css } from '@microsoft/fast-element';
import { LitroPage } from '@beatzball/litro/adapter/fast/page';
import { definePageData } from '@beatzball/litro/runtime/page-data.js';

export interface HomePageData {
  message: string;
  timestamp: string;
}

export const pageData = definePageData(async (_event) => {
  return {
    message: 'Hello from the server (FAST)!',
    timestamp: new Date().toISOString(),
  } satisfies HomePageData;
});

export class HomePage extends LitroPage {
  @observable override serverData: HomePageData | null = null;

  override async fetchData() {
    const res = await fetch('/api/hello');
    return res.json() as Promise<HomePageData>;
  }
}

HomePage.define({
  name: 'page-home',
  template: html<HomePage>`
    <h1>Welcome to Litro (FAST)</h1>
    <p>${x => (x.serverData as HomePageData | null)?.message ?? 'No data yet'}</p>
    <p><small>Timestamp: ${x => (x.serverData as HomePageData | null)?.timestamp ?? '—'}</small></p>
  `,
  styles: css`
    :host {
      display: block;
      font-family: system-ui, sans-serif;
      padding: 2rem;
    }
    h1 { color: #1a1a2e; }
  `,
});

export default HomePage;
