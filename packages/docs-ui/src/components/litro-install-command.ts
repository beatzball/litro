import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';

/**
 * <litro-install-command command="npm install my-product"></litro-install-command>
 *
 * One command, with a `$` prompt in front of it and a copy button after it.
 *
 * The button is the only part that needs JavaScript. Without it the command is
 * still rendered by the server, still readable and still selectable by hand —
 * the prompt is marked `user-select: none`, so a hand-made selection takes the
 * command and not the `$`.
 *
 * Copying asks the clipboard first. A browser may refuse that (an insecure
 * origin, or a permission the reader has turned off), so the fallback selects
 * the command text instead and the button says "Selected" rather than
 * "Copied" — a claim the page cannot keep is worse than no claim. Either way
 * the new word is also written into a live region, so a screen reader hears
 * what happened.
 *
 * COLORS come from the landing page's token block. This component defines
 * none of its own. Used outside that page, define the `--nova-*` tokens it
 * reads on any ancestor: `--nova-surface`, `--nova-border`, `--nova-text`,
 * `--nova-text-dim`, `--nova-accent`, `--nova-radius`, `--nova-font-mono`.
 */
@customElement('litro-install-command')
export class LitroInstallCommand extends LitElement {
  static override properties = {
    command: { type: String },
    label: { type: String },
    _status: { state: true },
  };

  static override styles = css`
    :host {
      display: block;
    }

    .box {
      display: inline-flex;
      align-items: center;
      gap: 0.6rem;
      /* border-box, because a shadow root does not inherit the page's reset.
         With the default content-box, max-width: 100% caps only the CONTENT,
         and the padding and border are then added on top — so the box is
         wider than the space it was given and a phone scrolls sideways. */
      box-sizing: border-box;
      max-width: 100%;
      padding: 0.6rem 0.6rem 0.6rem 1rem;
      border: 1px solid var(--nova-border);
      border-radius: var(--nova-radius);
      background: var(--nova-surface);
      font-family: var(--nova-font-mono);
      font-size: 0.9rem;
      text-align: left;
    }

    .prompt {
      color: var(--nova-accent);
      user-select: none;
      -webkit-user-select: none;
      flex-shrink: 0;
    }

    .command {
      color: var(--nova-text);
      overflow-x: auto;
      white-space: nowrap;
      padding-bottom: 0.1rem;
      /* min-width: 0, and the box does not fit on a phone without it. A flex
         item's automatic minimum size is its CONTENT's width, so a long
         command refuses to shrink, the box grows past the screen, and the
         whole page scrolls sideways — overflow-x on this element never gets a
         chance to act. Zero lets it shrink, and then the command scrolls
         inside the box the way it was meant to. */
      min-width: 0;
    }

    .copy {
      flex-shrink: 0;
      margin-left: 0.4rem;
      padding: 0.3rem 0.7rem;
      border: 1px solid var(--nova-border);
      border-radius: var(--nova-radius);
      background: transparent;
      color: var(--nova-text-dim);
      font: inherit;
      font-size: 0.8rem;
      cursor: pointer;
    }

    .copy:hover {
      color: var(--nova-text);
      border-color: var(--nova-accent);
    }

    .copy:focus-visible {
      outline: 2px solid var(--nova-accent);
      outline-offset: 2px;
    }

    /* The button does nothing without JavaScript, so it is not shown then. */
    @media (scripting: none) {
      .copy {
        display: none;
      }
    }

    .announce {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
  `;

  /** The command to show and to copy. */
  command = '';

  /** The button's resting label. */
  label = 'Copy';

  /** '' before the button is pressed, then what the press achieved. */
  _status: '' | 'copied' | 'selected' = '';

  private _resetTimer: ReturnType<typeof setTimeout> | undefined;

  /**
   * Put the command on the clipboard, or select it when that is refused.
   *
   * Returns what it managed to do, so a test can prove the fallback runs
   * without a real clipboard behind it.
   */
  async copy(): Promise<'copied' | 'selected'> {
    let status: 'copied' | 'selected';
    try {
      const clipboard = (globalThis as { navigator?: Navigator }).navigator?.clipboard;
      if (!clipboard) throw new Error('no clipboard');
      await clipboard.writeText(this.command);
      status = 'copied';
    } catch {
      this._selectCommand();
      status = 'selected';
    }

    this._status = status;
    clearTimeout(this._resetTimer);
    this._resetTimer = setTimeout(() => {
      this._status = '';
    }, 2000);
    return status;
  }

  /** Select the command text, so the reader can copy it with a keystroke. */
  private _selectCommand(): void {
    try {
      const node = this.renderRoot?.querySelector('.command');
      const root = this.shadowRoot as (ShadowRoot & { getSelection?: () => Selection | null }) | null;
      const selection = root?.getSelection?.() ?? globalThis.getSelection?.();
      if (!node || !selection) return;
      const range = document.createRange();
      range.selectNodeContents(node);
      selection.removeAllRanges();
      selection.addRange(range);
    } catch {
      // A browser that will neither copy nor select leaves the command on
      // screen to be selected by hand. Nothing else to do.
    }
  }

  private _onCopy(): void {
    void this.copy();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    clearTimeout(this._resetTimer);
  }

  override render() {
    const word =
      this._status === 'copied'
        ? 'Copied'
        : this._status === 'selected'
          ? 'Selected'
          : this.label;

    return html`
      <p class="box">
        <span class="prompt" aria-hidden="true">$</span>
        <code class="command">${this.command}</code>
        <button
          type="button"
          class="copy"
          @click="${this._onCopy}"
        >${word}</button>
        <span class="announce" role="status" aria-live="polite"
          >${this._status ? word : ''}</span
        >
      </p>
    `;
  }
}

export default LitroInstallCommand;
