/**
 * pages/agent.ts — Agent chat demo (route: /agent), FAST Element version
 *
 * Talks to the `demo` agent (playground-fast/agents/demo/agent.ts — the same
 * scripted, deterministic provider as the Lit playground's demo agent) over
 * the session client (`agentSession` from @beatzball/litro-agent/client).
 * Purely client-side: no server-fetched page data, so this extends
 * FASTElement directly (same convention as pages/about.ts) rather than the
 * FAST `LitroPage` base class.
 *
 * Element ids below are a CONTRACT with e2e/playground-fast/agent.spec.ts —
 * do not rename without updating them there too. They match the Lit
 * playground's page-agent element ids exactly, on purpose: RFC vertical-
 * slice item 4 is that the exact same client contract (element ids, event
 * kinds, `hydrateUIResult`) works unmodified against a UIResult produced by
 * the FAST renderer, which is not Lit-shaped (a plain HTML attribute string
 * in, not a lit-html TemplateResult).
 *
 * Element access uses `this.shadowRoot?.querySelector(...)` in
 * connectedCallback() rather than FAST's `ref()` template directive or
 * declarative `@click`/`@keydown` bindings — this codebase has no existing
 * precedent for either inside a Litro FAST page, whereas the SSR'd
 * Declarative Shadow DOM markup is natively parsed and attached to
 * `this.shadowRoot` by the browser before any custom-element JS runs (DSD's
 * whole point), so a plain querySelector after `super.connectedCallback()`
 * is a robust, already-proven-in-this-codebase way to reach the rendered
 * children (see LitroLink.ts / LitroPage.ts for the same
 * manual-DOM-over-declarative-binding convention for event wiring).
 */
import { FASTElement, observable, html, css } from '@microsoft/fast-element';
import { agentSession, hydrateUIResult } from '@beatzball/litro-agent/client';

// No import from '@beatzball/litro-agent' (or any of its server-only deep
// imports) here — only the browser-safe './client' entry point, same
// discipline as the Lit playground's page-agent.ts.

export class AgentPage extends FASTElement {
  @observable sessionId = '';
  @observable sending = false;

  private inputEl?: HTMLInputElement;
  private sendBtnEl?: HTMLButtonElement;
  private logEl?: HTMLElement;
  private uiSlotEl?: HTMLElement;
  private fallbackDataEl?: HTMLElement;

  private onKeydown = (e: KeyboardEvent): void => {
    if (e.key === 'Enter') void this.handleSend();
  };

  private onSendClick = (): void => {
    void this.handleSend();
  };

  override connectedCallback(): void {
    super.connectedCallback();

    // @microsoft/fast-ssr's element renderer calls connectedCallback() on
    // the SERVER too (to simulate custom-element lifecycle for hydration),
    // but `this.shadowRoot` there is a lightweight SSR stand-in, not a real
    // DOM ShadowRoot -- it has no `querySelector`. Guard so SSR doesn't
    // throw (which would abort the whole page's SSR stream); the real
    // wiring happens once this reruns in the browser after hydration.
    const root = this.shadowRoot;
    if (!root || typeof root.querySelector !== 'function') return;

    this.inputEl = root.querySelector('#chat-input') ?? undefined;
    this.sendBtnEl = root.querySelector('#chat-send') ?? undefined;
    this.logEl = root.querySelector('#chat-log') ?? undefined;
    this.uiSlotEl = root.querySelector('#ui-slot') ?? undefined;
    this.fallbackDataEl = root.querySelector('#fallback-data') ?? undefined;

    this.inputEl?.addEventListener('keydown', this.onKeydown);
    this.sendBtnEl?.addEventListener('click', this.onSendClick);
  }

  override disconnectedCallback(): void {
    this.inputEl?.removeEventListener('keydown', this.onKeydown);
    this.sendBtnEl?.removeEventListener('click', this.onSendClick);
    super.disconnectedCallback();
  }

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
    if (this.sendBtnEl) this.sendBtnEl.disabled = true;
    input!.value = '';
    try {
      for await (const ev of agentSession('demo', sessionId).send(text)) {
        this.handleEvent(ev);
      }
    } finally {
      this.sending = false;
      if (this.sendBtnEl) this.sendBtnEl.disabled = false;
    }
  }

  private handleEvent(ev: { kind: string; payload: unknown }): void {
    if (ev.kind === 'text-delta') {
      const text = (ev.payload as { text: string }).text;
      const p = document.createElement('p');
      p.className = 'chat-text';
      p.textContent = text;
      this.logEl?.appendChild(p);
    } else if (ev.kind === 'ui') {
      const payload = ev.payload as Parameters<typeof hydrateUIResult>[1];
      if (this.uiSlotEl) void hydrateUIResult(this.uiSlotEl, payload);
      if (this.fallbackDataEl) {
        this.fallbackDataEl.textContent = JSON.stringify((payload as { data?: unknown }).data);
      }
    }
  }
}

AgentPage.define({
  name: 'page-agent',
  template: html<AgentPage>`
    <h1>Agent Demo</h1>
    <p>Session: <span id="session-id">${(x) => x.sessionId}</span></p>

    <div>
      <input id="chat-input" placeholder="Ask about the weather" />
      <button id="chat-send">Send</button>
    </div>

    <div id="chat-log"></div>
    <div id="ui-slot"></div>
    <pre id="fallback-data"></pre>
  `,
  styles: css`
    :host { display: block; padding: 1rem; font-family: system-ui, sans-serif; }
    #chat-log { display: flex; flex-direction: column; gap: 0.25rem; margin: 1rem 0; }
    .chat-text { margin: 0; }
    #ui-slot { margin: 1rem 0; }
  `,
});

export default AgentPage;
