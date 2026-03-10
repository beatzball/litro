import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';

/**
 * <sl-card title="Feature" description="Short desc" href="/docs/feature">
 *   Renders as an <a> when `href` is set, otherwise a <div>.
 *   Rotating accent color per nth-card via CSS counter.
 * </sl-card>
 */
@customElement('sl-card')
export class SlCard extends LitElement {
  static override properties = {
    title: { type: String },
    description: { type: String },
    icon: { type: String },
    href: { type: String },
  };

  static override styles = css`
    :host {
      display: block;
      counter-increment: card;
    }

    .card {
      display: block;
      padding: 1.25rem 1.5rem;
      border: 1px solid var(--sl-color-border, #e8e8e8);
      border-radius: var(--sl-border-radius, 0.375rem);
      background-color: var(--sl-color-bg, #fff);
      border-top: 4px solid;
      text-decoration: none;
      color: inherit;
      transition: box-shadow 0.15s ease, transform 0.15s ease;
    }

    /* Rotate accent colors using counter — cycles through 4 variants */
    :host(:nth-child(4n+1)) .card { border-top-color: var(--sl-color-accent, #7c3aed); }
    :host(:nth-child(4n+2)) .card { border-top-color: var(--sl-color-note, #1d4ed8); }
    :host(:nth-child(4n+3)) .card { border-top-color: var(--sl-color-tip, #15803d); }
    :host(:nth-child(4n+0)) .card { border-top-color: var(--sl-color-caution, #b45309); }

    a.card:hover {
      box-shadow: var(--sl-shadow-md, 0 4px 16px rgba(0,0,0,.12));
      transform: translateY(-2px);
    }

    .card-icon {
      font-size: 1.75rem;
      margin-bottom: 0.5rem;
    }

    .card-title {
      font-size: var(--sl-text-lg, 1.125rem);
      font-weight: 600;
      color: var(--sl-color-text, #23262f);
      margin: 0 0 0.4rem;
    }

    .card-desc {
      font-size: var(--sl-text-sm, 0.875rem);
      color: var(--sl-color-gray-4, #757575);
      margin: 0;
      line-height: 1.6;
    }

    .card-slot {
      margin-top: 0.75rem;
    }
  `;

  title = '';
  description = '';
  icon = '';
  href = '';

  override render() {
    const inner = html`
      ${this.icon ? html`<div class="card-icon">${this.icon}</div>` : ''}
      <p class="card-title">${this.title}</p>
      ${this.description ? html`<p class="card-desc">${this.description}</p>` : ''}
      <div class="card-slot"><slot></slot></div>
    `;

    return this.href
      ? html`<a class="card" href="${this.href}">${inner}</a>`
      : html`<div class="card">${inner}</div>`;
  }
}

export default SlCard;
