---
'@beatzball/litro': minor
---

A Litro app can now run under a strict Content Security Policy, with `script-src 'self'` and no `'unsafe-inline'` for scripts (issue 290).

- New `createPageHandler({ inlineScripts: false })` option. The page shell then loads the DSD polyfill and the skip-link script as `<script src>` files under `/_litro/assets/` instead of writing them inline. The DSD polyfill stays a synchronous classic script; the skip-link script gets `defer`.
- New `litroShellScriptsPlugin()` from `@beatzball/litro/vite` writes those files into the client build. Their names carry a content hash, so the existing `/_litro/assets/**` immutable rule covers them and no route rule changes.
- The default is unchanged: without the option the shell writes the same bytes as before. `litro dev` keeps the scripts inline. A build that sets the option without the plugin keeps them inline and logs an error once.
- `buildShell()` gains matching `inlineScripts` and `scriptFilesUrl` options.

Scripts in `routeMeta.head`, `seoHead` and `bodyScript` are the app's own and are not changed. `style-src` still needs `'unsafe-inline'`, because Lit SSR writes a `<style>` into each shadow root. See the Content Security Policy section of the configuration docs.
