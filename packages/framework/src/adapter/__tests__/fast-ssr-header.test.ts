/**
 * The starlight header, rendered through the FAST server path.
 *
 * WHY THIS TEST EXISTS
 *
 * `@microsoft/fast-ssr` runs `connectedCallback` ON THE SERVER. Lit's SSR
 * never calls `firstUpdated`, and Elena's runs only `willUpdate()` and
 * `render()` — so a line that reaches for a browser API in a lifecycle hook
 * breaks in exactly one of the three adapters, and it breaks at render time,
 * not at build time. The theme fix put
 * `document.documentElement.getAttribute('data-theme')` behind a
 * `typeof document === 'undefined'` guard. Under FAST's DOM shim `document`
 * EXISTS and `document.documentElement` does not, so every page carrying the
 * header threw "Cannot read properties of undefined (reading 'getAttribute')"
 * and served a truncated stream. Nothing in the build, the types or the unit
 * suite said a word; only 19 e2e timeouts did, and the real cause was a line
 * in a server log.
 *
 * This renders the SHIPPED recipe template through the same renderer the
 * adapter uses. If a lifecycle hook throws on the server, `for await` here
 * throws and this test fails — loudly, in `pnpm test`, in seconds.
 *
 * See `.agents/rules/adapters-ssr.md`.
 */
import { describe, it, expect, beforeAll } from 'vitest';

/** Collect the whole render, so a mid-stream throw surfaces here. */
async function renderToString(iterable: AsyncIterable<unknown>): Promise<string> {
  let html = '';
  for await (const chunk of iterable) {
    if (typeof chunk === 'string') html += chunk;
  }
  return html;
}

/** The SHIPPED recipe template, not a playground mirror of it. */
const HEADER_MODULE =
  '../../../../create-litro/recipes/starlight/template-fast/src/components/starlight-header.ts';

let templateRenderer: { render(html: string): AsyncIterable<unknown> };

beforeAll(async () => {
  // Order is the whole trick, and it is the same order as the FAST adapter's
  // manifestPreamble(): DOM shim, then fastSSR(), then the components. A
  // static import would hoist above the shim and crash on `document`.
  await import('@microsoft/fast-ssr/install-dom-shim.js');
  const { default: fastSSR } = await import('@microsoft/fast-ssr');
  templateRenderer = fastSSR({ renderMode: 'async' }).templateRenderer as never;
  // The specifier is a variable ON PURPOSE. A static import would put the
  // recipe template into this package's tsc program, where
  // `@microsoft/fast-element` is not resolvable and the template's own
  // `.ts` extension is not allowed — the framework build would fail even
  // though the test passes (see `.agents/rules/testing.md`, TEST-003).
  // Vitest still transforms and resolves it at run time.
  await import(/* @vite-ignore */ HEADER_MODULE);
});

describe('starlight-header renders through @microsoft/fast-ssr', () => {
  it('does not throw when FAST runs connectedCallback on the server', async () => {
    const html = await renderToString(
      templateRenderer.render('<starlight-header></starlight-header>'),
    );
    expect(html).toContain('starlight-header');
  });

  it('emits a declarative shadow root with the theme toggle in it', async () => {
    const html = await renderToString(
      templateRenderer.render('<starlight-header></starlight-header>'),
    );
    expect(html).toContain('shadowrootmode');
    expect(html).toContain('theme-toggle');
  });

  /**
   * The server has no reader and no stored choice, so it must render the
   * light default rather than guess. This is what fails if someone puts the
   * theme decision back into the component.
   */
  it('renders the light default on the server', async () => {
    const html = await renderToString(
      templateRenderer.render('<starlight-header></starlight-header>'),
    );
    expect(html).toContain('Switch to dark mode');
  });
});
