import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';

type AsideType = 'note' | 'tip' | 'caution' | 'danger';

const ICONS: Record<AsideType, string> = {
  note:    '&#x2139;&#xFE0F;', // ℹ️
  tip:     '&#x1F4A1;',        // 💡
  caution: '&#x26A0;&#xFE0F;', // ⚠️
  danger:  '&#x1F6A8;',        // 🚨
};

const LABELS: Record<AsideType, string> = {
  note:    'Note',
  tip:     'Tip',
  caution: 'Caution',
  danger:  'Danger',
};

/**
 * <sl-aside type="tip" title="Custom Title">
 *   Callout box with an icon and colored left border.
 *   Slot content is the body.
 * </sl-aside>
 */
@customElement('sl-aside')
export class SlAside extends LitElement {
  static override properties = {
    type: { type: String },
    title: { type: String },
  };

  static override styles = css`
    :host {
      display: block;
    }

    .aside {
      margin: 1.5rem 0;
      padding: 1rem 1.25rem;
      border-left: 4px solid;
      border-radius: 0 var(--sl-border-radius, 0.375rem) var(--sl-border-radius, 0.375rem) 0;
    }

    .aside.note   { border-color: var(--sl-color-note, #1d4ed8);    background-color: color-mix(in srgb, var(--sl-color-note, #1d4ed8) 8%, transparent); }
    .aside.tip    { border-color: var(--sl-color-tip, #15803d);     background-color: color-mix(in srgb, var(--sl-color-tip, #15803d) 8%, transparent); }
    .aside.caution{ border-color: var(--sl-color-caution, #b45309); background-color: color-mix(in srgb, var(--sl-color-caution, #b45309) 8%, transparent); }
    .aside.danger { border-color: var(--sl-color-danger, #b91c1c);  background-color: color-mix(in srgb, var(--sl-color-danger, #b91c1c) 8%, transparent); }

    .aside-title {
      display: flex;
      align-items: center;
      gap: 0.4em;
      font-size: var(--sl-text-sm, 0.875rem);
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin-bottom: 0.5rem;
    }

    .aside-title .icon { font-style: normal; }

    .aside.note    .aside-title { color: var(--sl-color-note, #1d4ed8); }
    .aside.tip     .aside-title { color: var(--sl-color-tip, #15803d); }
    .aside.caution .aside-title { color: var(--sl-color-caution, #b45309); }
    .aside.danger  .aside-title { color: var(--sl-color-danger, #b91c1c); }

    ::slotted(p:last-child) { margin-bottom: 0; }
  `;

  type: AsideType = 'note';
  title = '';

  override render() {
    const t = (['note', 'tip', 'caution', 'danger'].includes(this.type)
      ? this.type
      : 'note') as AsideType;
    const label = this.title || LABELS[t];
    return html`
      <aside class="aside ${t}">
        <p class="aside-title">
          <em class="icon">${ICONS[t]}</em>
          ${label}
        </p>
        <slot></slot>
      </aside>
    `;
  }
}

export default SlAside;
