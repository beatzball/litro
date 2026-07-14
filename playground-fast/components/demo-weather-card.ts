/**
 * <demo-weather-card city="Lisbon" temp-c="21" summary="sunny">
 *   Rendered server-side by the demo agent's get-weather tool via ui() and
 *   streamed to the client as Declarative Shadow DOM. `weather-card-root` is
 *   a stable element id inside the shadow root — a contract with the e2e
 *   smoke check (Task 16), mirroring the Lit sibling at
 *   playground/components/demo-weather-card.ts.
 *
 *   FAST's `ui()` renderer (@microsoft/fast-ssr's templateRenderer) works
 *   off a plain HTML *attribute string*, not a lit-html property binding —
 *   this is the concrete proof that the UIResult contract is not secretly
 *   Lit-shaped (RFC vertical-slice item 4). Because of that, `tempC` must be
 *   attribute-backed (`@attr`) with an EXPLICIT kebab-case attribute name +
 *   numeric converter: FAST's default attribute-name inference for `@attr`
 *   is a bare `name.toLowerCase()` (`tempc`), not Lit's automatic
 *   camelCase-to-kebab-case conversion, so `temp-c="21"` would not reach a
 *   plain `@attr tempC` without the explicit mapping below.
 *
 *   THE DOM-SHIM IMPORTS BELOW, BEFORE `@microsoft/fast-element`, ARE LOAD-
 *   BEARING — do not remove or reorder them relative to the fast-element
 *   import beneath them:
 *
 *   `@microsoft/fast-element` accesses `document` at module-eval time
 *   (`styles/element-styles.js`: `document.adoptedStyleSheets`,
 *   `CSSStyleSheet.prototype`), so `document` must already exist the first
 *   time it is imported anywhere in the process. The page pipeline handles
 *   this for `pages/*.ts` via an inline preamble textually embedded at the
 *   top of the generated `#litro/page-manifest` stub (manifestPreamble() in
 *   packages/framework/src/adapter/fast/index.ts) — but this app's agent
 *   tool chain (`#litro/agent-manifest`, reached via the POST/GET
 *   `/__litro/agent/:agent/:session` handlers in nitro.config.ts) has no
 *   such preamble.
 *
 *   Putting an equivalent DOM-shim import in `agents/demo/tools/
 *   get-weather.ts` (this module's only importer) instead of here does NOT
 *   work reliably: this app's dev bundler (Nitro/Rolldown) was observed —
 *   by bisecting against a baseline build with no agent files and
 *   inspecting the generated `.nitro/dev/index.mjs` directly — to not
 *   honor import declaration order for `@microsoft/fast-ssr` vs
 *   `@microsoft/fast-element` ACROSS file boundaries (the agent handler
 *   routes are registered ahead of the auto-discovered catch-all page
 *   route, and `@microsoft/fast-element`'s bare import ended up hoisted
 *   ahead of a `@microsoft/fast-ssr` import declared earlier in a
 *   DIFFERENT file, regardless of source order there). It DOES, however,
 *   honor declaration order WITHIN a single file's own import list — which
 *   is why the fix lives here, as this file's own first imports, rather
 *   than in its caller.
 */
import * as _domShim from '@microsoft/fast-ssr/install-dom-shim.js';
(globalThis as Record<string, unknown>).__litro_dom_shim__ = _domShim;
import _fastSSR from '@microsoft/fast-ssr';
const _ssrResult = _fastSSR({ renderMode: 'async' });
// `??=` so this cooperates with (never overwrites) the page pipeline's own
// singleton if that preamble already ran first in this process.
(globalThis as Record<string, unknown>).__litro_fast_template_renderer__ ??= _ssrResult.templateRenderer;
import { FASTElement, attr, nullableNumberConverter, html, css } from '@microsoft/fast-element';

export class DemoWeatherCard extends FASTElement {
  @attr city = '';
  @attr({ attribute: 'temp-c', converter: nullableNumberConverter }) tempC: number | null = 0;
  @attr summary = '';
}

DemoWeatherCard.define({
  name: 'demo-weather-card',
  template: html<DemoWeatherCard>`
    <div id="weather-card-root">
      <span class="city">${(x) => x.city}</span>
      <span class="temp">${(x) => x.tempC}&deg;C</span>
      <span class="summary">${(x) => x.summary}</span>
    </div>
  `,
  styles: css`
    :host {
      display: block;
    }
    #weather-card-root {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      padding: 1rem;
      border: 1px solid #ccc;
      border-radius: 0.5rem;
      max-width: 16rem;
      font-family: system-ui, sans-serif;
    }
    .city {
      font-weight: 600;
    }
  `,
});

export default DemoWeatherCard;
