import { Elena, html, unsafeHTML } from '@elenajs/core';

type AsideType = 'note' | 'tip' | 'caution' | 'danger';

const ICONS: Record<AsideType, string> = {
  note:    '\u2139\uFE0F',
  tip:     '\u{1F4A1}',
  caution: '\u26A0\uFE0F',
  danger:  '\u{1F6A8}',
};

const LABELS: Record<AsideType, string> = {
  note:    'Note',
  tip:     'Tip',
  caution: 'Caution',
  danger:  'Danger',
};

function resolveType(t: string): AsideType {
  return (['note', 'tip', 'caution', 'danger'].includes(t) ? t : 'note') as AsideType;
}

/**
 * <litro-aside type="tip" title="Custom Title">
 *   Callout box with an icon and colored left border.
 *   Children render in light DOM.
 * </litro-aside>
 */
export class LitroAside extends Elena(HTMLElement) {
  static tagName = 'litro-aside';
  static props = ['type', 'title'];

  type: AsideType = 'note';
  title = '';

  render() {
    const t = resolveType(this.type);
    return html`
      <style>
        @scope (litro-aside) {
          :scope { display: block; }
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
        }
      </style>
      <aside class="aside ${t}">
        <p class="aside-title">
          <em class="icon">${ICONS[t]}</em>
          ${this.title || LABELS[t]}
        </p>
        ${unsafeHTML(this.innerHTML)}
      </aside>
    `;
  }
}

LitroAside.define();

export default LitroAside;
