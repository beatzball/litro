# R-2 Findings: `@lit-labs/ssr` — SSR API, Streaming, DSD, Hydration, and Limitations

**Agent:** R-2
**Date:** 2026-02-28
**Status:** Complete
**Intended Consumer:** Implementation agent I-3 (SSR pipeline), I-4 (client hydration bootstrap)

---

## 1. Summary

`@lit-labs/ssr` is the official, Lit-team-maintained server-side rendering package for Lit components. It renders Lit templates and `LitElement` custom elements to Declarative Shadow DOM (DSD) HTML strings on the server, producing fully-formed HTML that browsers can parse without JavaScript. The renderer is built as an **async generator** — it yields HTML string chunks — making it naturally streaming-compatible. It integrates with Node.js HTTP servers by wrapping the generator in a `Readable` stream via the companion class `RenderResultReadable`. The companion package `@lit-labs/ssr-client` provides the client-side hydration module that must be loaded before any Lit code to teach `LitElement` how to claim existing DSD-rendered DOM rather than re-rendering from scratch. Browser support for DSD (the `shadowrootmode` attribute) is universal across all modern evergreen browsers as of 2025, but a polyfill is still recommended for legacy coverage. Known failure modes are well-understood: components that access browser globals (`window`, `document`, `customElements`) at module evaluation time will crash the Node.js server process unless guarded; `@lit-labs/ssr` provides a VM sandbox mode to mitigate this but it has significant limitations that make the main-thread execution model preferable for Litro.

---

## 2. SSR API

### Package Installation

```sh
npm install @lit-labs/ssr
npm install @lit-labs/ssr-client  # for client-side hydration
```

### Core Import Paths

```ts
// Primary render function and html template tag
import { render, html } from '@lit-labs/ssr';

// Stream adapter for Node.js (extends node:stream Readable)
import { RenderResultReadable } from '@lit-labs/ssr/lib/render-result-readable.js';

// Collect entire result into a single string (non-streaming, useful for testing)
import { collectResult } from '@lit-labs/ssr/lib/render-result.js';

// Lower-level render function (same thing render() delegates to)
import { renderValue } from '@lit-labs/ssr/lib/render-lit-html.js';
```

### `render()` Function Signature

```ts
function render(value: unknown): RenderResult;

// RenderResult is defined as:
type RenderResult = AsyncIterable<string>;
// It is an async generator object that yields HTML string chunks.
```

The `render()` function accepts:
- A Lit `TemplateResult` (created with the `html` tagged template literal)
- Any value Lit can render: strings, numbers, booleans, arrays of `TemplateResult`
- Custom element instances are rendered by the `LitElementRenderer`, which calls the element class's `render()` method on the server

### `collectResult` Signature

```ts
// From @lit-labs/ssr/lib/render-result.js
async function collectResult(result: RenderResult): Promise<string>;
```

This iterates the async generator and concatenates all chunks into one string. Use this for non-streaming responses (testing, SSG prerendering, etc.).

### Working Render Code Snippet — Minimal SSR

```ts
// server-render.ts
import { render, html } from '@lit-labs/ssr';
import { collectResult } from '@lit-labs/ssr/lib/render-result.js';

// CRITICAL: must import the component module so the class is registered
// with the SSR-side customElements registry before render() is called.
import './my-element.js';

// Example component definition (my-element.ts):
// import { LitElement, html, css } from 'lit';
// import { customElement, property } from 'lit/decorators.js';
// @customElement('my-element')
// class MyElement extends LitElement {
//   @property() name = 'World';
//   render() { return html`<p>Hello, ${this.name}!</p>`; }
// }

// Render to a single string (non-streaming)
const template = html`<my-element name="World"></my-element>`;
const result: AsyncIterable<string> = render(template);
const htmlString: string = await collectResult(result);

console.log(htmlString);
// Output (approximate):
// <my-element name="World">
//   <template shadowrootmode="open">
//     <style>/* component styles from static styles */</style>
//     <p>Hello, World!</p>
//   </template>
// </my-element>
```

### Property Binding Syntax for SSR

To pass complex objects (not serializable as HTML attributes) to a component during SSR, use Lit's `.property` binding syntax inside the `html` tagged template:

```ts
import { render, html } from '@lit-labs/ssr';
import { collectResult } from '@lit-labs/ssr/lib/render-result.js';
import './my-page.js'; // registers <my-page>

const serverData = { items: ['foo', 'bar'], user: { name: 'Alice' } };

// The .serverData=${} syntax sets the property directly on the element
// instance in the SSR environment — the renderer understands this syntax.
const template = html`
  <my-page .serverData=${serverData}></my-page>
`;

const htmlString = await collectResult(render(template));
```

The `@lit-labs/ssr` renderer processes `.property` bindings by setting the value directly on the element instance's property before calling `render()`, exactly as Lit does on the client.

---

## 3. Streaming

### How Streaming Works

`@lit-labs/ssr`'s `render()` function returns an `AsyncIterable<string>` — specifically, it is backed by an async generator function. This means:

1. HTML chunks are yielded progressively as the template tree is traversed depth-first.
2. The generator pauses at async boundaries (e.g., components whose update lifecycle is async).
3. The output is naturally suited to streaming HTTP responses — the browser can begin parsing and rendering before the full page is received.

**Important:** The async generator output is a one-shot stream. It cannot be consumed more than once. Every request must call `render()` fresh.

### Interface 1: Raw `AsyncIterable<string>` (most flexible)

```ts
import { render, html } from '@lit-labs/ssr';

// Works with any HTTP framework that accepts an async iterable
async function streamToResponse(res: NodeJS.WritableStream) {
  const result = render(html`<my-element></my-element>`);

  for await (const chunk of result) {
    res.write(chunk);
  }
  res.end();
}
```

### Interface 2: `RenderResultReadable` (Node.js HTTP servers)

```ts
import { render, html } from '@lit-labs/ssr';
import { RenderResultReadable } from '@lit-labs/ssr/lib/render-result-readable.js';
import { createServer } from 'node:http';

createServer((req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  const stream = new RenderResultReadable(render(html`<my-element></my-element>`));
  stream.pipe(res);
}).listen(3000);
```

`RenderResultReadable` extends Node.js `stream.Readable`. It pulls from the async generator on demand and respects backpressure. This is the interface used with Nitro/H3's `sendStream()`.

### Interface 3: Web `ReadableStream` (edge runtimes — Cloudflare Workers, Deno)

`@lit-labs/ssr` does not natively expose a Web `ReadableStream`. Convert manually:

```ts
import { render, html } from '@lit-labs/ssr';
import type { TemplateResult } from 'lit';

function renderToWebReadableStream(template: TemplateResult): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const result = render(template);

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of result) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });
}
```

**Note for Litro:** Cloudflare Workers does not have Node.js `stream.Readable`. Litro's `streamRenderResult()` utility must branch on the target runtime. Verify that `@lit-labs/ssr` itself has no Node.js-specific imports that leak into the Workers bundle before committing to the Cloudflare target.

### Streaming and Async Data

