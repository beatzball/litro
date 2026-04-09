/**
 * pages/about.ts — About page (route: /about)
 *
 * A simple static page demonstrating Elena without data fetching.
 * Light DOM output — no shadow root.
 */

import { Elena, html } from '@elenajs/core';

export class AboutPage extends Elena(HTMLElement) {
  static tagName = 'page-about';

  render() {
    return html`
      <h1>About</h1>
      <p>This is the Elena playground for Litro.</p>
      <p>Elena renders to light DOM — no Shadow DOM, no DSD polyfill.</p>
      <p><litro-link href="/">Back to Home</litro-link></p>
    `;
  }
}

AboutPage.define();

export default AboutPage;
