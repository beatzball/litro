/**
 * pages/native.ts — native capabilities (route: /native)
 *
 * What this page is for: proving that a control which depends on a native
 * capability never renders where that capability does not exist.
 *
 * Open it in a browser and the native-only section stays absent. There is no
 * flash of a button that then disappears, because `NativeController.supports()`
 * is false until the platform answers, not true-by-default. View source and the
 * server-rendered HTML has no native-only markup in it either, because the
 * controller reads nothing during a server render.
 *
 * The web section below is the opposite case: those capabilities have a real
 * web implementation, so they are offered when the browser has the API and
 * withheld when it does not. On an iPhone, haptics is withheld — iOS Safari has
 * no Vibration API — and that is the honest answer, not a bug.
 */

import { html, css, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { pageReset } from '@beatzball/litro';
import { NativeController } from '@beatzball/litro-native/lit';
import { haptics } from '@beatzball/litro-native/haptics';
import { badging } from '@beatzball/litro-native/badging';
import { canShare, share } from '@beatzball/litro-native/share';
import type { Capability } from '@beatzball/litro-native';

/** Capabilities that only a native host can answer for. */
const NATIVE_ONLY: readonly Capability[] = ['notifications', 'review', 'secureStorage'];

@customElement('page-native')
export class NativePage extends LitElement {
  static styles = [
    pageReset,
    css`
      :host { display: block; padding: 1rem; font-family: system-ui, sans-serif; }
      section { margin-block: 1.5rem; }
      .absent { color: #6b7280; }
      button { margin-inline-end: 0.5rem; }
      code { background: #f3f4f6; padding: 0.1em 0.3em; }
    `,
  ];

  private native = new NativeController(this);

  @state() private note = '';

  render() {
    const info = this.native.platform;

    return html`
      <h1>Native capabilities</h1>

      <section>
        <h2>What answered</h2>
        ${info === null
          ? html`<p class="absent">Reading the platform.</p>`
          : html`
              <p>
                <code>isNative</code>: ${String(info.isNative)} ·
                <code>os</code>: ${info.os} ·
                <code>supports</code>:
                ${info.supports.length === 0 ? 'nothing' : info.supports.join(', ')}
              </p>
            `}
      </section>

      <section>
        <h2>Native only</h2>
        ${this.renderNativeOnly()}
      </section>

      <section>
        <h2>Works on the web too</h2>
        ${this.native.supports('haptics')
          ? html`<button @click=${this.tapHaptics}>Haptic tap</button>`
          : html`<p class="absent">No haptics here.</p>`}
        ${this.native.supports('badging')
          ? html`
              <button @click=${this.setBadge}>Badge 3</button>
              <button @click=${this.clearBadge}>Clear badge</button>
            `
          : html`<p class="absent">No app badge here.</p>`}
        ${this.native.supports('share')
          ? html`<button @click=${this.shareThis}>Share this page</button>`
          : html`<p class="absent">No share sheet here.</p>`}
      </section>

      ${this.note ? html`<p>${this.note}</p>` : null}
    `;
  }

  private renderNativeOnly() {
    const offered = NATIVE_ONLY.filter((capability) => this.native.supports(capability));

    if (offered.length === 0) {
      return html`
        <p class="absent">
          Nothing to show. These capabilities need a native host, and this is a
          browser, so no control for them is rendered at all.
        </p>
      `;
    }

    return html`<ul>
      ${offered.map((capability) => html`<li>${capability}</li>`)}
    </ul>`;
  }

  private async tapHaptics() {
    await haptics.impact('light');
    this.note = 'Asked for a light impact.';
  }

  private async setBadge() {
    await badging.set(3);
    this.note = 'Badge set to 3.';
  }

  private async clearBadge() {
    await badging.clear();
    this.note = 'Badge cleared.';
  }

  private async shareThis() {
    const payload = { title: 'Litro', text: 'Native capabilities behind one interface.' };

    if (!(await canShare(payload))) {
      this.note = 'This browser will not share that payload.';
      return;
    }

    await share(payload);
    this.note = 'Share sheet closed.';
  }
}

export default NativePage;
