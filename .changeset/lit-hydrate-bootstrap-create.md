---
'@beatzball/create-litro': patch
---

Scaffold every Lit recipe with a two-statement bootstrap entry, and unpin
`vite` from `~8.0.16` to `^8.1.6`.

A new app's `app.ts` is now exactly:

```ts
import '@lit-labs/ssr-client/lit-element-hydrate-support.js';
void import('./app-main.js');
```

Everything the entry used to import moved to a new `app-main.ts`, unchanged.
This replaces the `~8.0.16` pin added in the previous release, which held Vite
8.1+ back rather than fixing anything.

Importing the hydrate support first was never enough. All of a module's static
imports evaluate before its own body, so what decides the order is which chunk
the bundler put `lit-element` in — and from Vite 8.1.6 (Rolldown 1.1.5) onward
it lands in a chunk the entry imports statically whenever the entry and a page
component both reach the same app-level barrel, which is what an ordinary
`src/lib/index.ts` with an `html` or `css` helper in it is. Hydration then never
installed, with a green build, correct prerendered HTML and no console error. A
dynamic import is the one thing that cannot be hoisted ahead of the entry body.

Two details of the split, handled in the templates: `app-main.ts` can evaluate
after `DOMContentLoaded` has already fired, so the recipes that waited on that
event check `document.readyState` first rather than adding a listener that would
never run; and `app.ts` must stay two statements, because one ordinary `import`
added to it reintroduces the fault.

The FAST and Elena templates are unchanged — their adapters never write a Lit
element's shadow DOM on the server, so there is nothing for a missing patch to
discard.
