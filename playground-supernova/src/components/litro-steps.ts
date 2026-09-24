import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';

/** One numbered step. `description` is optional. */
export interface StepItem {
  title: string;
  description?: string;
}

/**
 * <litro-steps .steps="${[{ title: 'Install it' }, …]}"></litro-steps>
 *
 * A numbered list, with a line drawn between one number and the next.
 *
 * The list is a real `<ol>`, so the numbers are the list's own and a screen
 * reader counts them. The connector is a CSS pseudo-element on every step but
 * the last, so it costs no markup and needs no JavaScript.
 *
 * COLORS come from the landing page's token block. This component defines
 * none of its own. Used outside that page, define the `--nova-*` tokens it
 * reads on any ancestor: `--nova-surface`, `--nova-border`, `--nova-text`,
 * `--nova-text-dim`, `--nova-accent`.
 */
@customElement('litro-steps')
export class LitroSteps extends LitElement {
  static override properties = {
    steps: { type: Array },
  };

  static override styles = css`
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
    }

    ol {
      margin: 0;
      padding: 0;
      list-style: none;
      counter-reset: step;
    }

    li {
      position: relative;
      counter-increment: step;
      padding: 0 0 1.75rem 3rem;
    }

    li:last-child {
      padding-bottom: 0;
    }

    /* The number bubble. */
    li::before {
      content: counter(step);
      position: absolute;
      left: 0;
      top: 0;
      width: 2rem;
      height: 2rem;
      display: grid;
      place-items: center;
      border: 1px solid var(--nova-accent);
      border-radius: 50%;
      background: var(--nova-surface);
      color: var(--nova-accent);
      font-size: 0.9rem;
      font-weight: 700;
    }

    /* The connector, from this bubble down to the next one. */
    li::after {
      content: '';
      position: absolute;
      left: 1rem;
      top: 2rem;
      bottom: 0.25rem;
      width: 1px;
      background: var(--nova-border);
    }

    li:last-child::after {
      display: none;
    }

    .title {
      margin: 0.3rem 0 0;
      font-weight: 600;
      color: var(--nova-text);
    }

    .description {
      margin: 0.35rem 0 0;
      color: var(--nova-text-dim);
      line-height: 1.6;
    }
  `;

  /** The steps, in order. */
  steps: StepItem[] = [];

  override render() {
    const steps = this.steps ?? [];
    return html`
      <ol>
        ${steps.map(
          (step) => html`
            <li>
              <p class="title">${step.title}</p>
              ${step.description
                ? html`<p class="description">${step.description}</p>`
                : ''}
            </li>
          `,
        )}
      </ol>
    `;
  }
}

export default LitroSteps;
