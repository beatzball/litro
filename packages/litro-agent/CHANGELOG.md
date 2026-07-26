# @beatzball/litro-agent

## 0.1.1

### Patch Changes

- e576f80: Bump `nitropack` from `^2.13.1` to `^2.13.4`, resolving Medium-severity advisories GHSA-5w89-w975-hf9q and GHSA-9phm-9p8f-hw5m.
- fbcbe21: Session store hygiene: `fileSessionStore` no longer pays a `mkdir` syscall on every single `append()` call (cached once per store instance, with retry-on-failure preserved), and its internal per-session promise-chain registry now drops an entry once it settles and nothing has chained onto it since, instead of retaining one for every distinct session id for the lifetime of the process.
- Updated dependencies [141513a]
- Updated dependencies [e576f80]
- Updated dependencies [16d2705]
  - @beatzball/litro@0.13.0

## 0.1.0

### Minor Changes

- 97e80be: Initial release: filesystem-first agent layer for Litro apps. `agents/<name>/` directories become durable session endpoints (`POST|GET /__litro/agent/:agent/:session`) streaming NDJSON session events. Tools (`defineTool`, Standard Schema input) can return `UIResult`s — server-rendered design-system components (Lit DSD or FAST) whose `data` is what the model observes while the HTML streams to the surface. Includes openai-compatible, anthropic, and scripted providers; JSONL session store with reconnect/replay (`resume(fromSeq)`); browser client with `hydrateUIResult`; Nitro build plugin following the Server Actions wiring pattern.

### Patch Changes

- Updated dependencies [97e80be]
  - @beatzball/litro@0.12.0
