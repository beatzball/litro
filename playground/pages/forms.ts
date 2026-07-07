import { html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { definePageData, LitroPage } from '@beatzball/litro';
import { actionUrl } from '@beatzball/litro/actions/client';
import { enhanceForms } from '@beatzball/litro/actions/form-client';
import { csrfToken, getFormErrors, type FormErrors } from '@beatzball/litro/actions/server';
import { addEntry, addEntryWithToken, listEntries, countdown, failingStream } from '../actions/forms.server.js';

interface FormsPageData {
  errors: FormErrors | null;
  token: string;
  entries: { name: string; message: string; atIso: string }[];
}

// The worked PRG error example (spec section 5.4): a failed no-JS post 303s
// back here with the one-shot cookie; getFormErrors() reads + clears it and
// the template renders the issues above the form.
export const pageData = definePageData(async (event) => {
  const errors = getFormErrors(event);
  const token = csrfToken(event);
  const all = await listEntries();
  return {
    errors,
    token,
    entries: all.map((e) => ({ name: e.name, message: e.message, atIso: e.at.toISOString() })),
  } satisfies FormsPageData;
});

@customElement('page-forms')
export class FormsPage extends LitroPage {
  static styles = css`
    :host { display: block; padding: 1rem; font-family: system-ui, sans-serif; }
    #form-errors { color: #b91c1c; }
  `;

  @state() declare serverData: FormsPageData | null;
  @state() private enhancedResult = '';
  @state() private enhancedError = '';
  @state() private streamLines: string[] = [];
  @state() private streamError = '';

  private detachEnhancer?: () => void;

  firstUpdated(): void {
    // submit events are composed:false — the document-level enhanceForms()
    // in app.ts cannot see forms inside this shadow root, so attach locally.
    this.detachEnhancer = enhanceForms(this.renderRoot as ShadowRoot);
    this.renderRoot.addEventListener('litro:action-success', ((e: CustomEvent) => {
      this.enhancedResult = `saved entry ${(e.detail as { count: number }).count}`;
    }) as EventListener);
    this.renderRoot.addEventListener('litro:action-error', ((e: CustomEvent) => {
      const err = e.detail as { issues?: { message: string }[]; message: string };
      this.enhancedError = err.issues?.map((i) => i.message).join(', ') ?? err.message;
    }) as EventListener);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.detachEnhancer?.();
  }

  private async runStream(): Promise<void> {
    this.streamLines = [];
    const iterable = await countdown({ from: 3 });
    for await (const chunk of iterable) {
      this.streamLines = [
        ...this.streamLines,
        `${chunk.i} @ ${chunk.at instanceof Date ? chunk.at.toISOString() : 'NOT-A-DATE'}`,
      ];
    }
    this.streamLines = [...this.streamLines, 'done'];
  }

  private async runFailingStream(): Promise<void> {
    this.streamError = '';
    try {
      const iterable = await failingStream({ from: 1 });
      for await (const _chunk of iterable) {
        // drain until the mid-stream error arrives
      }
    } catch (err) {
      this.streamError = (err as Error).message;
    }
  }

  render() {
    const d = this.serverData;
    return html`
      <h1>Forms Demo</h1>

      ${d?.errors
        ? html`<ul id="form-errors">
            ${(d.errors.issues ?? []).map((i) => html`<li>${(i as { message: string }).message}</li>`)}
            ${d.errors.message ? html`<li>${d.errors.message}</li>` : ''}
          </ul>`
        : ''}

      <form id="guestbook-form" method="post" action=${actionUrl(addEntry)}>
        <input id="gb-name" name="name" placeholder="Name" />
        <input id="gb-message" name="message" placeholder="Message" />
        <button id="gb-submit">Sign</button>
      </form>
      <p id="enhanced-result">${this.enhancedResult}</p>
      <p id="enhanced-error">${this.enhancedError}</p>

      <form id="token-form" method="post" action=${actionUrl(addEntryWithToken)}>
        <input type="hidden" name="_litro_csrf" value=${d?.token ?? ''} />
        <input name="name" placeholder="Name" />
        <input name="message" placeholder="Message" />
        <button>Sign (token mode)</button>
      </form>

      <ul id="entries">
        ${(d?.entries ?? []).map((e) => html`<li>${e.name}: ${e.message}</li>`)}
      </ul>

      <button id="stream-button" @click=${this.runStream}>Stream countdown</button>
      <ol id="stream-lines">${this.streamLines.map((l) => html`<li>${l}</li>`)}</ol>
      <button id="stream-fail-button" @click=${this.runFailingStream}>Failing stream</button>
      <p id="stream-error">${this.streamError}</p>
    `;
  }
}

export default FormsPage;
