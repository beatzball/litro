import { LitElement, html, css } from 'lit';
import { customElement, query, state } from 'lit/decorators.js';
import { agentSession, hydrateUIResult } from '@beatzball/litro-agent/client';
import { pageReset } from '@beatzball/litro/runtime/page-reset.js';
import { RunOutput } from '../components/run-output.js';
void RunOutput;

@customElement('page-coder')
export class CoderPage extends LitElement {
  static override styles = [pageReset, css`
    :host { display: block; padding: 1rem; font-family: system-ui, sans-serif; }
    textarea { display: block; width: 100%; max-width: 50rem; min-height: 6rem; }
  `];
  @state() private busy = false;
  @state() private message = '';
  @query('#token') private tokenInput?: HTMLInputElement;
  @query('textarea') private input?: HTMLTextAreaElement;
  @query('#output') private output?: HTMLElement;
  private sessionId = '';

  private async run() {
    const text = this.input?.value.trim();
    if (!text || this.busy) return;
    if (!this.sessionId) {
      try { this.sessionId = sessionStorage.getItem('litro-coder-session') ?? ''; } catch { /* Storage unavailable. */ }
    }
    this.busy = true;
    this.message = '';
    try {
      if (!this.sessionId) await this.signIn();
      if (!this.sessionId) return;
      for await (const event of agentSession('coder', this.sessionId).send(text)) {
        if (event.kind === 'ui' && this.output) {
          await hydrateUIResult(this.output, event.payload as Parameters<typeof hydrateUIResult>[1]);
        } else if (event.kind === 'text-delta') {
          this.message += (event.payload as { text: string }).text;
        } else if (event.kind === 'tool-result' && typeof event.payload === 'object' && event.payload !== null && 'error' in event.payload) {
          this.message += JSON.stringify(event.payload.error);
        } else if (event.kind === 'error') {
          this.message += JSON.stringify(event.payload);
        }
      }
    } catch {
      this.message = 'The command request failed. Check the playground server configuration.';
    } finally {
      this.busy = false;
    }
  }

  private async signIn() {
    const token = this.tokenInput?.value ?? '';
    if (this.tokenInput) this.tokenInput.value = '';
    try {
      const response = await fetch('/api/coder/session', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'x-litro-agent': '1', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      });
      if (!response.ok) {
        const error = await response.json() as { statusMessage?: string };
        throw new Error(error.statusMessage ?? 'Sign in failed. Check the access token and server configuration.');
      }
      this.sessionId = (await response.json() as { sessionId: string }).sessionId;
      try { sessionStorage.setItem('litro-coder-session', this.sessionId); } catch { /* Storage unavailable. */ }
      this.message = 'Signed in. Commands use this session until you sign in again or it expires.';
    } catch (error) { this.message = (error as Error).message; }
  }

  override render() {
    return html`<h1>Run code</h1>
      <p>Run a command in a session microVM. The Node.js machine has no internet access.</p>
      <p>Without LLM_URL, enter a JSON array of executable and arguments. Shell scripts use ["sh", "-c", script].</p>
      <p>Sign in with the access token from the playground operator. It is cleared after sign-in.</p>
      <label for="token">Access token</label>
      <input id="token" type="password" autocomplete="off" />
      <button ?disabled=${this.busy} @click=${() => this.signIn()}>Sign in / New session</button>
      <label for="command">Command</label>
      <textarea id="command">["node", "-e", "console.log(1+1)"]</textarea>
      <button ?disabled=${this.busy} @click=${() => this.run()}>Run</button>
      <p role="status">${this.message}</p><div id="output"></div>`;
  }
}
export default CoderPage;
