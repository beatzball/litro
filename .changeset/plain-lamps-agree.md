---
'@beatzball/litro': minor
---

Export `normalizePathname`, the one canonicalization every route matcher shares.

A Litro app has two matchers that have to agree: the client router, and the
catch-all handler in `server/routes/[...].ts`. They were separate
implementations, and neither accepted a trailing slash — so `/docs/a/` matched
on neither side. The failure was invisible, because an SSG build writes
`docs/a/index.html` and a static host answers the trailing-slash URL with 200
and every asset. Only the client missed, and the page rendered blank.

`normalizePathname` is re-exported from `@beatzball/litro-router`, which is
dependency-free and where the client router already uses it. A scaffolded app
depends on `@beatzball/litro` alone, so its handler can now reach the same
implementation:

```ts
import { normalizePathname } from '@beatzball/litro';

const pathname = normalizePathname(getRequestURL(event).pathname);
```

The built-in OG image handler canonicalizes the same way, so an OG image
resolves the same route as the page it illustrates.
