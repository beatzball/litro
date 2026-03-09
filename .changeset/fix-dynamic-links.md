---
"@beatzball/litro": patch
"@beatzball/litro-router": patch
"@beatzball/create-litro": patch
---

fix: client-side navigation links do not work on first load

`<litro-link>` clicks were silently no-ops in scaffolded apps because of
three compounding bugs.

---

**Bug 1 — Empty route table on init** (`LitroOutlet`, `app.ts`)

`app.ts` set `outlet.routes` inside a `DOMContentLoaded` callback (a
macrotask). By that point Lit's first-update microtask had already fired,
so `firstUpdated()` ran with `routes = []` and the router was initialised
with no routes.

*Fix — `LitroOutlet`*: Replace `@property({ type: Array }) routes` with a
plain getter/setter. The setter calls `router.setRoutes()` directly when
the router is already initialised, without going through Lit's render cycle
(which would crash with "ChildPart has no parentNode" because
`firstUpdated()` removes Lit's internal marker nodes to give the router
ownership of the outlet's subtree).

*Fix — `app.ts`* (fullstack recipe template + playground): Set
`outlet.routes` synchronously after imports rather than inside a
`DOMContentLoaded` callback. Module scripts are deferred by the browser;
by the time they execute the DOM is fully parsed and `<litro-outlet>` is
present.

---

**Bug 2 — Click handler never attached on SSR'd pages** (`LitroLink`)

`@lit-labs/ssr` adds `defer-hydration` to custom elements inside shadow
DOM. `@lit-labs/ssr-client` patches `LitElement.prototype.connectedCallback`
to block Lit's update cycle when this attribute is present. A `@click`
binding on the shadow `<a>` is a Lit binding — it is never attached until
`defer-hydration` is removed, which only happens when the parent component
hydrates. For page components that are never hydrated client-side (because
the router replaces the SSR content before they load), `<litro-link>`
elements inside them never receive a click handler.

This is why the playground appeared to work: its home page has no
`<litro-link>` elements. The fullstack generator template does, so clicks
on the SSR'd page were silently ignored.

*Fix*: Move the click handler from a `@click` binding on the shadow `<a>`
to the HOST element via `addEventListener('click', ...)` registered in
`connectedCallback()` (before `super.connectedCallback()`). The host
listener runs in `LitroLink`'s own `connectedCallback` override, which
executes before the `@lit-labs/ssr-client` patch checks for
`defer-hydration`. This ensures the handler is active immediately after the
element connects to the DOM, even for SSR'd elements on first load.

The shadow `<a>` is kept without a `@click` binding — it exists for
progressive enhancement (no-JS navigation) and accessibility (cursor,
focus, keyboard navigation).

---

**Bug 3 — `_resolve()` race condition** (`LitroRouter`)

`setRoutes()` calls `_resolve()` immediately for the current URL. If the
user clicks a link before that initial `_resolve()` completes (e.g. while
the page action's dynamic import is in flight), a second `_resolve()` call
starts concurrently. If the first call (for `/`) completes after the second
(for `/blog`), it overwrites the blog page with the home page.

*Fix*: Add a `_resolveToken` monotonic counter. Each `_resolve()` call
captures its own token at the start and checks it after every `await`. If
the token has advanced, a newer navigation superseded this one and the call
returns without touching the DOM.

---

**Bug 4 — `@property()` decorators silently dropped by esbuild TC39 transform** (`LitroLink`)

esbuild 0.21+ uses the TC39 Stage 3 decorator transform. In that mode,
Lit's `@property()` decorator only handles `accessor` fields; applied to a
plain field (`href = ''`) it is silently not applied. As a result `href`,
`target`, and `rel` were absent from `observedAttributes`, so
`attributeChangedCallback` was never called during element upgrade, leaving
`this.href = ''` forever regardless of what the HTML attribute said.

*Fix*: Replace the three `@property()` field decorators with a
`static override properties = { href, target, rel }` declaration. Lit reads
this static field at class-finalization time via `finalize()`, which runs
before the element is defined in `customElements`, ensuring the properties
are correctly registered in `observedAttributes`.

---

Adds a new `LitroOutlet.test.ts` test file (6 tests) covering the
synchronous and late-assignment code paths, the setter guard, SSR child
clearing, and the `LitroRouter` constructor call.

Updates `LitroLink.test.ts` (12 tests) to dispatch real `MouseEvent`s on
the host element (exercising the `addEventListener` path) rather than
calling the private handler directly by name.

---

**Template fix — `@state() declare serverData` incompatible with jiti/SSG**

The fullstack recipe template used `@state() declare serverData: T | null` to
narrow the `serverData: unknown` type inherited from `LitroPage`. The `declare`
modifier emits no runtime code, but jiti's oxc-transform (used in SSG mode to
load page files) throws "Fields with the 'declare' modifier cannot be
initialized here" under TC39 Stage 3 decorator mode.

*Fix*: Remove `@state() declare serverData` from both page templates. Use a
local type cast in `render()` instead: `const data = this.serverData as T | null`.
The property is already reactive (declared as `@state() serverData = null` in
`LitroPage`). Updated `LitroPage.ts` JSDoc and `DECISIONS.md` to document this
pattern and warn against `declare` fields in subclasses.
