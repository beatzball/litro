---
"@beatzball/litro": patch
"@beatzball/create-litro": patch
---

fix: client-side navigation links do not work on first load

`<litro-link>` clicks were silently no-ops because the router was
initialised with an empty route table.

**Root cause**: When `app.ts` loads, importing `LitroOutlet.js` triggers
`customElements.define()`, which immediately upgrades the SSR'd
`<litro-outlet>` element. Lit schedules its first update as a microtask.
The `DOMContentLoaded` listener in `app.ts` (a macrotask) fires only
after that microtask, so `firstUpdated()` ran with `routes = []` and the
router was initialised with no routes. Setting `outlet.routes` in the
callback was ignored because there was no code path to call `setRoutes()`
again.

**Fix — `LitroOutlet`**: Replace `@property({ type: Array }) routes` with
a plain getter/setter. The setter calls `router.setRoutes()` directly
when the router is already initialised. A Lit reactive property was
rejected because Lit's `createProperty()` installs an accessor that calls
`requestUpdate()`, scheduling a render cycle — which crashes with
"ChildPart has no parentNode" because `firstUpdated()` already removed
Lit's internal marker nodes to give the router full ownership of the
outlet's subtree.

**Fix — `app.ts`** (fullstack recipe template + playground): Set
`outlet.routes` synchronously after imports rather than inside a
`DOMContentLoaded` callback. Module scripts are deferred by the browser;
by the time they execute the DOM is fully parsed and `<litro-outlet>` is
present. Synchronous assignment ensures `firstUpdated()` sees the real
route table before the first Lit update microtask fires.

Adds a new `LitroOutlet.test.ts` test file (6 tests) covering both the
synchronous and late-assignment code paths, the setter guard, SSR child
clearing, and the `LitroRouter` constructor call.
