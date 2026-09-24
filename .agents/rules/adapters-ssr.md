# Adapters and SSR rules

Lit, FAST and Elena each render on the server in a different way. A line that
works in one adapter's template can render wrong in another, and most of these
failures build green.

### SSR-001 — Elena props must be lowercase

Every name in an Elena component's `static props` array is lowercase. Attribute
names in templates are lowercase too.

**Why:** HTML parsers lowercase attribute names. Elena's `observedAttributes`
returns the prop names exactly as written, so a prop named `currentSlug` never
matches the parsed `currentslug` attribute. `attributeChangedCallback` never
fires and the prop stays at its default. Nothing reports an error.

**Check:** `git grep -n "static props"` and look for a capital letter inside a
quoted name. `serverData` in the framework's Elena `LitroPage` is the one
exception: the adapter sets it directly, not through an attribute.

### SSR-002 — Elena SSR runs only `willUpdate()` and `render()`

On the server, an Elena wrapper passes data to its child custom elements as
attributes written in the `render()` template. Setting child props in
`updated()` works only in the browser.

**Why:** `renderComponent` in `packages/framework/src/adapter/elena/index.ts`
calls `willUpdate()` and `render()`. It never calls `connectedCallback()` or
`updated()`. Nested elements are expanded from the HTML string, so they see
only the attributes in that string. A child that is fed in `updated()` renders
empty on the server.

**Check:** view the page with JavaScript off. A child that shows default or
empty values is missing its template attributes.

### SSR-003 — Elena content captured in `connectedCallback` needs a `render()` fallback

If a component saves `this.innerHTML` in `connectedCallback()`, `render()` falls
back to `this.innerHTML` when the saved value is empty.

**Why:** the SSR adapter sets `instance.innerHTML` from the children but never
calls `connectedCallback()` (see SSR-002). The saved copy is empty on the
server, so the content disappears from the server HTML.

```ts
// Do
const contentHtml = this._contentHtml || this.innerHTML || '';
// Don't
const contentHtml = this._contentHtml;
```

**Check:** `packages/create-litro/recipes/starlight/template-elena/src/components/starlight-page.ts`
is the reference. Server HTML without the slotted content means the fallback
is missing.

### SSR-004 — Elena's `html` escapes values; use `unsafeHTML()` for markup

Interpolate an HTML string into an Elena template with `unsafeHTML()`.

**Why:** `@elenajs/core` escapes `&`, `<`, `>`, `"` and `'` in every
interpolated value unless the value is marked raw. Plain `${this.innerHTML}`
prints the markup as visible text.

**Check:** `packages/create-litro/recipes/starlight/template-elena/src/components/litro-aside.ts`
uses `unsafeHTML(this.innerHTML)`. Visible `&lt;` tags on the page mean a
missing `unsafeHTML()`.

### SSR-005 — FAST SSR does not map attributes to properties

When one FAST component places another in a template, bind the property with
`:prop`. Do not rely on a plain attribute. For example, on the recipe's
`litro-footer` element:

**Why:** `@microsoft/fast-ssr` does not copy HTML attributes onto properties.
The element appears in the server HTML with the attribute on it, but its
rendered text is empty. It compiles, builds and passes `node --check`. Lit and
Elena both handle the plain attribute, so a line copied between adapter
templates breaks only FAST. Declaring `attributes: [...]` in `.define()` does
not fix SSR.

```ts
// Do: bind the property
:recipe="${() => 'starlight'}"
// Don't: set a plain attribute
recipe="starlight"
```

**Check:** assert on rendered output, not on a clean build.
`scripts/verify-scaffolded-apps.mjs` checks that the recipe credit reaches the
HTML for every adapter. The reference usage is
`packages/create-litro/recipes/starlight/template-fast/pages/index.ts`.

### SSR-006 — Keep `@microsoft/fast-*` packages external

The FAST adapter's `nitroConfig()` returns no `externals.inline` entry for FAST
packages.

**Why:** if they are inlined, Rollup bundles one copy of `fast-element` and the
workspace package loads a second copy from `node_modules`. `fastSSR()` patches
only one of them. The other copy runs the browser template compiler on the
server and crashes on missing DOM APIs.

**Check:** `nitroConfig()` in `packages/framework/src/adapter/fast/index.ts`. A
server crash that names `document` or a DOM API after a config change means a
second copy.

### SSR-007 — The FAST DOM shim must be synchronous

`packages/framework/src/adapter/fast/ensure-dom.ts` has no imports, no dynamic
`import()` and no top-level `await`.

**Why:** ESM runs sibling imports in order only while they are all synchronous.
A top-level `await` lets the next sibling start. `@microsoft/fast-element`
reads `document` while it loads, so it runs before the shim finishes and
crashes.

**Check:** read the file header. Any `import` or `await` in that file is the bug.

### SSR-008 — A shadow root needs its own `box-sizing` reset

Every Lit and FAST component this repo ships — page components included —
starts its styles with:

```css
*,
*::before,
*::after {
  box-sizing: border-box;
}
```

A page component also sets `:host { display: block; }`.

**Why:** a document stylesheet does not cross a shadow boundary. The starlight
recipe ships the reset in `public/styles/starlight.css`, and `<main>` lives
inside `page-home`'s shadow root, so it computed as `content-box`. Its
`width: 100%` resolved to the full viewport and `padding: 4rem 1.5rem 3rem`
was added on top: 438px on a 390px screen, on every scaffolded site. Above
~900px `max-width: 56rem` caps the element first, so the bug is invisible on a
desktop. A page host with no `display` computes as `inline`, which is the same
mistake one level up.

Elena is the exception: it server-renders light DOM, so the document
stylesheet already reaches its content and the reset must not be repeated.

**Check:** `e2e/_shared/mobile-overflow.ts` loads each page at 320, 360 and
390px and fails when `document.documentElement.scrollWidth` exceeds the
viewport. Grepping for the CSS text cannot see this bug — the broken build
shipped the reset too, it simply could not reach the element.
