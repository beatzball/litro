import { Elena, html, unsafeHTML } from '@elenajs/core';

/**
 * <litro-card title="Feature" description="Short desc" href="/docs/feature">
 *   Renders as an <a> when `href` is set, otherwise a <div>.
 *   Rotating accent color per nth-card via CSS counter.
 * </litro-card>
 */
export class LitroCard extends Elena(HTMLElement) {
  static tagName = 'litro-card';
  static props = ['title', 'description', 'icon', 'iconsrc', 'href'];

  title = '';
  description = '';
  icon = '';
  iconsrc = '';
  href = '';

  render() {
    const iconHtml = this.iconsrc
      ? `<img class="card-icon-img" src="${this.iconsrc}" alt="" aria-hidden="true" />`
      : this.icon
        ? `<span class="card-icon">${this.icon}</span>`
        : '';

    const descHtml = this.description
      ? `<p class="card-desc">${this.description}</p>`
      : '';

    const inner = `
      <div class="card-header">
        ${iconHtml}
        <p class="card-title">${this.title}</p>
      </div>
      ${descHtml}
      ${this.innerHTML ? `<div class="card-slot">${this.innerHTML}</div>` : ''}
    `;

    const tag = this.href ? 'a' : 'div';
    const hrefAttr = this.href ? ` href="${this.href}"` : '';

    return html`
      <style>
        @scope (litro-card) {
          :scope {
            display: flex;
            flex-direction: column;
            counter-increment: card;
          }
          .card {
            display: flex;
            flex-direction: column;
            flex: 1;
            padding: 1.25rem 1.5rem;
            border: 1px solid var(--sl-color-border, #e8e8e8);
            border-radius: var(--sl-border-radius, 0.375rem);
            background-color: var(--sl-color-bg, #fff);
            border-top: 4px solid;
            text-decoration: none;
            color: inherit;
            transition: box-shadow 0.15s ease, transform 0.15s ease;
          }
          :scope:nth-child(4n+1) .card { border-top-color: var(--sl-color-accent, #7c3aed); }
          :scope:nth-child(4n+2) .card { border-top-color: var(--sl-color-note, #1d4ed8); }
          :scope:nth-child(4n+3) .card { border-top-color: var(--sl-color-tip, #15803d); }
          :scope:nth-child(4n+0) .card { border-top-color: var(--sl-color-caution, #b45309); }
          a.card:hover {
            box-shadow: var(--sl-shadow-md, 0 4px 16px rgba(0,0,0,.12));
            transform: translateY(-2px);
          }
          .card-header {
            display: flex;
            align-items: center;
            gap: 0.6rem;
            margin-bottom: 0.4rem;
          }
          .card-icon { font-size: 1.5rem; flex-shrink: 0; line-height: 1; }
          .card-icon-img { width: 1.5rem; height: 1.5rem; object-fit: contain; flex-shrink: 0; }
          .card-title {
            font-size: var(--sl-text-lg, 1.125rem);
            font-weight: 600;
            color: var(--sl-color-text, #23262f);
            margin: 0;
          }
          .card-desc {
            font-size: var(--sl-text-sm, 0.875rem);
            color: var(--sl-color-gray-4, #757575);
            margin: 0;
            line-height: 1.6;
          }
          .card-slot { margin-top: 0.75rem; }
        }
      </style>
      ${unsafeHTML(`<${tag} class="card"${hrefAttr}>${inner}</${tag}>`)}
    `;
  }
}

LitroCard.define();

export default LitroCard;
