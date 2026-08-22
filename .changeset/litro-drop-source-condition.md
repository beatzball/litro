---
'@beatzball/litro': patch
---

Remove the `source` export condition. It pointed consumers at the package's
TypeScript source, and Vite does not transpile TypeScript that lives inside
`node_modules` — so an installed app got Lit's `@customElement` decorators
emitted as raw syntax:

```js
(@at(`litro-outlet`) class extends rt { ... })
```

No browser can parse that. The client bundle died with `Invalid or unexpected
token`, nothing hydrated, and the page rendered blank — while the build still
exited 0 and the prerendered HTML was still correct.

This affected any app whose `vite.config.ts` listed `'source'` in
`resolve.conditions` (which every `create-litro` template did) **on Vite 8**.
Vite 5 was unaffected, so apps only broke on upgrading. Four of the six recipe
variants were affected: Lit and FAST apps broke on `@customElement` / `@attr`;
Elena apps use no decorators and were fine.

Existing apps need no code change — upgrading is enough. Leaving `'source'` in
`resolve.conditions` is now harmless, because the condition no longer matches
and resolution falls through to the compiled output.