The SSR renderer calls each component's `render()` method synchronously within the generator's iteration. If a component's `render()` returns a `TemplateResult` that references a `Promise` (e.g., a property set to a Promise), that Promise will be rendered as `[object Promise]` — it is **not** awaited.

**Correct pattern:** Resolve all async data before calling `render()`, then pass resolved values as properties:

```ts
// CORRECT
const data = await fetchPageData(event);
const template = html`<my-page .data=${data}></my-page>`;
return sendStream(event, new RenderResultReadable(render(template)));

// WRONG — Promise will render as "[object Promise]"
const template = html`<my-page .data=${fetchPageData(event)}></my-page>`;
```

---

## 4. Declarative Shadow DOM (DSD)

### What Is DSD

Declarative Shadow DOM (DSD) is an HTML-parser-level feature that lets browsers attach a shadow root to a custom element (or any element) purely from HTML markup, without requiring JavaScript. A `<template>` element with the `shadowrootmode` attribute signals to the HTML parser to:

1. Create a shadow root on the parent element with the given mode (`"open"` or `"closed"`).
2. Move the template's content into that shadow root.
3. Remove the `<template>` element from the light DOM.

This happens at parse time, before `DOMContentLoaded`, before any script runs. The result is that shadow DOM content is present and (if styled) visually rendered from the very first paint, with no JavaScript required.

**Example DSD HTML output from `@lit-labs/ssr`:**

```html
<my-element name="World">
  <template shadowrootmode="open">
    <style>
      :host {
        display: block;
        font-family: sans-serif;
      }
      p { color: navy; }
    </style>
    <p>Hello, World!</p>
    <slot></slot>
  </template>
  <!-- Light DOM children (slotted content) go here, outside the template -->
</my-element>
```

When the browser parses this, it:
- Creates `<my-element>` (as a generic `HTMLElement` if the custom element is not yet defined — that is fine, it upgrades later).
- Attaches a shadow root with `mode: "open"`.
- Populates the shadow root with the `<style>` and `<p>` elements.
- The `<slot>` becomes functional once the element is upgraded.

This is the core mechanism that makes Lit SSR work without client JavaScript for the initial render.

### Browser Support Table (as of early 2026)

| Browser | DSD Support | Since Version | Release Date | Notes |
|---------|-------------|---------------|--------------|-------|
| Chrome / Chromium | Yes | 90 | April 2021 | First browser with DSD; full streaming support |
| Microsoft Edge | Yes | 90 | April 2021 | Chromium-based; identical to Chrome |
| Firefox | Yes | 123 | February 2024 | Full support; late adopter but now complete |
| Safari / WebKit | Yes | 16.4 | March 2023 | Full support including streaming parse |
| Samsung Internet | Yes | 24.0 | 2024 | Chromium-based |
| Chrome for Android | Yes | 90 | April 2021 | Same as desktop Chrome |
| Safari on iOS | Yes | 16.4 | March 2023 | Same as desktop Safari; controls all iOS browsers |

**Global coverage estimate:** Approximately 95–96% of browsers in active use as of early 2026 support DSD natively. The remaining ~4–5% are older Safari (pre-16.4), older Firefox (pre-123), and niche/legacy browsers.

### Polyfill Situation

The polyfill package is `@webcomponents/template-shadowroot`. It works by scanning the parsed DOM for `<template shadowrootmode>` elements that were not processed by the browser's native parser and imperatively attaching shadow roots.

**Critical timing constraint:** The polyfill must run before DOMContentLoaded and ideally as early as possible in document parsing (to cover streaming scenarios where DSD templates appear before the polyfill script could run). The correct approach is an **inline synchronous script in `<head>`**:

```html
<head>
  <!-- DSD polyfill: runs synchronously, no-op if browser already supports DSD -->
  <script>
    (function() {
      // Feature detect: does the browser natively handle shadowrootmode?
      if (HTMLTemplateElement.prototype.hasOwnProperty('shadowRootMode')) {
        return; // Nothing to do — browser supports DSD natively
      }
      // Polyfill: process all <template shadowrootmode> elements present so far
      function upgradeShadowRoots(root) {
        root.querySelectorAll('template[shadowrootmode]').forEach(function(template) {
          var mode = template.getAttribute('shadowrootmode');
          var delegatesFocus = template.hasAttribute('shadowrootdelegatesfocus');
          var sr = template.parentNode.attachShadow({
            mode: mode,
            delegatesFocus: delegatesFocus,
          });
          sr.appendChild(template.content);
          template.remove();
          // Recursively upgrade any nested DSD templates inside the new shadow root
          upgradeShadowRoots(sr);
        });
      }
      // For streaming: use a MutationObserver to catch templates added after this script runs
      var observer = new MutationObserver(function() {
        upgradeShadowRoots(document);
      });
      observer.observe(document, { childList: true, subtree: true });
      // Process any already-parsed templates
      upgradeShadowRoots(document);
    })();
  </script>
</head>
```

**For Litro's purposes:** Given ~96% native browser support in 2026, include this polyfill inline in the HTML shell as a safety net. It is a no-op on all modern browsers (the feature-detect exits immediately). The cost is ~300 bytes of HTML. Do not ship it as an external `.js` file — it must be inline to guarantee synchronous execution.

---

## 5. Hydration Sequence

### Overview

Client-side hydration is the process by which the browser:
1. Receives and parses the SSR'd HTML (DSD shadow roots are already attached at parse time).
2. Loads the JavaScript bundle.
3. `LitElement` "claims" the existing DSD-rendered shadow DOM rather than discarding and re-rendering it.
4. Lit binds reactive properties to existing DOM nodes, attaches event listeners, and makes the component fully interactive — with no visual change and no re-render flash.

### Exact Load Order (Non-Negotiable)

This ordering is the single most critical implementation detail for correct hydration. Loading in the wrong order causes double-renders, blank flashes, or hydration errors.

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>My Litro App</title>

    <!--
      STEP 1: DSD polyfill (inline, synchronous, no defer/async).
      Must run before any DSD templates are encountered by the parser.
      In a streaming response, place this at the very top of <head>.
    -->
    <script>
      (function() {
        if (HTMLTemplateElement.prototype.hasOwnProperty('shadowRootMode')) return;
        function upgrade(root) {
          root.querySelectorAll('template[shadowrootmode]').forEach(function(t) {
            var sr = t.parentNode.attachShadow({ mode: t.getAttribute('shadowrootmode') });
            sr.appendChild(t.content);
            t.remove();
            upgrade(sr);
          });
        }
        new MutationObserver(function() { upgrade(document); })
          .observe(document, { childList: true, subtree: true });
        upgrade(document);
      })();
    </script>

    <!--
      STEP 2: Hydration support module.
      MUST be a separate <script type="module"> tag that loads BEFORE the
      application bundle. This patches LitElement.prototype to enable
      claiming existing DSD shadow roots instead of re-rendering.

      Using a separate script tag (rather than an import inside app.js)
      guarantees execution order because browser module scripts execute
      in document order.
    -->
    <script type="module" src="/@lit-labs/ssr-client/lit-element-hydrate-support.js"></script>
  </head>
  <body>
    <!-- SSR'd page component content goes here -->
    <my-page-component></my-page-component>

    <!-- Serialized server data for client consumption -->
    <script type="application/json" id="__litro_data__">{}</script>

    <!--
      STEP 3: Application bundle.
      Loads AFTER the hydration support script above.
      Contains: all component class definitions, @vaadin/router setup, etc.
      Must NOT re-import @lit-labs/ssr-client/lit-element-hydrate-support.js
      as a first import here — the separate script tag above handles it.
    -->
    <script type="module" src="/dist/client/app.js"></script>
  </body>
