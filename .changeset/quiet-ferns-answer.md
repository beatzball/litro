---
'@beatzball/create-litro': minor
---

Fix two defects in every recipe's catch-all page handler.

**A trailing slash matched no route.** The generated handler built a RegExp
ending in `$` with no optional slash, so `/docs/getting-started/` fell through
to the 404 branch. The client router was equally strict, which is what made
this hard to see: on a static host the page still arrived 200 with every
asset, because an SSG build writes `docs/getting-started/index.html`. The
component was never defined and the recipe's `:not(:defined)` rule hid a
document that was fully present in the DOM — a blank page with no console
error. The handler now canonicalizes with `normalizePathname` from
`@beatzball/litro`, the same helper the client router uses, so both halves
agree.

**A miss was served as 200 OK.** The not-found branch set a body and a
content-type but never a status, so a 404 page went out as a success. Crawlers
index that, and a prerender counts it as a real page. The handler now calls
`setResponseStatus(event, 404)`.

**Scaffolding is a copy, so an existing site does not get this by upgrading.**
Patch your own `server/routes/[...].ts`:

```ts
import { defineEventHandler, setResponseHeader, setResponseStatus, getRequestURL } from 'h3';
import { normalizePathname } from '@beatzball/litro';

export default defineEventHandler(async (event) => {
  const pathname = normalizePathname(getRequestURL(event).pathname);
  const result = matchRoute(pathname);

  if (!result) {
    setResponseStatus(event, 404);
    // ...
  }
  // ...
});
```
