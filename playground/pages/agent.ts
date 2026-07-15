/**
 * pages/agent.ts — Agent chat demo (route: /agent)
 *
 * Talks to the `demo` agent (playground/agents/demo/agent.ts, a scripted
 * provider — deterministic, no API keys) over the session client
 * (`agentSession` from @beatzball/litro-agent/client). Purely client-side:
 * no server-fetched page data, so this extends LitElement directly (same
 * convention as pages/blog/index.ts) rather than LitroPage.
 *
 * Element ids below are a CONTRACT with the Task 15 e2e smoke tests — do not
 * rename without updating them there too.
 */
import { LitElement, html, css } from 'lit';
import { customElement, query, state } from 'lit/decorators.js';
import { agentSession, hydrateUIResult } from '@beatzball/litro-agent/client';

// No import from '@beatzball/litro-agent' (or any of its server-only deep
// imports) here -- only the browser-safe './client' entry point. `ev`'s
// element type below is inferred from `agentSession(...).send()`'s return
// type, and the `ui` event payload is cast to `hydrateUIResult`'s own second
// parameter type via `Parameters<>` -- so no separate type import is needed
// either.

@customElement('page-agent')
export class AgentPage extends LitElement {
  static override styles = css`
    :host { display: block; padding: 1rem; font-family: system-ui, sans-serif; }
    #chat-log { display: flex; flex-direction: column; gap: 0.25rem; margin: 1rem 0; }
    .chat-text { margin: 0; }
    #ui-slot { margin: 1rem 0; }
  `;

  @state() private sessionId = '';
  @state() private sending = false;

  @query('#chat-input') private inputEl?: HTMLInputElement;
  @query('#chat-log') private logEl?: HTMLElement;
  @query('#ui-slot') private uiSlotEl?: HTMLElement;
  @query('#fallback-data') private fallbackDataEl?: HTMLElement;

  /** The <p> collecting the current run of assistant text-deltas. A real
   *  provider streams one text-delta per token, so deltas must accumulate
   *  into one paragraph; any non-text event (a tool call, a UI result, the
   *  turn ending) closes the run so the next text starts a fresh paragraph. */
  private currentTextEl?: HTMLElement;

  private onKeydown = (e: KeyboardEvent): void => {
    if (e.key === 'Enter') void this.handleSend();
  };

  /** Generates a session id on first use, then reuses it for every
   *  subsequent turn in this page instance. */
  private ensureSessionId(): string {
    if (!this.sessionId) {
      this.sessionId = `sess-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    }
    return this.sessionId;
  }

  private async handleSend(): Promise<void> {
    const input = this.inputEl;
    const text = input?.value.trim();
    if (!text || this.sending) return;

    const sessionId = this.ensureSessionId();
    this.sending = true;
    input!.value = '';
    this.currentTextEl = undefined;
    try {
      for await (const ev of agentSession('demo', sessionId).send(text)) {
        this.handleEvent(ev);
      }
    } finally {
      this.sending = false;
    }
  }

  private handleEvent(ev: { kind: string; payload: unknown }): void {
    if (ev.kind === 'text-delta') {
      const text = (ev.payload as { text: string }).text;
      if (!this.currentTextEl) {
        this.currentTextEl = document.createElement('p');
        this.currentTextEl.className = 'chat-text';
        this.logEl?.appendChild(this.currentTextEl);
      }
      this.currentTextEl.textContent += text;
      return;
    }

    // Any non-text event ends the current text run, so the next assistant
    // text (e.g. the narration after a tool result) starts a new paragraph.
    this.currentTextEl = undefined;

    if (ev.kind === 'ui') {
      const payload = ev.payload as Parameters<typeof hydrateUIResult>[1];
      if (this.uiSlotEl) void hydrateUIResult(this.uiSlotEl, payload);
      if (this.fallbackDataEl) this.fallbackDataEl.textContent = JSON.stringify((payload as { data?: unknown }).data);
    }
  }

  override render() {
    return html`
      <h1>Agent Demo</h1>
      <p>Session: <span id="session-id">${this.sessionId}</span></p>

      <div>
        <input id="chat-input" placeholder="Ask about the weather" @keydown=${this.onKeydown} />
        <button id="chat-send" ?disabled=${this.sending} @click=${() => this.handleSend()}>Send</button>
      </div>

      <div id="chat-log"></div>
      <div id="ui-slot"></div>
      <pre id="fallback-data"></pre>
    `;
  }
}

export default AgentPage;