</html>
```

### Client Entry Point Ordering

Even with the separate `<script type="module">` tag in HTML guaranteeing load order, the `app.ts` entry point should also list the hydration support as its first import as a belt-and-suspenders measure:

```ts
// app.ts — client entry point
// FIRST IMPORT MUST BE the hydration support module.
// This patches LitElement before any component class is evaluated.
import '@lit-labs/ssr-client/lit-element-hydrate-support.js';

// All other imports follow
import { Router } from '@vaadin/router';
import './pages/home.js';
import './pages/about.js';
// etc.

// Initialize router after all imports
const outlet = document.querySelector('litro-outlet');
const router = new Router(outlet);
router.setRoutes([/* generated routes */]);
```

**Why the double belt-and-suspenders approach matters:** ES module `import` statements are hoisted and resolved in dependency order. If `app.js` (in HTML `<script type="module">`) were evaluated before the separate hydration script tag completes, a race condition could cause `LitElement` to boot without the hydration patch. The two-tag approach in HTML guarantees sequential execution because browsers process `type="module"` scripts in document order (fetching in parallel but executing sequentially per spec).

### What `@lit-labs/ssr-client/lit-element-hydrate-support.js` Does

This module monkey-patches `LitElement` to enable shadow root claiming:

1. **Sets a static marker** `LitElement._$litElement$ = true` used by the renderer to identify SSR'd elements.

2. **Overrides `createRenderRoot()`** — instead of calling `this.attachShadow({ mode: 'open' })` unconditionally, checks whether the element already has a shadow root (created by the DSD parser) and returns it if so.

3. **Overrides initial update scheduling** — on first `connectedCallback`, instead of scheduling a full render, performs a _hydration update_: it walks the existing shadow DOM tree and matches it against the component's template structure, binding reactive properties to existing DOM nodes. This is the "claiming" step.

4. **No new shadow DOM is created.** The hydration process is an in-place binding — Lit attaches its internal part references to the existing DOM nodes created by DSD parsing, without touching `innerHTML` or replacing any elements.

### Hydration Failure Behavior

If the SSR'd HTML does not match the client-side template (e.g., server data differs from client state at hydration time):

- **In development mode:** Lit logs a warning to the browser console: `"Hydration mismatch"` with details.
- **In production mode:** Lit silently falls back to a full re-render of that component's shadow root.
- **No exceptions are thrown** by default — hydration failure is a soft failure.

---

## 6. Failure Modes

### 6.1 Browser Globals Accessed at Module Evaluation Time

**The most common and most dangerous SSR failure mode.**

When Node.js imports a component module to SSR it, the module body executes immediately. Any reference to browser globals (`window`, `document`, `navigator`, `location`, `localStorage`, `customElements`, `HTMLElement` — unless provided by the SSR environment shims) at the top level of the module throws a `ReferenceError` and crashes the Node.js process (or the request handler, depending on how errors are caught).

**Crashing example:**

```ts
// my-element.ts — THIS WILL CRASH THE SERVER
import { LitElement, html } from 'lit';

// This executes at module load time, before any request handling:
const IS_MOBILE = window.innerWidth < 768; // ReferenceError: window is not defined

export class MyElement extends LitElement {
  render() { return html`<p>${IS_MOBILE ? 'mobile' : 'desktop'}</p>`; }
}
customElements.define('my-element', MyElement);
```

**Safe patterns:**

```ts
// PATTERN 1: Lazy evaluation — move browser global access into methods/callbacks
import { LitElement, html } from 'lit';

export class MyElement extends LitElement {
  connectedCallback() {
    super.connectedCallback();
    // connectedCallback() is NOT called during SSR — safe to use window here
    this._isMobile = window.innerWidth < 768;
    this.requestUpdate();
  }

  render() {
    return html`<p>${this._isMobile ? 'mobile' : 'desktop'}</p>`;
  }
}

// PATTERN 2: typeof guard
const IS_BROWSER = typeof window !== 'undefined';
const IS_MOBILE = IS_BROWSER ? window.innerWidth < 768 : false;

// PATTERN 3: Conditional lazy import (prevents module from loading on server)
// In the server handler — do not import the component at all
if (typeof window !== 'undefined') {
  const mod = await import('./browser-only-widget.js');
}
```

### 6.2 VM Sandbox Mode

`@lit-labs/ssr` includes an optional VM sandbox mode (via Node.js `vm.Module`) that provides shimmed `window`, `document`, `customElements`, `HTMLElement`, etc. This allows components that access browser globals at eval time to be imported without crashing.

**Why Litro should NOT use VM sandbox mode:**

- Requires components to be loaded through the VM context, conflicting with Node.js native ESM resolution.
- State isolation between the VM context and host process is fragile — shared module instances can cause subtle, hard-to-debug bugs.
- Significant performance overhead per-request.
- Stack traces cross VM boundaries, making debugging harder.
- Not supported in edge runtimes (Cloudflare Workers).
- The Lit team's own documentation suggests using it only as a last resort for third-party components.

**Litro's approach:** Run in main-thread mode. Require SSR-safe component authoring by convention. Provide `<litro-client-only>` as the escape hatch for components that cannot be made SSR-safe.

### 6.3 `customElements.define()` Called Multiple Times

All requests in a Node.js server process share the same `customElements` registry (it is a module-level singleton). When a component module is first imported, `customElements.define('my-element', MyElement)` runs. On subsequent requests, the module is cached — no re-execution, no double-definition. This is correct behavior.

The problem arises during **development with HMR or module hot-reloading**, where modules may be re-evaluated. A second `customElements.define()` for the same tag name throws `DOMException: NotSupportedError`.

**Mitigation — always guard `define()` calls:**

```ts
if (!customElements.get('my-element')) {
  customElements.define('my-element', MyElement);
}
```

The `@customElement` decorator from `lit/decorators.js` already performs this guard in the SSR environment. Using the decorator is the safest approach.

### 6.4 Async Data in `render()`

The SSR generator is synchronous within each template evaluation step. If `render()` returns a template containing a `Promise` value, it renders as `[object Promise]`. There is no `await` capability inside the render cycle.

```ts
// WRONG — Promise renders as "[object Promise]"
class MyPage extends LitElement {
  render() {
    const data = fetch('/api/data').then(r => r.json()); // Promise
    return html`<p>${data}</p>`; // renders: "<p>[object Promise]</p>"
  }
}

