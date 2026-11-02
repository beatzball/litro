---
'@beatzball/litro': minor
---

The client entry is no longer stranded in browser caches after a deploy (issue 253).

- New `litroEntryPlugin()` in `@beatzball/litro/vite`. It moves everything the entry imports statically into one hashed `boot` chunk, so `app.js` holds no shared code and no other chunk imports it by name. A Lit entry reaches `lit-element` only through its dynamic `import('./app-main.js')`, so the hydration support still runs first (BUILD-009).
- The page handler now loads the entry as `/_litro/app.js?v=<content hash>`. The pages plugin hashes `dist/client/app.js` during `nitro build` and writes the hash into the page manifest. A deploy changes the URL, so a browser that kept an old entry fetches the new one by itself. When any chunk still imports `app.js` by name (a build without `litroEntryPlugin()`), the build prints a warning and the page keeps the bare `/_litro/app.js`.
- New `appScriptUrl` option on `createPageHandler()` to load the entry from another URL in production. The dev live entry ignores it.

Existing apps should also change their `routeRules`: mark only `/_litro/assets/**` immutable and send `no-cache` for `/_litro/app.js`. See the Upgrading page.
