---
"@beatzball/litro-router": patch
"@beatzball/litro": patch
---

Fix hash-only navigation re-renders, shadow DOM scroll-to-hash, SSG preview, and routeMeta.head injection.

**`@beatzball/litro-router`**
- Hash-only `popstate` events (fragment/TOC links) no longer re-render the current page. `LitroRouter` now tracks `_lastPathname` and skips `_resolve()` when only the hash changes.
- After mounting a component, if `location.hash` is set, the router waits for `updateComplete` then scrolls to the target element via `_scrollToHash()`. Heading elements inside shadow roots are located using `_findDeep()` recursive shadow DOM traversal — native `document.getElementById()` cannot cross shadow boundaries.

**`@beatzball/litro`**
- `createPageHandler` now forwards `routeMeta.head` to `buildShell()`. Previously, stylesheet links and inline scripts declared in `routeMeta.head` were silently dropped from the HTML `<head>`.
- `litro preview` now serves SSG builds from `dist/static/` with a built-in Node.js static file server (clean-URL resolution, correct MIME types). Previously only SSR builds were handled and `litro preview` after an SSG build exited with "No production build found".
- Fixed Node.js v22 DEP0190 deprecation: `spawn`/`spawnSync` calls with an args array and `shell: true` now join into a single command string.
