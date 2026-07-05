import { html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { definePageData, LitroPage } from '@beatzball/litro';
import { getServerTime, echoUpper } from '../actions/demo.server.js';

interface ActionsPageData {
  serverNowIso: string;
  secretLength: number;
}

// SSR path: this import is the REAL module on the server — the call below is
// an in-process function call, no HTTP hop. (pageData results still go
// through the existing JSON path, so the Date is pre-stringified here.)
export const pageData = definePageData(async () => {
  const time = await getServerTime();
  return {
    serverNowIso: time.now.toISOString(),
    secretLength: time.secretLength,
  } satisfies ActionsPageData;
});

@customElement('page-actions')
export class ActionsPage extends LitroPage {
  static styles = css`
    :host { display: block; padding: 1rem; font-family: system-ui, sans-serif; }
  `;

  // Narrow the type from `unknown` (mixin default) to the concrete data shape.
  @state() declare serverData: ActionsPageData | null;

  @state() private rpcResult = '';

  // Client path: the same import resolves to a generated stub in the browser
  // bundle — this is a typed RPC over POST /__litro/action/<id>. The `at`
  // field arrives as a real Date (seroval round-trip).
  private async runRpc(): Promise<void> {
    const res = await echoUpper({ text: 'litro actions' });
    this.rpcResult = `${res.upper} @ ${res.at instanceof Date ? res.at.toISOString() : 'NOT-A-DATE'}`;
  }

  render() {
    return html`
      <h1>Server Actions Demo</h1>
      <p id="ssr-time">SSR time: ${this.serverData?.serverNowIso ?? ''}</p>
      <button id="rpc-button" @click=${this.runRpc}>Run RPC</button>
      <p id="rpc-result">${this.rpcResult}</p>
    `;
  }
}

export default ActionsPage;