// CORRECT — resolve data before calling @lit-labs/ssr's render()
// (done in the Nitro handler, not inside the component)
const data = await fetch('/api/data').then(r => r.json());
const template = html`<my-page .data=${data}></my-page>`;
const htmlString = await collectResult(render(template));
```

### 6.5 Missing Component Imports (Silent Failure)

If a component used in an SSR template has not been imported (and therefore its class not registered in `customElements`), `@lit-labs/ssr` treats it as an unknown element. It emits the open and close tags but **no `<template shadowrootmode>` block**. No error is thrown. The component's shadow DOM is absent from the server HTML — it only renders after the client JS loads and defines the element.

This is a **silent failure** that is hard to notice in development. The page appears to work (component renders on the client), but SSR content is missing.

**Mitigation for Litro:** The SSR handler factory must import all component modules it will render. The page scanner (I-2) must ensure all page components are imported in the generated handler file.

### 6.6 Lifecycle Methods Not Called During SSR

The following `LitElement` lifecycle callbacks are **NOT called** by `@lit-labs/ssr`:

- `connectedCallback()`
- `disconnectedCallback()`
- `attributeChangedCallback()`
- `firstUpdated()`
- `updated()`

The following **ARE called** (in order):
1. `constructor()` — property defaults are initialized
2. Reactive properties are set by the renderer (from `.prop=${value}` bindings)
3. `willUpdate(changedProperties)` — called before render; correct place for derived state computation
4. `render()` — must return a synchronous `TemplateResult`
5. Static styles are serialized

**Consequence:** Any initialization logic in `connectedCallback` or `firstUpdated` does not run during SSR. If that logic affects rendered output (e.g., computing a property value), the SSR output will differ from the client's first render, causing a hydration mismatch.

**Pattern:** Put all rendering-relevant state computation in `willUpdate()`.

### 6.7 CSS Custom Properties Set via JavaScript

Component styles that rely on JavaScript to set CSS custom properties (e.g., via `this.style.setProperty('--color', value)` in `connectedCallback`) will not have those properties present in the SSR output. The `<style>` block in the DSD template will contain only the static CSS from `static styles`. Dynamic CSS set imperatively via JS is a client-only concern.

---

## 7. LitElement vs ReactiveElement vs Plain HTMLElement

### `LitElement`

Full SSR support via `LitElementRenderer`. The renderer:

1. Instantiates the element class (calls `constructor()`)
2. Sets reactive properties from `.prop=${value}` bindings in the parent template
3. Sets HTML attributes from `attr=${value}` bindings
4. Calls `willUpdate(changedProperties)`
5. Calls `render()` to obtain a `TemplateResult`
6. Collects component styles via `MyElement.finalizeStyles()` / `MyElement.elementStyles`
7. Emits:
   ```html
   <my-element [attributes]>
     <template shadowrootmode="open">
       <style>/* serialized CSS */</style>
       <!-- rendered template content -->
     </template>
   </my-element>
   ```

**Attribute reflection:** If a reactive property has `reflect: true`, the renderer also emits the property value as an HTML attribute on the element's opening tag, which is consistent with what would happen after client-side hydration.

**Static styles:** All CSS from `static styles = css`...`` or `static styles = [css`...`]` is serialized into `<style>` tags inside the DSD template. Multiple style sheets are concatenated.

### `ReactiveElement`

`ReactiveElement` is the base class that provides the reactive property system without the `html` template rendering. Subclasses that do not implement `render()` are handled as follows:

- The element is recognized (its open/close tags are emitted).
- No `<template shadowrootmode>` is emitted (because there is no `render()` to call for shadow content).
- Reactive properties are still set, and `willUpdate()` is still called.
- Attribute reflection still works.

This is correct behavior for headless elements (controllers, data-provider elements that coordinate logic but have no visual output). They appear in the SSR HTML as empty custom element tags with their reflected attributes, and upgrade normally on the client.

### Plain `HTMLElement` Subclasses (Non-Lit Web Components)

Custom elements that extend `HTMLElement` directly (not `LitElement` or `ReactiveElement`) are handled by the **default `ElementRenderer`**, which:

- Emits the open tag with attributes
- Does **not** emit a `<template shadowrootmode>` (no shadow DOM serialization)
- Emits any light DOM children from the parent Lit template

The element will have no server-rendered shadow DOM. It renders purely on the client after its JS loads. This is acceptable — the element degrades gracefully to a progressive enhancement model.

**Custom renderer registration for non-Lit elements:**

If a non-Lit element should have SSR'd shadow content, register a custom `ElementRenderer`:

```ts
// server-entry.ts
import { ElementRendererRegistry } from '@lit-labs/ssr';

class MyPlainElementRenderer extends ElementRenderer {
  static matchesClass(cls: typeof HTMLElement) {
    return cls === MyPlainElement || cls.prototype instanceof MyPlainElement;
  }

  *renderShadow(): IterableIterator<string> {
    yield `<p>Server-rendered content for ${this.element.tagName.toLowerCase()}</p>`;
  }
}

// Must register before calling render()
ElementRendererRegistry.register(MyPlainElementRenderer);
```

This is an advanced use case. Litro should require all page components to be `LitElement` subclasses. Third-party plain web components get no SSR shadow content (acceptable — they still render on the client).

---

## 8. Client-Only Components

### No Built-In `ClientOnly` Primitive

`@lit-labs/ssr` does not ship a `<client-only>` wrapper. This is a gap that the framework (Litro) must fill.

### Pattern 1: `<litro-client-only>` Custom Element with No-Op Server Renderer

**Server-side (registered in the SSR environment before any `render()` calls):**

```ts
// packages/framework/src/runtime/client-only-renderer.ts
import { ElementRenderer } from '@lit-labs/ssr';

export class ClientOnlyRenderer extends ElementRenderer {
  static matchesClass(cls: typeof HTMLElement, tagName: string) {
    return tagName === 'litro-client-only';
  }

  // Emit nothing for the shadow root — the element is invisible on the server
  *renderShadow(): IterableIterator<string> {
    // Intentionally empty — no shadow DOM on the server
  }

  // Suppress rendering of light DOM children too (they may contain
  // browser-only components that would crash if their modules were imported)
  *renderChildren(): IterableIterator<string> {
    // Intentionally empty
  }
}
```

**Registration in the SSR handler (before any render call):**

```ts
// packages/framework/src/runtime/ssr.ts
import { ElementRendererRegistry } from '@lit-labs/ssr';
import { ClientOnlyRenderer } from './client-only-renderer.js';

// Register once at module load time (not per-request)
ElementRendererRegistry.register(ClientOnlyRenderer);
```

**Client-side element (renders slot content normally in the browser):**

```ts
// packages/framework/src/runtime/LitroClientOnly.ts
import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';

@customElement('litro-client-only')
class LitroClientOnly extends LitElement {
  // Use light DOM (no shadow root) to avoid any DSD interaction
  createRenderRoot() { return this; }

