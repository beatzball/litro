---
'@beatzball/litro': patch
---

Warn by name when Lit's hydration support never installed, and raise the `vite`
dependency range from `^8.0.16` to `^8.1.6`.

`LitroOutlet.firstUpdated()` now reads `LitElement.observedAttributes` and, if
`defer-hydration` is missing, logs one `console.error` naming the cause and the
fix. The hydrate-support module only assigns
`globalThis.litElementHydrateSupport`; `lit-element` reads that hook once, when
its own module body runs, and the `?.` it reads it with makes a missing hook a
permanent silent no-op. Until now that failed with no error at all: the build
exited 0, the prerendered HTML was correct, and the browser threw the server's
work away and re-rendered every page. Upgrading surfaces the fault in an
existing app with no change to the app. It warns rather than throws, because a
page that re-rendered still works and breaking it would turn a slow page into a
dead one.

The `vite` range moves off `^8.0.16` now that the ordering fault is fixed, so a
`litro dev` server starts from a release patched against GHSA-587h-7wmj-h5pm
(High, CVSS 7.5) and four lower-severity advisories. All five are in the Vite
dev server, and all five were fixed in 8.1.6, which Litro could not take while
Vite 8.1+ broke hydration. `^8.0.16` still permitted 8.0.16 itself, so the floor
had to move, not just the lockfile.

`src/runtime/client.ts` is unchanged in behavior. Its header no longer claims
that importing the hydrate support first is sufficient, and says plainly that
the module is a library barrel and must not be used as an app's client entry —
its named exports need `lit-element` synchronously, so it cannot be the
two-statement bootstrap that recipes now scaffold.
