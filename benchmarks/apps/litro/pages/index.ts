import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { LitroPage } from '@beatzball/litro/runtime';
import { definePageData } from '@beatzball/litro';

interface HomeData {
  title: string;
  body: string;
}

export const pageData = definePageData(async () => {
  return {
    title: 'Welcome to the Benchmark App',
    body: 'This is a minimal app used for cross-framework performance benchmarks.',
  } satisfies HomeData;
});

@customElement('page-home')
export class HomePage extends LitroPage {
  static override properties = { serverData: { state: true } };

  render() {
    const data = this.serverData as HomeData | null;
    return html`
      <h1>${data?.title}</h1>
      <p>${data?.body}</p>
      <a href="/blog/hello">Read blog post</a>
    `;
  }
}

export default HomePage;