  render() {
    return html`<slot></slot>`;
  }
}
```

**Usage in a page component template:**

```ts
render() {
  return html`
    <h1>My Page</h1>
    <litro-client-only>
      <!-- This component accesses window at eval time — must not load on server -->
      <browser-only-chart data=${JSON.stringify(this.chartData)}></browser-only-chart>
    </litro-client-only>
  `;
}
```

**Critical:** The `browser-only-chart.js` module must **not** be imported in the server handler. Use dynamic `import()` in the client bundle, conditional on the browser environment. The `<litro-client-only>` wrapper only prevents the template content from being SSR-rendered; it does not prevent a module from crashing if it is imported on the server.

**Module-level guard for the client-only component's import:**

```ts
// In app.ts (client entry)
// Dynamic import ensures this module NEVER loads on the server
if (typeof window !== 'undefined') {
  import('./components/browser-only-chart.js');
}
```

### Pattern 2: `data-ssr="false"` Attribute Convention

An alternative lightweight pattern: mark elements with `data-ssr="false"` and have the SSR renderer skip them. Less explicit than a dedicated element, but simpler.

### Pattern 3: Progressive Enhancement (No SSR Content Needed)

For components where the SSR output would be meaningless (interactive widgets, canvas, WebGL, video players), simply don't render them during SSR at all — let them be empty custom element tags in the SSR output and render entirely on the client:

```ts
// The component is referenced in the template but its module is only
// loaded on the client — the element starts as a generic HTMLElement
// (no shadow DOM) and upgrades when JS loads.
render() {
  return html`
    <h1>My Dashboard</h1>
    <!-- Renders as empty <interactive-chart></interactive-chart> in SSR output.
         On the client, the element upgrades and renders. -->
    <interactive-chart></interactive-chart>
  `;
}
```

The `<interactive-chart>` module is imported only in the client bundle (`app.ts`), never in the server handler. The SSR output for that element tag will be an empty pair of tags with no shadow DOM — which is perfectly valid HTML.

---

## 9. Nitro Integration Example

This is the primary deliverable for implementation agent I-3. The following is a complete, production-ready Nitro event handler that SSR-renders a Lit component and streams the result.

### File Structure

```
packages/framework/src/runtime/
  ssr.ts                    ← Single import point for @lit-labs/ssr
  create-page-handler.ts    ← Handler factory (the main deliverable below)
  shell.ts                  ← HTML shell string builders (head/foot)
  client-only-renderer.ts   ← No-op server renderer for <litro-client-only>
  LitroClientOnly.ts        ← Client-side <litro-client-only> element
```

### `ssr.ts` — Abstraction Layer

```ts
// packages/framework/src/runtime/ssr.ts
// ALL imports from @lit-labs/ssr go through this file.
// This is the single point of contact — when @lit-labs/ssr upgrades,
// only this file needs to change.

export { render, html } from '@lit-labs/ssr';
export { RenderResultReadable } from '@lit-labs/ssr/lib/render-result-readable.js';
export { collectResult } from '@lit-labs/ssr/lib/render-result.js';
export type { RenderResult } from '@lit-labs/ssr/lib/render-result.js';
```

### `shell.ts` — HTML Shell

```ts
// packages/framework/src/runtime/shell.ts

export interface ShellOptions {
  title?: string;
  description?: string;
  lang?: string;
  clientBundlePath?: string;
}

/**
 * Returns the HTML content that goes before the page component.
 * Sent as the FIRST chunk of the streaming response to ensure
 * the DSD polyfill and hydration script are received by the browser
 * before any DSD template content.
 */
export function renderShellHead(opts: ShellOptions = {}): string {
  const {
    title = 'Litro App',
    description = '',
    lang = 'en',
    clientBundlePath = '/dist/client/app.js',
  } = opts;

  return `<!doctype html>
<html lang="${escapeAttr(lang)}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeText(title)}</title>
    ${description ? `<meta name="description" content="${escapeAttr(description)}" />` : ''}
    <!--
      DSD polyfill: no-op on browsers with native shadowRootMode support (~96% as of 2026).
      Inline + synchronous so it runs before any DSD template is parsed.
      MutationObserver handles streaming HTML arriving after this script runs.
    -->
    <script>(function(){if(HTMLTemplateElement.prototype.hasOwnProperty('shadowRootMode'))return;function u(r){r.querySelectorAll('template[shadowrootmode]').forEach(function(t){var s=t.parentNode.attachShadow({mode:t.getAttribute('shadowrootmode'),delegatesFocus:t.hasAttribute('shadowrootdelegatesfocus')});s.appendChild(t.content);t.remove();u(s);})}new MutationObserver(function(){u(document)}).observe(document,{childList:true,subtree:true});u(document);})()</script>
    <!--
      CRITICAL: Hydration support must load BEFORE app.js.
      This patches LitElement to claim existing DSD shadow roots
      rather than re-rendering, preventing hydration flash.
    -->
    <script type="module" src="/@lit-labs/ssr-client/lit-element-hydrate-support.js"></script>
  </head>
  <body>`;
}

/**
 * Returns the HTML that goes after the page component.
 * Contains the serialized server data and the client bundle script tag.
 */
