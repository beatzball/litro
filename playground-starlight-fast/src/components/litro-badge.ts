import { FASTElement, Observable, html, css } from '@microsoft/fast-element';

type BadgeVariant = 'note' | 'tip' | 'caution' | 'danger' | 'default';

/**
 * <litro-badge variant="tip" text="New">
 *   Inline color-coded chip. Use `text` attribute or slot content.
 * </litro-badge>
 */
export class LitroBadge extends FASTElement {
  variant: BadgeVariant = 'default';
  text = '';
}
Observable.defineProperty(LitroBadge.prototype, 'variant');
Observable.defineProperty(LitroBadge.prototype, 'text');

const template = html<LitroBadge>`
  <span class="badge ${x => ['note', 'tip', 'caution', 'danger'].includes(x.variant) ? x.variant : 'default'}">
    ${x => x.text || html`<slot></slot>`}
  </span>
`;

const styles = css`
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

LitroBadge.define({ name: 'litro-badge', template, styles });

export default LitroBadge;
