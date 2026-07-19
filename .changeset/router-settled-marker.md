---
'@beatzball/litro-router': minor
---

The router now sets a `data-litro-settled` attribute on the outlet element once the atomic page swap completes. Until that point, the visible content on an initial load is the SSR'd shell whose event handlers are not wired — interactions can land on a dead element. The attribute is the router's observable "current page element is live" signal; consumers (including e2e tests) can poll for it (`litro-outlet[data-litro-settled]`) before interacting with the page.
