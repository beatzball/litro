---
'@beatzball/litro-router': minor
---

Match a route with or without a trailing slash.

`LitroRouter` built a `URLPattern` anchored to the exact pathname, so
`/docs/getting-started/` matched no route at all:

```js
const p = new URLPattern({ pathname: '/docs/:slug' });
p.test({ pathname: '/docs/getting-started' })   // true
p.test({ pathname: '/docs/getting-started/' })  // false
```

Nothing threw. The router simply fell out of its loop without mounting
anything, which is how a real docs site rendered every page blank at a
trailing-slash URL: 200, every asset loaded, the whole document in the DOM,
and a `:not(:defined) { visibility: hidden }` rule hiding it because the page
component was never defined.

The router now canonicalizes `location.pathname` before matching, and reports
the canonical value to `onBeforeEnter`, so a page reads one stable pathname
either way. The address bar is left alone: a static host already serves both
forms, so rewriting the URL would make the same app behave differently under
SSG and SSR.

New export `normalizePathname`, also available on its own at
`@beatzball/litro-router/path` — a dependency-free module a server bundle can
import without pulling in this client-only entry:

```ts
import { normalizePathname } from '@beatzball/litro-router/path';

normalizePathname('/docs/a/'); // '/docs/a'
normalizePathname('/');        // '/'
```
