---
'@beatzball/litro': minor
---

Server Actions milestone 2: progressive-enhancement forms and streaming returns.

- Forms: `actionUrl()` renders plain `<form method="post">` targets for actions; without JS the endpoint answers with a Post/Redirect/Get flow (one-shot `litro-form-error` cookie, read via `getFormErrors()`); with JS, `enhanceForms()` (`@beatzball/litro/actions/form-client`) upgrades submits to seroval RPCs and reports results via `litro:action-success` / `litro:action-error` events. Opt-in `csrf: 'token'` double-submit mode with `csrfToken()`; form targets require a `defineAction` input schema.
- Streaming: action handlers may return an `AsyncIterable` (async generators included); responses stream as `application/x-ndjson` seroval cross-JSON lines and `callAction` yields chunks incrementally, preserving object identity across chunks.
- Follow-ups: the Origin gate honors `x-forwarded-host`; `.mjs` action modules keep their extension in generated manifests; new `@beatzball/litro/actions/server` subpath (server-only helpers, stubbed in client builds).
