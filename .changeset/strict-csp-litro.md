---
'@beatzball/litro': minor
---

A Litro app can now run under a strict Content Security Policy, with `script-src 'self'` and no `'unsafe-inline'` for scripts (issue 290).

- New `createPageHandler({ inlineScripts: false })` option. The page shell then loads the DSD polyfill and the skip-link script as `<script src>` files under `/_litro/assets/` instead of writing them inline. The DSD polyfill stays a synchronous classic script; the skip-link script gets `defer`.
- New `litroShellScriptsPlugin()` from `@beatzball/litro/vite` writes those files into the client build. Their names carry a content hash, so the existing `/_litro/assets/**` immutable rule covers them and no route rule changes. The plugin fails the build if a name and its content disagree.
- Without the option the shell writes the scripts inline as before. `litro dev` keeps them inline. A build that sets the option without the files keeps them inline, warns at build time, and logs an error once at run time.
- `buildShell()` gains matching `inlineScripts` and `scriptFilesUrl` options.
- The outlet's `outline:none` moved from a `style` attribute on `<litro-outlet>` into the shell's `<style>` element, as `#_litro_main{outline:none}`. A `style` attribute can only be allowed by `'unsafe-inline'` or `'unsafe-hashes'`; the `<style>` element takes one hash. This is the one change to the default page output.
- The client-only fallback shell now follows the adapter's `needsDSDPolyfill`, so an Elena page no longer gets the polyfill when SSR fails.

Scripts in `routeMeta.head`, `seoHead` and `bodyScript` are the app's own and are not changed, including the theme script the starlight and supernova recipes put in `head`. Every page also has inline styles: the shell writes one `<style>` element on every page for every adapter, and Lit SSR adds one per shadow root. Allow them with `'unsafe-inline'`, or with one hash each. See the Content Security Policy section of the configuration docs.
