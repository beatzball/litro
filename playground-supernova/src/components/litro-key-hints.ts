import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import { pageReset } from '@beatzball/litro/runtime/page-reset.js';

/** One key, and what it does. `keys` may be several keys pressed in turn. */
export interface KeyHint {
  keys: string | string[];
  meaning: string;
}

/**
 * <litro-key-hints .hints="${[{ keys: 'Ctrl + C', meaning: 'Stop' }, …]}">
 * </litro-key-hints>
 *
 * Key and meaning pairs, as a definition list.
 *
 * Every key is wrapped in `<kbd>`, which is what the element is for: a screen
 * reader announces it as a key rather than as a stray letter, and the page's
 * styles can give all keys one look. A hint with several keys renders one
 * `<kbd>` per key.
 *
 * COLORS come from the landing page's token block. This component defines
 * none of its own. Used outside that page, define the `--nova-*` tokens it
 * reads on any ancestor: `--nova-surface`, `--nova-border`, `--nova-text`,
 * `--nova-text-dim`, `--nova-radius`, `--nova-font-mono`.
 */
@customElement('litro-key-hints')
export class LitroKeyHints extends LitElement {
  static override properties = {
    hints: { type: Array },
  };

  static override styles = [
    pageReset,
    css`
    :host {
      display: block;
    }

    dl {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 0.75rem 1rem;
      align-items: baseline;
      margin: 0;
    }

    dt {
      display: flex;
      flex-wrap: wrap;
      gap: 0.25rem;
      margin: 0;
    }

    dd {
      margin: 0;
      color: var(--nova-text-dim);
      line-height: 1.5;
    }

    kbd {
      display: inline-block;
      padding: 0.15rem 0.45rem;
      border: 1px solid var(--nova-border);
      border-bottom-width: 2px;
      border-radius: var(--nova-radius);
      background: var(--nova-surface);
      color: var(--nova-text);
      font-family: var(--nova-font-mono);
      font-size: 0.8rem;
      line-height: 1.4;
      white-space: nowrap;
    }
  `,
  ];

  /** The key and meaning pairs, in the order they should be read. */
  hints: KeyHint[] = [];

  override render() {
    const hints = this.hints ?? [];
    return html`
      <dl>
        ${hints.map((hint) => {
          const keys = Array.isArray(hint.keys) ? hint.keys : [hint.keys];
          return html`
            <dt>${keys.map((key) => html`<kbd>${key}</kbd>`)}</dt>
            <dd>${hint.meaning}</dd>
          `;
        })}
      </dl>
    `;
  }
}

export default LitroKeyHints;
