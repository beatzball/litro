import { FASTElement, Observable, html, css } from '@microsoft/fast-element';

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
 * </litro-aside>
 */
export class LitroAside extends FASTElement {
  type: AsideType = 'note';
  title = '';
}
Observable.defineProperty(LitroAside.prototype, 'type');
Observable.defineProperty(LitroAside.prototype, 'title');

const template = html<LitroAside>`
  <aside class="aside ${x => resolveType(x.type)}">
    <p class="aside-title">
      <em class="icon">${x => ICONS[resolveType(x.type)]}</em>
      ${x => x.title || LABELS[resolveType(x.type)]}
    </p>
    <slot></slot>
  </aside>
`;

const styles = css`
  :host { display: block; }

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

LitroAside.define({ name: 'litro-aside', template, styles });

export default LitroAside;
