import { css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { LitroPage } from '@beatzball/litro/runtime';
import { definePageData } from '@beatzball/litro';
import { actionUrl } from '@beatzball/litro/actions/client';
import { enhanceForms } from '@beatzball/litro/actions/form-client';
import { greet } from '../actions/demo.server.js';
import '../src/components/litro-footer.js';

export interface HomeData {
  message: string;
  timestamp: string;
}

// Runs on the server before SSR — result injected as JSON into the HTML shell.
export const pageData = definePageData(async (_event) => {
  return {
    message: 'Hello from {{projectName}}!',
    timestamp: new Date().toISOString(),
  } satisfies HomeData;
});

@customElement('page-home')
export class HomePage extends LitroPage {
  static override styles = css`
    /* A document stylesheet stops at this shadow boundary, so the box-sizing
       reset has to be repeated inside it. Without it a padded full-width box
       measures its width PLUS its gutters, and a phone scrolls sideways by
       exactly the gutter.
       See .agents/rules/adapters-ssr.md (SSR-008). */
    *,
    *::before,
    *::after {
      box-sizing: border-box;
    }

    :host {
      display: block;
    }
  `;

  @state() private greeting = '';

  private detachEnhancer?: () => void;

  // Called on client-side navigation (not on the initial SSR load).
  override async fetchData() {
    const res = await fetch('/api/hello');
    return res.json() as Promise<HomeData>;
  }

  firstUpdated(): void {
    // Enhance the form below: with JS it becomes a typed RPC; without JS the
    // browser posts natively and the server redirects (PRG). submit events
    // do not cross shadow roots, so attach to this component's render root.
    this.detachEnhancer = enhanceForms(this.renderRoot as ShadowRoot);
    this.renderRoot.addEventListener('litro:action-success', ((e: CustomEvent) => {
      this.greeting = (e.detail as { greeting: string }).greeting;
    }) as EventListener);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.detachEnhancer?.();
  }

  render() {
    const data = this.serverData as HomeData | null;
    if (this.loading) return html`<p>Loading…</p>`;
    return html`
      <main>
        <h1>${data?.message ?? 'Welcome to {{projectName}}'}</h1>
        <p><small>Rendered at: ${data?.timestamp ?? '—'}</small></p>
        <form method="post" action=${actionUrl(greet)}>
          <input name="name" placeholder="Your name" />
          <button>Greet (server action)</button>
        </form>
        <p id="greeting">${this.greeting}</p>
        <nav>
          <litro-link href="/blog">Go to Blog →</litro-link>
        </nav>
      </main>
      <!-- Credit line. Delete this element if you would rather not carry it. -->
      <litro-footer recipe="{{recipe}}"></litro-footer>
    `;
  }
}

export default HomePage;
