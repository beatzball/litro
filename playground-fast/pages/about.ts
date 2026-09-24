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
    /* A document stylesheet stops at this shadow boundary, so the box-sizing
       reset has to be repeated inside it. Without it a padded full-width box
       measures its width PLUS its gutters, and a phone scrolls sideways by
       exactly the gutter.
       See .agents/rules/adapters-ssr.md (SSR-008). */
    *,
    *::before,
    *::after {
      box-sizing: border-box;
    }

    :host {
      display: block;
      font-family: system-ui, sans-serif;
      padding: 2rem;
    }
    h1 { color: #1a1a2e; }
  `,
});

export default AboutPage;
