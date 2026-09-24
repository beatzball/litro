/**
 * Shared styles for the `/docs` landing page.
 *
 * Injected into the page component's shadow root via `static override styles`,
 * because Lit SSR renders the page into shadow DOM and a global stylesheet
 * cannot reach the slotted content.
 */
import { css } from 'lit';

export const docsIndexStyles = css`
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

  :host { display: block; }

  .intro {
    margin: 0 0 2rem;
    font-size: var(--sl-text-lg, 1.125rem);
    line-height: 1.7;
    color: var(--sl-color-gray-5, #6b7280);
  }

  .doc-group { margin-bottom: 2.5rem; }

  .doc-group h2 {
    margin: 0 0 1rem;
    font-size: var(--sl-text-xl, 1.25rem);
    font-weight: 600;
    line-height: 1.25;
    color: var(--sl-color-text);
    border-bottom: 1px solid var(--sl-color-border, #e8e8e8);
    padding-bottom: 0.35em;
  }

  .doc-group ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
    gap: 1rem;
  }

  .doc-group li {
    border: 1px solid var(--sl-color-border, #e8e8e8);
    border-radius: 0.5rem;
    padding: 0.85rem 1rem;
  }

  .doc-group a {
    display: block;
    font-weight: 600;
    color: var(--sl-color-text-accent, var(--sl-color-accent, #ea580c));
    text-decoration: none;
  }

  .doc-group a:hover { text-decoration: underline; }

  .item-desc {
    display: block;
    margin-top: 0.35rem;
    font-size: var(--sl-text-sm, 0.875rem);
    line-height: 1.6;
    color: var(--sl-color-gray-5, #6b7280);
  }
`;
