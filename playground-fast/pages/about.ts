/**
 * pages/about.ts — About page (route: /about)
 *
 * A simple static page demonstrating FAST Element without data fetching.
 */

import { FASTElement, html, css } from '@microsoft/fast-element';

export class AboutPage extends FASTElement {}

AboutPage.define({
  name: 'page-about',
  template: html`
    <h1>About</h1>
    <p>This is the FAST Element playground for Litro.</p>
    <p><litro-link href="/">Back to Home</litro-link></p>
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

export default AboutPage;
