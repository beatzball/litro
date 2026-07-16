---
'@beatzball/litro-agent': patch
---

Session store hygiene: `fileSessionStore` no longer pays a `mkdir` syscall on every single `append()` call (cached once per store instance, with retry-on-failure preserved), and its internal per-session promise-chain registry now drops an entry once it settles and nothing has chained onto it since, instead of retaining one for every distinct session id for the lifetime of the process.
