# @beatzball/litro-agent

## 0.1.0

### Minor Changes

- 97e80be: Initial release: filesystem-first agent layer for Litro apps. `agents/<name>/` directories become durable session endpoints (`POST|GET /__litro/agent/:agent/:session`) streaming NDJSON session events. Tools (`defineTool`, Standard Schema input) can return `UIResult`s — server-rendered design-system components (Lit DSD or FAST) whose `data` is what the model observes while the HTML streams to the surface. Includes openai-compatible, anthropic, and scripted providers; JSONL session store with reconnect/replay (`resume(fromSeq)`); browser client with `hydrateUIResult`; Nitro build plugin following the Server Actions wiring pattern.

### Patch Changes

- Updated dependencies [97e80be]
  - @beatzball/litro@0.12.0
