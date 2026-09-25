import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import { pageReset } from '@beatzball/litro/runtime/page-reset.js';

/**
 * <litro-install-command command="npm install my-product">
 *   <span slot="note">Needs Node 20 or newer.</span>
 * </litro-install-command>
 *
 * The install slab: a prompt, the command, and a labeled copy control, across
 * the full width of whatever column it is given. It is the one thing on a
 * landing page a reader is meant to take away with them, so it is sized like
 * it: a slab, not a chip.
 *
 * THE `note` SLOT is one line of small print under the slab — what the command
 * needs first, or what it will not do. Slot nothing and the line is not there
 * at all; the box below it collapses to no height.
 *
 * THE COMMAND BOX IS A TAB STOP. It scrolls sideways when the command is
 * longer than the slab, and a reader with a keyboard and no pointer has no
 * other way to reach the end of it. `commandLabel` is what they hear on the
 * way in; set it when the command is not an install command.
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
    commandLabel: { type: String },
    _status: { state: true },
  };

  static override styles = [
    pageReset,
    css`
    :host {
      display: block;
    }

    /* The slab runs the full width it is given, and it is one box with a seam
       down it rather than a chip with a button tacked on the end: the command
       takes the room it needs and the copy control is a panel of its own,
       flush to the right edge. overflow: hidden is what lets the panel square
       itself off against the slab's rounded corners. */
    .box {
      display: flex;
      align-items: stretch;
      width: 100%;
      margin: 0;
      border: 1px solid var(--nova-border);
      border-radius: var(--nova-radius);
      background: var(--nova-surface);
      overflow: hidden;
      font-family: var(--nova-font-mono);
      font-size: 0.9375rem;
      text-align: left;
    }

    .line {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      flex: 1;
      /* min-width: 0, and the slab does not fit on a phone without it. A flex
         item's automatic minimum size is its CONTENT's width, so a long
         command refuses to shrink and pushes the slab past the screen. */
      min-width: 0;
      padding: 0.85rem 1rem;
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
      min-width: 0;
      padding-bottom: 0.1rem;
    }

    /* The command scrolls sideways once it is longer than the slab, and a
       region that scrolls has to be reachable without a pointer, so it is a
       tab stop (WCAG 2.1.1; axe calls the failure
       scrollable-region-focusable). The ring is focus-visible only: a mouse
       press shows nothing, which is what the design asks for at the widths
       where the command fits and does not scroll at all. */
    .command:focus-visible {
      outline: 2px solid var(--nova-accent);
      outline-offset: 2px;
      border-radius: 2px;
    }

    .copy {
      flex-shrink: 0;
      padding: 0 1.5rem;
      border: 0;
      border-left: 1px solid var(--nova-border);
      border-radius: 0;
      background: color-mix(in srgb, var(--nova-text) 9%, transparent);
      color: var(--nova-text);
      font: inherit;
      font-size: 0.875rem;
      font-weight: 700;
      cursor: pointer;
    }

    .copy:hover {
      background: color-mix(in srgb, var(--nova-text) 16%, transparent);
    }

    .copy:focus-visible {
      outline: 2px solid var(--nova-accent);
      outline-offset: -2px;
    }

    /* The button does nothing without JavaScript, so it is not shown then. */
    @media (scripting: none) {
      .copy {
        display: none;
      }
    }

    /* The small print. The wrapper carries no styles of its own, so with
       nothing slotted it is an empty block with no height and the slab has no
       gap under it. Everything that makes the line look like small print is
       on ::slotted, which applies only when there is something to style. */
    ::slotted([slot='note']) {
      display: block;
      margin-top: 0.75rem;
      color: var(--nova-text-dim);
      font-size: 0.875rem;
      line-height: 1.6;
    }

    .announce {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
  `,
  ];

  /** The command to show and to copy. */
  command = '';

  /** The button's resting label. */
  label = 'Copy';

  /**
   * The name of the command box itself, heard when a keyboard reaches it.
   *
   * It is separate from `label`, which names the BUTTON. The box is a tab stop
   * because it scrolls sideways on a narrow screen, and it is the command that
   * has to be named there, not the act of copying it.
   */
  commandLabel = 'Install command';

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
        <span class="line">
          <span class="prompt" aria-hidden="true">$</span>
          <!-- role and aria-label, because a focusable box with no name is
               announced as nothing. "group" rather than "region": a region is
               a landmark, and a landmark per install command would crowd the
               page's landmark list for no gain. -->
          <code
            class="command"
            role="group"
            tabindex="0"
            aria-label="${this.commandLabel}"
          >${this.command}</code>
        </span>
        <button
          type="button"
          class="copy"
          @click="${this._onCopy}"
        >${word}</button>
        <span class="announce" role="status" aria-live="polite"
          >${this._status ? word : ''}</span
        >
      </p>
      <div class="note"><slot name="note"></slot></div>
    `;
  }
}

export default LitroInstallCommand;