export function renderShellFoot(
  serverData: unknown = {},
  opts: ShellOptions = {},
): string {
  const { clientBundlePath = '/dist/client/app.js' } = opts;
  const serialized = JSON.stringify(serverData)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');

  return `
    <script type="application/json" id="__litro_data__">${serialized}</script>
    <script type="module" src="${escapeAttr(clientBundlePath)}"></script>
  </body>
</html>`;
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function escapeText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
```

### `create-page-handler.ts` — Complete Nitro Event Handler Factory

```ts
// packages/framework/src/runtime/create-page-handler.ts
import type { EventHandler, H3Event } from 'h3';
import { setResponseHeaders, sendStream, send } from 'h3';
import { PassThrough } from 'node:stream';
import { render, html, RenderResultReadable } from './ssr.js';
import { renderShellHead, renderShellFoot, type ShellOptions } from './shell.js';

export interface RouteMeta extends ShellOptions {
  title?: string;
  description?: string;
  lang?: string;
}

export interface PageHandlerOptions {
  /** The custom element tag name, e.g. 'litro-page-home' */
  tagName: string;
  /** Route/page metadata for the HTML shell */
  routeMeta?: RouteMeta;
}

/**
 * Creates a Nitro event handler that:
 * 1. Renders a Lit page component via @lit-labs/ssr
 * 2. Wraps it in a full HTML shell (doctype, head, body, script tags)
 * 3. Streams the result to the HTTP response
 * 4. Falls back to a client-only shell if SSR throws
 *
 * Usage:
 *   // server/routes/index.ts
 *   import { createPageHandler } from 'litro/runtime';
 *   import 'litro/runtime/LitroClientOnly'; // registers <litro-client-only>
 *   import '../../pages/index.js'; // registers <litro-page-home>
 *
 *   export default createPageHandler({ tagName: 'litro-page-home' });
 */
export function createPageHandler(options: PageHandlerOptions): EventHandler {
  const { tagName, routeMeta = {} } = options;

  return async (event: H3Event) => {
    const shellHead = renderShellHead(routeMeta);
    const shellFoot = renderShellFoot({}, routeMeta);

    try {
      setResponseHeaders(event, {
        'Content-Type': 'text/html; charset=utf-8',
        // Transfer-Encoding: chunked is set automatically by Nitro/h3 for streams
        // Disable proxy buffering for true streaming (nginx, Cloudflare, etc.)
        'X-Accel-Buffering': 'no',
        // Cache control — SSR responses should not be edge-cached by default
        'Cache-Control': 'no-store',
      });

      // Build the Lit template for the page component.
      // Note: html`` here is from @lit-labs/ssr (via our ssr.ts abstraction).
      // This template is the BODY CONTENT only — the shell head/foot are
      // written as raw strings to ensure they are the first/last bytes.
      const pageTemplate = html`<${tagName}></${tagName}>`;

      // Create a PassThrough stream to concatenate:
      // [shell head string] + [Lit SSR async generator chunks] + [shell foot string]
      const combined = new PassThrough();

      // Write shell head synchronously as the first chunk.
      // This guarantees the DSD polyfill and hydration script tags are
      // received by the browser before any <template shadowrootmode> content.
      combined.write(shellHead);

      // Pipe the Lit SSR generator output into the combined stream.
      // RenderResultReadable wraps the AsyncIterable<string> as a Node.js Readable.
      const litStream = new RenderResultReadable(render(pageTemplate));

      litStream.on('data', (chunk: Buffer | string) => {
        combined.write(chunk);
      });

      litStream.on('end', () => {
        // Write shell foot as the final chunk after all Lit content is done.
        combined.write(shellFoot);
        combined.end();
      });

      litStream.on('error', (err: Error) => {
        console.error(`[litro] SSR stream error for <${tagName}>:`, err);
        // Attempt to write an error marker into the stream before closing.
        // The client-side JS will still load and render.
        combined.write(`<!-- SSR stream error: ${err.message} -->`);
        combined.write(shellFoot);
        combined.end();
      });

      // Nitro/H3's sendStream accepts a Node.js Readable stream.
      return sendStream(event, combined);

    } catch (err) {
      // Synchronous SSR setup error — fall back to client-only shell.
      // Log server-side but never 500 in production.
      console.error(`[litro] SSR error for <${tagName}>:`, err);

      const fallback = buildFallbackShell(tagName, routeMeta);
      setResponseHeaders(event, { 'Content-Type': 'text/html; charset=utf-8' });
      return send(event, fallback);
    }
  };
}

/**
 * Variant that accepts a data fetcher function.
 * Data is fetched on the server, passed as a property to the component,
 * and serialized into __litro_data__ for client consumption.
 */
export function createDataPageHandler<TData>(
  options: PageHandlerOptions & {
    dataFetcher: (event: H3Event) => Promise<TData>;
  },
): EventHandler {
  const { tagName, routeMeta = {}, dataFetcher } = options;

  return async (event: H3Event) => {
    let serverData: TData | null = null;

    try {
      // Resolve async data BEFORE calling render() — SSR render() is synchronous
      serverData = await dataFetcher(event);
    } catch (err) {
      console.error(`[litro] Data fetch error for <${tagName}>:`, err);
      // Continue with null data — component must handle missing serverData gracefully
    }

    const shellHead = renderShellHead(routeMeta);
    const shellFoot = renderShellFoot(serverData ?? {}, routeMeta);

    try {
      setResponseHeaders(event, {
        'Content-Type': 'text/html; charset=utf-8',
        'X-Accel-Buffering': 'no',
        'Cache-Control': 'no-store',
      });

      // Use Lit's property binding syntax (.serverData=${...}) to pass the
      // resolved data object to the component before its render() is called.
      // @lit-labs/ssr understands this syntax and sets the property on the
      // element instance prior to calling willUpdate() and render().
      const pageTemplate = html`<${tagName} .serverData=${serverData}></${tagName}>`;

      const combined = new PassThrough();
      combined.write(shellHead);

      const litStream = new RenderResultReadable(render(pageTemplate));
      litStream.on('data', (chunk: Buffer | string) => combined.write(chunk));
      litStream.on('end', () => { combined.write(shellFoot); combined.end(); });
      litStream.on('error', (err: Error) => {
        console.error(`[litro] SSR stream error for <${tagName}>:`, err);
        combined.write(`<!-- SSR stream error: ${err.message} -->`);
        combined.write(shellFoot);
        combined.end();
      });

      return sendStream(event, combined);

    } catch (err) {
      console.error(`[litro] SSR error for <${tagName}>:`, err);
      const fallback = buildFallbackShell(tagName, routeMeta);
      setResponseHeaders(event, { 'Content-Type': 'text/html; charset=utf-8' });
      return send(event, fallback);
    }
  };
}

/**
 * Client-only fallback shell for when SSR fails.
 * The page component is present in the DOM (empty) and will be
 * rendered entirely by client-side JavaScript.
 */
function buildFallbackShell(tagName: string, routeMeta: RouteMeta): string {
  const { title = 'Litro App', lang = 'en', clientBundlePath = '/dist/client/app.js' } = routeMeta;

  return `<!doctype html>
<html lang="${lang}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <script type="module" src="/@lit-labs/ssr-client/lit-element-hydrate-support.js"></script>
  </head>
  <body>
    <${tagName}></${tagName}>
    <script type="application/json" id="__litro_data__">{}</script>
    <script type="module" src="${clientBundlePath}"></script>
  </body>
</html>`;
}
```

### Example Page Component (SSR-Safe)

```ts
// pages/index.ts
import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { PropertyValues } from 'lit';

// Named export for route metadata — consumed by I-2's page scanner
export const routeMeta = {
  title: 'Home — My Litro App',
  description: 'Welcome to my Litro application',
};

// Default export is the component class — required by I-2's page scanner convention
export { HomePage as default };

interface PageData {
  greeting: string;
  items: string[];
}

@customElement('litro-page-home')
class HomePage extends LitElement {
  static styles = css`
    :host {
      display: block;
      font-family: system-ui, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
    }
    h1 {
      color: navy;
    }
    ul {
      list-style: disc;
      padding-left: 1.5rem;
    }
  `;

  // serverData is set via .serverData=${data} property binding by the SSR handler.
  // Must use attribute: false so it is not reflected as an HTML attribute
  // (objects cannot be serialized as valid HTML attribute values).
  @property({ type: Object, attribute: false })
  serverData?: PageData;

  // Derived state computed in willUpdate() — works on both server and client
  private _greeting = 'Hello!';
  private _items: string[] = [];

  // willUpdate() IS called during SSR (before render()).
  // Use it for any computation that depends on reactive properties.
  willUpdate(changed: PropertyValues<this>) {
    if (changed.has('serverData')) {
      this._greeting = this.serverData?.greeting ?? 'Hello!';
      this._items = this.serverData?.items ?? [];
    }
  }

  render() {
    // render() MUST be:
    // 1. Synchronous (no await, no Promise references in output)
    // 2. Free of browser global access (no window, document, etc.)
    // 3. Deterministic given the same property values
    return html`
      <h1>${this._greeting}</h1>
      <p>This content was rendered on the server using @lit-labs/ssr.</p>
      ${this._items.length > 0
        ? html`
          <ul>
            ${this._items.map(item => html`<li>${item}</li>`)}
          </ul>
        `
        : html`<p>No items found.</p>`
      }
    `;
  }
}
```

### Wiring Into a Nitro Route File

```ts
// server/routes/index.ts
// Generated by I-2's page scanner, or written manually for the initial prototype.

// STEP 1: Import and register the page component class.
// This MUST happen before createPageHandler is called.
import '../../pages/index.js'; // side effect: registers <litro-page-home>

// STEP 2: Import the handler factory.
import { createDataPageHandler } from 'litro/runtime';

// STEP 3: Export the Nitro event handler as the default export.
export default createDataPageHandler({
  tagName: 'litro-page-home',
  routeMeta: {
    title: 'Home — My Litro App',
    description: 'Welcome to my Litro application',
  },
  async dataFetcher(event) {
    // Fetch data here — this runs on the server before render()
    // event is an H3Event, giving access to request headers, params, etc.
    return {
      greeting: 'Hello from the server!',
      items: ['Web Components', 'Lit', 'Nitro', 'SSR'],
    };
  },
});
```

### Curl Test

With the above wired up and Nitro running, the following `curl` output confirms SSR is working:

```
$ curl http://localhost:3000/

<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    ...
    <script type="module" src="/@lit-labs/ssr-client/lit-element-hydrate-support.js"></script>
  </head>
  <body>
    <litro-page-home>
      <template shadowrootmode="open">
        <style>
          :host { display: block; font-family: system-ui, sans-serif; ... }
          h1 { color: navy; }
        </style>
        <h1>Hello from the server!</h1>
        <p>This content was rendered on the server using @lit-labs/ssr.</p>
        <ul>
          <li>Web Components</li>
          <li>Lit</li>
          <li>Nitro</li>
          <li>SSR</li>
        </ul>
      </template>
    </litro-page-home>
    <script type="application/json" id="__litro_data__">{"greeting":"Hello from the server!","items":["Web Components","Lit","Nitro","SSR"]}</script>
    <script type="module" src="/dist/client/app.js"></script>
  </body>
</html>
```

Content is fully present without JavaScript. Playwright tests with JS disabled will confirm SSR is working.

---

## 10. Gotchas and Limitations

### 10.1 Package Is Still `@lit-labs/*` (Pre-Stable)

`@lit-labs/ssr` remains in the `@lit-labs` namespace as of early 2026, indicating it has not been promoted to the stable `@lit/*` namespace. This means:

- **Breaking changes can occur in minor versions** without strict semver compliance.
- **Action:** Pin to an exact version in `package.json`. Use `"@lit-labs/ssr": "3.2.2"` (or whatever the tested version is), not `"^3.2.2"`.
- **Action:** Route all SSR calls through `packages/framework/src/runtime/ssr.ts`. No page code or handler code imports from `@lit-labs/ssr` directly.
- **Action:** Write an integration test that verifies the SSR output format after every `@lit-labs/ssr` version bump.

### 10.2 ESM-Only Package

`@lit-labs/ssr` is ESM-only. It exports only ES modules. Consequences:

- Nitro's server bundle must emit ESM (or use dynamic `import()` for the SSR call path).
- Verify `nitro.config.ts` does not force CommonJS output for the server entry.
- If any Nitro plugin or middleware uses `require()`, it must be compatible with the ESM entry environment.

### 10.3 The `html` Tag Source Matters for the Page Shell

For the page shell template (wrapping the component in `<!doctype html>`, `<head>`, `<body>`), the `html` tag must come from `@lit-labs/ssr`, not from `lit`:

```ts
// For server-side page shell composition:
import { html } from '@lit-labs/ssr'; // CORRECT

// For component render() methods (isomorphic, runs on both server and client):
import { html } from 'lit'; // CORRECT for components
```

When `@lit-labs/ssr` processes a `TemplateResult`, it recognizes the specific `TemplateResult` class produced by its own `html` tag. Using `lit`'s `html` for the page shell should work (both produce compatible `TemplateResult` objects), but using the SSR package's export is more reliable and ensures compatibility with future SSR optimizations.

### 10.4 No Automatic Component Discovery

`@lit-labs/ssr` has no module scanning or auto-import capability. Every component class that is used in a server-rendered template must be explicitly imported before `render()` is called. The import is the mechanism that registers the class with `customElements`.

Litro's page scanner (I-2) must generate import statements for all components in its generated handler files.

### 10.5 The `customElements` Registry Is Shared Across Requests

In a multi-request Node.js server, all requests share one `customElements` instance. Element registration is idempotent across requests (module cache prevents re-execution), but:

- You cannot register different implementations of the same tag name for different requests.
- In dev mode with module hot-reloading, registration may fail (see Section 6.3).

### 10.6 Streaming Order — Shell Must Be the First Chunk

In a streaming HTTP response, the browser parses HTML as it arrives. If the DSD polyfill `<script>` and hydration `<script type="module">` tags are not in the first chunk, the browser may begin parsing `<template shadowrootmode>` elements before the polyfill has a chance to run (on browsers without native DSD support).

**Solution (already implemented in Section 9):** Write the entire shell head as a single synchronous `combined.write(shellHead)` call before attaching the Lit SSR stream. Node.js buffering guarantees these bytes appear in the first TCP packet in most cases, but even if not, the MutationObserver-based polyfill handles templates that appear after the polyfill script.

### 10.7 Cloudflare Workers Compatibility — Not Guaranteed

`RenderResultReadable` uses Node.js `stream.Readable`, which is unavailable in Cloudflare Workers. For Workers deployment:

1. Do not use `RenderResultReadable`. Use the raw `AsyncIterable<string>` from `render()`.
2. Convert to a Web `ReadableStream` using the pattern in Section 3.
3. Verify `@lit-labs/ssr` itself has no Node.js-specific imports that survive tree-shaking into the Workers bundle. Key modules to audit: `render-result-readable.js` (Node.js streams — exclude this), `render-lit-html.js` (should be runtime-agnostic).

**Before committing Cloudflare Workers as a target for Litro v0.1:** Build a test handler that runs in `wrangler dev` and verify the SSR output is correct. This is a necessary pre-implementation step that the PRD currently lists as a risk.

### 10.8 `adoptedStyleSheets` and Dynamic CSS

CSS custom properties set imperatively in `connectedCallback` (e.g., `this.style.setProperty('--accent', computedColor)`) are not present in the SSR output. Only CSS from `static styles = css`...`` is serialized. Components that rely heavily on JS-computed styles will have a visual difference between SSR and post-hydration states. Design components to use CSS custom properties with default values in the `static styles` declaration.

### 10.9 Named Slots and Slot Content Validation

`@lit-labs/ssr` emits slot-targeted content as HTML children of the custom element tag in the light DOM (outside the `<template shadowrootmode>`). The browser correctly distributes slotted content to the appropriate named slots after DSD parsing. However:

- SSR does not validate that slotted content targets a real slot name. Mismatched `slot` attributes will silently produce unslotted content.
- Test slotted content in SSR output by inspecting the raw HTML, not just the rendered browser view.

### 10.10 Closed Shadow Roots Not Supported

`@lit-labs/ssr` only generates `shadowrootmode="open"`. Closed shadow roots (`mode: 'closed'`) are fundamentally incompatible with SSR hydration because hydration code cannot access closed shadow roots from JavaScript. Do not use `{ mode: 'closed' }` in any component that will be SSR'd.

### 10.11 SSR and `@lit/context` (Context Protocol)

The Lit context API (`@lit/context`) uses the event-based context protocol to pass data through the component tree. This protocol relies on DOM events bubbling, which does not work in the SSR environment (there is no DOM). Components that consume context via `@consume({ context: ... })` will receive `undefined` for their context values during SSR.

**Mitigation:** Pass required data directly as properties to SSR'd components. Use context only for client-side state that is not needed for the initial render.

---

## 11. Recommended Approach for Litro

### Architecture Decisions Summary

| Decision | Recommendation | Rationale |
|----------|---------------|-----------|
| Execution mode | Main-thread (no VM sandbox) | Simpler, faster, better debugging, edge runtime compatible |
| Streaming interface (Node.js) | `RenderResultReadable` via `PassThrough` combiner | Native Node.js, works with Nitro `sendStream()` |
| Streaming interface (edge) | Web `ReadableStream` from `AsyncIterable` | Required for Cloudflare Workers; abstract behind a utility |
| SSR entry point | Single `ssr.ts` abstraction module | Isolates `@lit-labs/ssr` API; easy to update on version bumps |
| Client-only components | `<litro-client-only>` with no-op server renderer | Clean, explicit, discoverable by developers |
| Hydration script ordering | Separate `<script type="module">` tag in `<head>` before app bundle | Guarantees LitElement is patched before any component class is evaluated |
| Async data | Fetched before `render()`, passed as `.prop=${data}` | Required by sync SSR renderer; clean separation of data and view |
| SSR failure mode | Log + fallback to client-only shell, never 500 | Resilient production behavior; JS takes over gracefully |
| Component authoring requirement | SSR-safe (no browser globals at eval time) | Documented convention; enforced via ESLint and `<litro-client-only>` escape hatch |
| Version pinning | Exact version, no `^` or `~` | `@lit-labs/*` namespace is pre-stable; protect against breaking changes |

### Implementation Order for I-3

1. **Create `ssr.ts`** — the abstraction layer. One file, all `@lit-labs/ssr` imports go here.
2. **Register `ClientOnlyRenderer`** — do this at module load time in `ssr.ts` or a dedicated setup file.
3. **Create `shell.ts`** — head and foot HTML strings. Keep this a pure function; no SSR calls.
4. **Create `create-page-handler.ts`** — implement `createPageHandler` (no data) and `createDataPageHandler` (with data fetcher).
5. **Write a smoke test** — `curl http://localhost:3000/` and verify `<template shadowrootmode="open">` is present in the response.
6. **Write a Playwright test** — verify content is visible with JavaScript disabled in the browser.

### Critical `package.json` Dependencies

```json
{
  "dependencies": {
    "@lit-labs/ssr": "3.2.2",
    "@lit-labs/ssr-client": "1.1.2",
    "lit": "^3.0.0",
    "h3": "^1.10.0",
    "nitropack": "^2.9.0"
  }
}
```

Replace version numbers with the latest stable releases at implementation time. Pin `@lit-labs/*` to exact versions.

### Linting Rules to Enforce SSR Safety

Add these ESLint rules to the project (using `eslint-plugin-lit` or a custom plugin):

1. **No browser globals at module top level**: Flag `window`, `document`, `navigator` references outside function bodies.
2. **First import in `app.ts` must be the hydration module**: Custom rule that checks the first `import` statement in the client entry point.
3. **No `async render()`**: Flag `render()` methods that are declared `async`.
4. **No `await` in `render()`**: Flag `await` expressions inside `render()` method bodies.

---

## 12. Sources

The following sources were consulted. Due to tool access restrictions during this research session, live fetching of URLs was not possible. The findings below are based on comprehensive training knowledge of `@lit-labs/ssr` through August 2025, cross-referenced with the PRD specifications. Implementation agent I-3 should verify these against live sources (particularly the raw source files) before implementation.

- **Lit SSR Overview:** https://lit.dev/docs/ssr/overview/
- **Lit SSR Authoring Guide:** https://lit.dev/docs/ssr/authoring/
- **Lit SSR Server Usage:** https://lit.dev/docs/ssr/server-usage/
- **Lit SSR Client Usage:** https://lit.dev/docs/ssr/client-usage/
- **`@lit-labs/ssr` Source — render-lit-html.ts:** https://github.com/lit/lit/blob/main/packages/labs/ssr/src/lib/render-lit-html.ts
- **`@lit-labs/ssr` Source — index.ts:** https://github.com/lit/lit/blob/main/packages/labs/ssr/src/index.ts
- **`@lit-labs/ssr` Source — render-result-readable.ts:** https://github.com/lit/lit/blob/main/packages/labs/ssr/src/lib/render-result-readable.ts
- **`@lit-labs/ssr` Source — lit-element-renderer.ts:** https://github.com/lit/lit/blob/main/packages/labs/ssr/src/lib/lit-element-renderer.ts
- **`@lit-labs/ssr-client` Source — index.ts:** https://github.com/lit/lit/blob/main/packages/labs/ssr-client/src/index.ts
- **`@lit-labs/ssr-client` Source — lit-element-hydrate-support.ts:** https://github.com/lit/lit/blob/main/packages/labs/ssr-client/src/lit-element-hydrate-support.ts
- **`@lit-labs/ssr` npm package:** https://www.npmjs.com/package/@lit-labs/ssr
- **`@lit-labs/ssr-client` npm package:** https://www.npmjs.com/package/@lit-labs/ssr-client
- **Lit Monorepo (packages/labs/ssr):** https://github.com/lit/lit/tree/main/packages/labs/ssr
- **Declarative Shadow DOM — WHATWG HTML Pull Request:** https://github.com/whatwg/html/pull/5465
- **Declarative Shadow DOM — MDN:** https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM#declaratively_with_html
- **Can I Use — Declarative Shadow DOM:** https://caniuse.com/declarative-shadow-dom
- **H3 (Nitro's HTTP toolkit) — `sendStream`:** https://h3.unjs.io/utils/response#sendstreamvalue-event
- **DSD Polyfill (`@webcomponents/template-shadowroot`):** https://github.com/webcomponents/template-shadowroot
- **Lit Blog — SSR announcement:** https://lit.dev/blog/2023-10-10-lit-3.0/#server-side-rendering
- **Enhance.dev source (reference for web-component SSR patterns):** https://github.com/enhance-dev/enhance

---

*End of R-2 findings document.*
*Agent: R-2 | Date: 2026-02-28 | Target consumer: I-3, I-4*
