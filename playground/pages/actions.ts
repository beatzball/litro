import { html, css, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { definePageData, getServerData } from '@beatzball/litro';
import { getServerTime, echoUpper } from '../actions/demo.server.js';

// SSR path: this import is the REAL module on the server — the call below is
// an in-process function call, no HTTP hop. (pageData results still go
// through the existing JSON path, so the Date is pre-stringified here.)
export const pageData = definePageData(async () => {
  const time = await getServerTime();
  return { serverNowIso: time.now.toISOString(), secretLength: time.secretLength };
});

@customElement('page-actions')
export class ActionsPage extends LitElement {
  static styles = css`
    :host { display: block; padding: 1rem; font-family: system-ui, sans-serif; }
  `;

  @state() private serverNow = '';
  @state() private rpcResult = '';

  connectedCallback(): void {
    super.connectedCallback();
    const data = getServerData<{ serverNowIso: string }>();
    if (data) this.serverNow = data.serverNowIso;
  }

  // Client path: the same import resolves to a generated stub in the browser
  // bundle — this is a typed RPC over POST /_litro/action/<id>. The `at`
  // field arrives as a real Date (seroval round-trip).
  private async runRpc(): Promise<void> {
    const res = await echoUpper({ text: 'litro actions' });
    this.rpcResult = `${res.upper} @ ${res.at instanceof Date ? res.at.toISOString() : 'NOT-A-DATE'}`;
  }

  render() {
    return html`
      <h1>Server Actions Demo</h1>
      <p id="ssr-time">SSR time: ${this.serverNow}</p>
      <button id="rpc-button" @click=${this.runRpc}>Run RPC</button>
      <p id="rpc-result">${this.rpcResult}</p>
    `;
  }
}

export default ActionsPage;
