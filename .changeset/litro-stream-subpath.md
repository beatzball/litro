---
'@beatzball/litro': patch
---

Expose the NDJSON stream wire protocol (`createStreamEncoder`, `createStreamDecoder`, `serializeValue`, `deserializeValue`, `isAsyncIterable`) as a public `@beatzball/litro/stream` subpath so Server Actions and the agent layer share one protocol.
