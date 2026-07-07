---
'@beatzball/litro': minor
---

Server Actions milestone 2: progressive-enhancement forms and streaming returns.

- Forms: `actionUrl()` renders plain `<form method="post">` targets for actions; without JS the endpoint answers with a Post/Redirect/Get flow (one-shot `litro-form-error` cookie, read via `getFormErrors()`); with JS, `enhanceForms()` (`@beatzball/litro/actions/form-client`) upgrades submits to seroval RPCs and reports results via `litro:action-success` / `litro:action-error` events. Opt-in `csrf: 'token'` double-submit mode with `csrfToken()`; form targets require a `defineAction` input schema.
- Streaming: action handlers may return an `AsyncIterable` (async generators included); responses stream as `application/x-ndjson` seroval cross-JSON lines and `callAction` yields chunks incrementally, preserving object identity across chunks.
- Follow-ups: the Origin gate honors `x-forwarded-host`; `.mjs` action modules keep their extension in generated manifests; new `@beatzball/litro/actions/server` subpath (server-only helpers, stubbed in client builds).

**Upgrading from 0.10.x or earlier:** Server Actions (typed RPC, forms, and streaming together) are new in 0.11.0 and fully opt-in — upgrading the dependency changes nothing until you wire the feature, and there are no breaking changes. Adding actions to an existing app is six one-time edits, documented in the Server Actions guide's Setup section. One of them, `server/plugins/litro-actions.ts`, must be committed rather than gitignored (Nitro scans `server/plugins/` before the build hook that would regenerate it — an ignored copy makes `actionUrl()` throw on a fresh clone's first dev run). Apps scaffolded with `@beatzball/create-litro` 0.7.0 or later come pre-wired.
