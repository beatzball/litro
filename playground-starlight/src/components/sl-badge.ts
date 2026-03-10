import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';

type BadgeVariant = 'note' | 'tip' | 'caution' | 'danger' | 'default';

/**
 * <sl-badge variant="tip" text="New">
 *   Inline color-coded chip. Use `text` attribute or slot content.
 * </sl-badge>
 */
@customElement('sl-badge')
export class SlBadge extends LitElement {
  static override properties = {
    variant: { type: String },
    text: { type: String },
  };

  static override styles = css`
    :host {
      display: inline-flex;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      padding: 0.15em 0.55em;
      border-radius: 9999px;
      font-size: var(--sl-text-xs, 0.75rem);
      font-weight: 600;
      line-height: 1.5;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .badge.note {
      background-color: color-mix(in srgb, var(--sl-color-note, #1d4ed8) 15%, transparent);
      color: var(--sl-color-note, #1d4ed8);
    }

    .badge.tip {
      background-color: color-mix(in srgb, var(--sl-color-tip, #15803d) 15%, transparent);
      color: var(--sl-color-tip, #15803d);
    }

    .badge.caution {
      background-color: color-mix(in srgb, var(--sl-color-caution, #b45309) 15%, transparent);
      color: var(--sl-color-caution, #b45309);
    }

    .badge.danger {
      background-color: color-mix(in srgb, var(--sl-color-danger, #b91c1c) 15%, transparent);
      color: var(--sl-color-danger, #b91c1c);
    }

    .badge.default {
      background-color: var(--sl-color-accent-low, #ede9fe);
      color: var(--sl-color-accent-high, #5b21b6);
    }
  `;

  variant: BadgeVariant = 'default';
  text = '';

  override render() {
    const cls = ['note', 'tip', 'caution', 'danger'].includes(this.variant)
      ? this.variant
      : 'default';
    return html`
      <span class="badge ${cls}">
        ${this.text || html`<slot></slot>`}
      </span>
    `;
  }
}

export default SlBadge;
