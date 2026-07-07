---
title: Server Actions
description: Call server-side functions from your components over a typed RPC without writing API routes.
date: 2026-07-04
---

# Server Actions

Export an async function from a `*.server.ts` module and import it anywhere in your application. During SSR the call runs in the same process with no network hop. In the browser the same import is replaced by a generated stub that sends a typed `POST /__litro/action/<id>` request and deserializes the result — the entire server module and all of its transitive dependencies (database drivers, secrets) never enter the client bundle.

Server Actions — including the [form](#forms) and [streaming](#streaming) support on this page — require `@beatzball/litro` 0.11.0 or later. Apps scaffolded with `@beatzball/create-litro` 0.7.0 or later come pre-wired; [upgrading an existing app](#upgrading-from-010x-or-earlier) is covered under Setup.

## Security

Every export of a `.server.ts` module is a public HTTP endpoint. Treat all arguments as hostile input regardless of how the action is called — in-process SSR calls and browser RPC calls share the same handler code. Authentication and authorization belong inside the handler, not at the call site. Return values are serialized and sent to the client; shape them to expose only what the caller needs. Rate limiting composes at the Nitro middleware layer (`server/middleware/`). The built-in CSRF protections guard the transport channel; they do not substitute for handler-level auth.

Only export what should be reachable over HTTP. The Vite plugin detects some non-function exports at build time and raises an error; anything that reaches the runtime and is not a function is silently unregistered — it is never executed or leaked.

## Setup

Apps scaffolded with `npm create @beatzball/litro` (fullstack recipe) ship with everything on this page pre-wired — the edits below are only needed when adding actions to an existing project by hand.

Six one-time edits wire the feature into a Litro project. Add them once per project; there is nothing per-action. The `server/stubs/` directory is generated on every build and dev restart and should be gitignored; the sixth edit (`server/plugins/litro-actions.ts`, below) is a static file that is committed, not gitignored.

### nitro.config.ts

Import the plugin, declare the static route handler, register the plugin inside `hooks['build:before']`, and add the route rule:

```ts
import { resolve } from 'node:path';
import { defineNitroConfig } from 'nitropack/config';
import type { Nitro } from 'nitropack';
import actionsPlugin from '@beatzball/litro/plugins/actions';

export default defineNitroConfig({
  handlers: [
    {
      route: '/__litro/action/:id',
      method: 'post',
      handler: resolve('./server/stubs/action-handler.ts'),
    },
  ],
  hooks: {
    'build:before': async (nitro: Nitro) => {
      await actionsPlugin(nitro);
    },
  },
  routeRules: {
    '/__litro/action/**': {
      headers: { 'cache-control': 'no-store' },
    },
  },
});
```

The `handlers` entry must be declared statically. The dev server reads handler configuration before `build:before` fires, so entries pushed programmatically from the plugin would not appear during development. The plugin generates `server/stubs/action-handler.ts` before Rollup compiles it; declaring the route statically ensures both the dev server and the production build see it.

The `/__litro/action/**` route rule keeps the endpoint outside Nitro's static-asset prefix (`/_litro/`), which is served by a placeholder middleware that intercepts misses before the router runs. No carve-out of the `/_litro/**` immutable cache rule is required.

### package.json

Add the `"imports"` field so Node and Rollup can resolve the `#litro/action-manifest` package subpath that the generated handler stub imports:

```json
{
  "imports": {
    "#litro/page-manifest": "./server/stubs/page-manifest.ts",
    "#litro/action-manifest": "./server/stubs/action-manifest.ts"
  }
}
```

### vite.config.ts

Add `litroActionsPlugin()` to the plugins list:

```ts
import { defineConfig } from 'vite';
import { litroActionsPlugin } from '@beatzball/litro/vite';

export default defineConfig({
  plugins: [litroActionsPlugin()],
});
```

The Vite plugin intercepts any `*.server.ts` import entering the client module graph and replaces it wholesale with a generated stub before Vite's import analysis runs. The original module code and all of its transitive imports are structurally absent from `dist/client/`. It also replaces `@beatzball/litro/actions/server` with a throwing browser stub in the client build — page modules import that server-only module for its `definePageData` helpers, and its `node:crypto` dependency must never enter the client graph.

### server/plugins/litro-actions.ts

Add this file verbatim. It stamps every scanned action export with its wire id at server boot so `actionUrl()` can resolve endpoints during SSR:

```ts
// @ts-nocheck
// @generated by litro action scanner — do not edit
// Auto-loaded by Nitro at startup (server/plugins/). Stamps every scanned
// action export with its wire id so actionUrl() works during SSR.
import { stampActionIds } from '@beatzball/litro/actions/server';
import { actionModules } from '#litro/action-manifest';

export default function litroActionsStampPlugin() {
  stampActionIds(actionModules);
}
```

Unlike the `server/stubs/` files, this one is committed (not gitignored). Nitro scans `server/plugins/` before the `build:before` hook runs, so if the actions plugin generated this file at build time it would be missing on a project's first-ever dev run and `actionUrl()` would throw until a restart. The `create-litro` fullstack template ships it committed; the actions plugin keeps its content fresh on subsequent runs. Its content is static, so writing it by hand for a manual setup is safe.

### Upgrading from 0.10.x or earlier

`@beatzball/litro` 0.10.x and earlier have no Server Actions. Upgrading the dependency to `^0.11.0` changes nothing by itself — the feature is opt-in, no existing behavior is affected, and there are no breaking changes. To adopt actions in an existing app:

1. Bump `@beatzball/litro` to `^0.11.0` in `package.json` and reinstall.
2. Apply the six one-time edits above. All six are required before `actionUrl()` and forms work; plain RPC calls work after the first five.
3. Check your `.gitignore`. If it ignores generated files with a broad pattern (for example `server/plugins/` or a project-wide generated-file glob), carve out `server/plugins/litro-actions.ts` — it must be committed. An ignored copy produces the confusing first-run failure described above: `actionUrl()` throws on a fresh clone until the dev server is restarted.
4. Optionally wire `enhanceForms()` in `app.ts` (see [The enhancer](#the-enhancer)) — only needed for JavaScript-enhanced form submits. The no-JS form path and streaming need no wiring beyond the six edits: any handler that returns an async iterable streams automatically.

Alternatively, scaffold a fresh reference app with `npm create @beatzball/litro` (`@beatzball/create-litro` 0.7.0+) and diff its config files against yours — the template carries the exact wiring.

## Plain actions

A plain exported `async function` is the simplest action. No validation is applied server-side beyond what the function itself performs; use `defineAction` (below) when you need input validation.

```ts
// actions/demo.server.ts
export async function getServerTime() {
  return { now: new Date() };
}
```

Call it from a `definePageData` fetcher for the initial render. On the server the import resolves to the real module — the call is a plain in-process function call with no HTTP hop. The result flows into the page's `serverData` property:

```ts
// pages/actions.ts
import { html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { definePageData, LitroPage } from '@beatzball/litro';
import { getServerTime } from '../actions/demo.server.js';

interface ActionsPageData {
  serverNowIso: string;
}

export const pageData = definePageData(async () => {
  const time = await getServerTime();
  return {
    serverNowIso: time.now.toISOString(),
  } satisfies ActionsPageData;
});

@customElement('page-actions')
export class ActionsPage extends LitroPage {
  @state() declare serverData: ActionsPageData | null;

  override render() {
    return html`<p>SSR time: ${this.serverData?.serverNowIso ?? ''}</p>`;
  }
}

export default ActionsPage;
```

Call the same function from a component method for on-demand browser RPC. In the browser the import resolves to a generated stub; the call sends `POST /__litro/action/<id>` and the `Date` value round-trips intact:

```ts
private async refresh(): Promise<void> {
  const { now } = await getServerTime();
  this.nowIso = now instanceof Date ? now.toISOString() : now;
}
```

The import is identical in both environments. TypeScript resolves it to the real `.server.ts` file in both cases, so the call is fully typed with no schema duplication.

## `defineAction`

`defineAction` wraps a handler with input validation. The `input` field accepts any [Standard Schema v1](https://github.com/standard-schema/standard-schema) validator — Zod, Valibot, and ArkType all implement the spec. A hand-rolled validator also works:

```ts
// actions/demo.server.ts
import { defineAction } from '@beatzball/litro/actions';

// Minimal hand-rolled Standard Schema v1 validator.
// Any Standard Schema library (Zod, Valibot, ArkType) works here too.
const echoInput = {
  '~standard': {
    version: 1 as const,
    vendor: 'my-app',
    validate(value: unknown) {
      if (
        typeof value === 'object' &&
        value !== null &&
        typeof (value as { text?: unknown }).text === 'string'
      ) {
        return { value: value as { text: string } };
      }
      return { issues: [{ message: 'expected { text: string }' }] };
    },
  },
};

export const echoUpper = defineAction({
  input: echoInput,
  async handler({ text }) {
    return { upper: text.toUpperCase(), at: new Date() };
  },
});
```

When the validator's `validate` method returns `{ issues }`, the server responds with HTTP 400 and the issues array is forwarded to the client as a `LitroActionError` with `status: 400` and the `issues` property populated.

### `ctx.event`

The handler receives a second argument `ctx` with an `event` property — the live H3Event for the current request:

```ts
export const echoUpper = defineAction({
  input: echoInput,
  async handler({ text }, ctx) {
    const ip = ctx.event?.node.req.socket.remoteAddress;
    return { upper: text.toUpperCase(), at: new Date() };
  },
});
```

`ctx.event` behavior differs between dev and production:

- **HTTP (RPC) calls:** `ctx.event` is always the handler's own H3Event in both dev and production.
- **In-process SSR calls (production):** `ctx.event` comes from Nitro's async context (`experimental.asyncContext`). This works in production builds.
- **In-process SSR calls (dev server):** the async context is not available in the dev worker; `ctx.event` is `undefined`. Guard before reading it when an action may be called from `definePageData`.

### Error handling

Errors thrown inside handlers surface on the client as `LitroActionError`:

```ts
import { LitroActionError } from '@beatzball/litro/actions';

try {
  const result = await echoUpper({ text: 'hello' });
} catch (err) {
  if (err instanceof LitroActionError) {
    console.error(err.status, err.message, err.issues);
  }
}
```

`LitroActionError` carries:
- `status` — the HTTP status code (400 for validation failures, 403 for CSRF rejections, 404 for unknown action ids, 500 for unhandled throws).
- `issues` — the validator's issues array, present on validation failures.

Stack traces are included in error payloads in development only. They are never included in production responses. The raw handler `Error.message` **is** echoed in production payloads, however — shape what you throw deliberately, and raise a `LitroActionError` with a caller-safe message rather than letting an internal error string reach the client.

## Serialization

Action arguments and return values are serialized using [seroval](https://github.com/lxsmnsyc/seroval) in JSON mode (`toJSON` / `fromJSON`). The following types round-trip correctly across the wire:

- Primitives: strings, numbers, booleans, `null`, `undefined`
- `Date`, `BigInt`
- `Map`, `Set`
- Typed arrays (`Uint8Array`, `Float32Array`, etc.)
- Circular references

Functions and class instances cannot be serialized. Attempting to pass or return them produces a loud error at serialization time, not a silent truncation.

The serializer operates in the non-eval mode exclusively. The server deserializes untrusted client input without evaluating any code.

## CSRF protection

CSRF protection is on by default. Every request to `POST /__litro/action/:id` must satisfy all three checks:

1. The `x-litro-action: 1` header must be present. Cross-origin HTML form submissions cannot set custom headers, which closes the classic CSRF vector without session tokens.
2. If `Sec-Fetch-Site` is present it must be `same-origin` or `none`. Requests from cross-site navigations are rejected at the header level.
3. If `Origin` is present its host must match the request host. When the request carries an `x-forwarded-host` header its first (comma-separated) value is preferred over `Host` — this matches deployments behind a proxy that rewrites `Host`. That header is only trustworthy when the platform sets it (Nitro's deployment presets do); do not enable trust of it at the application layer.

Any check failure returns a 403. The generated client stubs (`callAction`) always send `x-litro-action: 1`; no application code needs to set it manually. Form-mode requests (see [Forms](#forms)) skip check 1 — HTML form posts cannot carry custom headers — but checks 2 and 3 still apply, and an action can additionally opt into a double-submit token with `csrf: 'token'`.

## Forms

An action can back a plain HTML `<form>` with no client JavaScript. The form binding is a single isomorphic attribute value — `actionUrl(action)` — so the same markup works with or without JavaScript and is identical across the Lit, FAST, and Elena adapters (it is plain attribute interpolation, not adapter-specific).

- **No JavaScript:** the browser posts form-encoded data natively; the endpoint validates, runs the handler, and responds with a Post/Redirect/Get (PRG) 303.
- **With JavaScript:** `enhanceForms()` intercepts the submit, converts the `FormData` to an object, performs the normal seroval RPC, and reports the outcome via CustomEvents on the form. No page reload.

### Basic form

`actionUrl(action)` resolves an imported action to its endpoint URL. Drop it into a plain `<form method="post">`:

```ts
import { actionUrl } from '@beatzball/litro/actions/client';
import { addEntry } from '../actions/forms.server.js';

// inside render()
html`
  <form method="post" action=${actionUrl(addEntry)}>
    <input name="name" placeholder="Name" />
    <input name="message" placeholder="Message" />
    <button>Sign</button>
  </form>`;
```

`actionUrl` is re-exported from `@beatzball/litro/actions` as well. It throws if the function has no wire-id stamp — that only happens when the target is not a scanned `.server.ts` export or the actions plugins are not wired up.

### The enhancer

Import `enhanceForms` from `@beatzball/litro/actions/form-client` and call it once in `app.ts` to upgrade every light-DOM action form on the page:

```ts
import { enhanceForms } from '@beatzball/litro/actions/form-client';

enhanceForms();
```

`enhanceForms(root = document)` attaches one delegated `submit` listener to `root` and returns a detach function that removes it. It is idempotent per root: a second call on the same root is a no-op (it returns a detach function that does nothing). On a successful RPC it dispatches a `litro:action-success` CustomEvent on the form (`detail` = the deserialized result); on failure it dispatches `litro:action-error` (`detail` = the `LitroActionError`). Both events set `bubbles: true` and `composed: true`.

**Shadow-DOM caveat.** `submit` events are `composed: false`, so they never cross a shadow-root boundary — a document-level `enhanceForms()` cannot see forms rendered inside a component's shadow root. Such components attach their own enhancer against their render root, and detach on disconnect:

```ts
private detachEnhancer?: () => void;

firstUpdated(): void {
  this.detachEnhancer = enhanceForms(this.renderRoot as ShadowRoot);
}

disconnectedCallback(): void {
  super.disconnectedCallback();
  this.detachEnhancer?.();
}
```

### Requirements

- The form's target action must be a `defineAction` export **with an `input` schema**. Form fields are named, untrusted strings, and the schema is the parse boundary. Posting a form to a plain-function action or a schema-less `defineAction` returns 400.
- Repeated field names collapse into an array (`name="tag"` appearing three times becomes `tag: [a, b, c]`).
- `File` values pass through to the handler (buffered by h3's `readFormData`; there is no upload-size limit or streaming multipart yet).

### PRG flow and the worked error example

On the no-JS path a validation failure does not render inline — it 303-redirects back to the `Referer` with a one-shot `litro-form-error` cookie, and the re-rendered page surfaces the issues. This is the complete loop, mirroring the playground `/forms` page.

The action uses a schema that is strict about unknown keys:

```ts
// actions/forms.server.ts
import { defineAction, type StandardSchemaV1 } from '@beatzball/litro/actions';

const entrySchema: StandardSchemaV1<unknown, { name: string; message: string }> = {
  '~standard': {
    version: 1,
    vendor: 'my-app',
    validate(value) {
      const v = value as Record<string, unknown> | null;
      if (!v || typeof v !== 'object') return { issues: [{ message: 'Expected an object' }] };
      const issues: { message: string }[] = [];
      if (typeof v.name !== 'string' || v.name.trim() === '') issues.push({ message: 'Name is required' });
      if (typeof v.message !== 'string' || v.message.trim() === '') issues.push({ message: 'Message is required' });
      if (issues.length > 0) return { issues };
      return { value: { name: (v.name as string).trim(), message: (v.message as string).trim() } };
    },
  },
};

export const addEntry = defineAction({
  input: entrySchema,
  form: { redirect: '/forms' },
  async handler(input) {
    // ...persist...
    return { count: 1 };
  },
});
```

The page reads and clears the error cookie inside its `definePageData` fetcher with `getFormErrors(event)` and renders the issues above the form:

```ts
// pages/forms.ts
import { definePageData, LitroPage } from '@beatzball/litro';
import { actionUrl } from '@beatzball/litro/actions/client';
import { getFormErrors, type FormErrors } from '@beatzball/litro/actions/server';
import { addEntry } from '../actions/forms.server.js';

interface FormsPageData {
  errors: FormErrors | null;
}

export const pageData = definePageData(async (event) => {
  const errors = getFormErrors(event);
  return { errors } satisfies FormsPageData;
});

// inside render(), with `const d = this.serverData`
html`
  ${d?.errors
    ? html`<ul id="form-errors">
        ${(d.errors.issues ?? []).map((i) => html`<li>${(i as { message: string }).message}</li>`)}
        ${d.errors.message ? html`<li>${d.errors.message}</li>` : ''}
      </ul>`
    : ''}
  <form method="post" action=${actionUrl(addEntry)}>
    <input name="name" placeholder="Name" />
    <input name="message" placeholder="Message" />
    <button>Sign</button>
  </form>`;
```

`FormErrors` carries `actionId`, an optional `issues` array (validation failures), and an optional `message` + `status` (unexpected handler throws). Because `getFormErrors` deletes the cookie as it reads it, the next clean GET of the page shows no errors. The framework does not re-render the form or repopulate inputs for you — if you want sticky fields, thread the submitted values through `pageData` yourself.

On the enhanced path the same failure surfaces synchronously without a navigation: the `litro:action-error` event's `detail` is the `LitroActionError`, whose `issues` array holds the identical validator issues. So the two failure surfaces sit side by side — a PRG cookie read in `pageData` for no-JS, a CustomEvent detail for enhanced.

### CSRF modes

Form-mode requests always pass through the Origin/`Sec-Fetch-Site` gates (they cannot carry the `x-litro-action` header, so that check is skipped for them). Two modes are available per action via `defineAction({ csrf })`:

- **`'origin'` (default):** the Origin/`Sec-Fetch-Site` gates are the only defense. No token, no cookie.
- **`'token'` (opt-in):** additionally require a double-submit token. Mint it inside `definePageData` with `csrfToken(event)` (which sets the `__Host-litro-csrf` cookie if absent) and render it as a hidden field:

```ts
import { csrfToken } from '@beatzball/litro/actions/server';

export const pageData = definePageData(async (event) => {
  return { token: csrfToken(event) };
});

// in the template
html`
  <form method="post" action=${actionUrl(addEntryWithToken)}>
    <input type="hidden" name="_litro_csrf" value=${d?.token ?? ''} />
    <input name="name" />
    <button>Sign</button>
  </form>`;
```

The endpoint compares the `_litro_csrf` field against the `__Host-litro-csrf` cookie in constant time and returns 403 on a mismatch or a missing token. `csrfToken` and `getFormErrors` come from `@beatzball/litro/actions/server`, which is server-only — the Vite plugin replaces it with throwing stubs in client builds, so only call these inside `definePageData` or other server code.

### Redirect targets

On success the no-JS path redirects (303) to `form.redirect` if the action declares one, then the request `Referer`, then `/`:

```ts
export const addEntry = defineAction({
  input: entrySchema,
  form: { redirect: '/forms' },
  async handler(input) { /* ... */ },
});
```

A handler that writes its own response — for example calling `sendRedirect` on `ctx.event` — takes full control: the framework detects `event.handled` and sends nothing further.

## Streaming

An action whose handler is an async generator streams its yielded values to the browser instead of returning a single result:

```ts
// actions/forms.server.ts
export const countdown = defineAction({
  input: countSchema,
  async *handler({ from }) {
    for (let i = from; i >= 1; i--) {
      yield { i, at: new Date() };
    }
  },
});
```

On the client the generated stub resolves to an async iterable; consume it with `for await`:

```ts
const iterable = await countdown({ from: 3 });
for await (const chunk of iterable) {
  // chunk.at instanceof Date === true — seroval revives each chunk
  console.log(chunk.i, chunk.at.toISOString());
}
```

The transport is `application/x-ndjson`: one seroval cross-JSON node per line, revived per chunk on the client, so `Date`, `Map`, `Set`, `BigInt`, typed arrays, and circular references survive each yield. If the handler throws mid-stream the error arrives on the wire as a terminal line and is rethrown from the `for await` loop as a `LitroActionError` — wrap the loop in `try/catch` to surface it. A stream that ends without a terminal done line (a dropped connection) also throws a `LitroActionError`.

Streaming works over the RPC path only. Posting a form (`application/x-www-form-urlencoded` / `multipart/form-data`) to a streaming action returns 400 — the PRG model has no place to put a stream.

## Design guidance

Call actions from page-level components and `definePageData` fetchers. Keep `components/` presentational and pass action results down as props. This keeps components independently testable and makes the RPC boundary explicit — a component that accepts data as a prop does not need to know whether that data arrived via an in-process call or an HTTP round-trip.

## Actions vs `definePageData` vs API routes

| | `definePageData` | Server actions | `server/api/` routes |
|---|---|---|---|
| **When** | Initial render only | Mutations and on-demand calls | Any time |
| **Caller** | Litro page handler (SSR) | Your own client code | Any HTTP client |
| **Auth model** | Server-side, same request | Handler-level, inside action | Handler-level, in route |
| **Use for** | Data the page needs to render | Writes, fetches triggered by user interaction | Public APIs for third parties |

All three reach Nitro/H3 handlers at the end. The distinction is the authoring model and who the caller is.

## Limitations

- POST only. There is no GET action or cache-semantic variant yet.
- The `.server.ts` filename is the only server-module marker. A `'use server'` directive may be added in a future version without breaking existing code.
- There is no author-time lint rule guarding action authoring; the build-time guards below are the only static checks.
- No type-level `Serializable<T>` constraint. Non-serializable arguments or return values fail loudly at serialization time (runtime), not at compile time.
- Form-mode file uploads have no size limit or streaming multipart support — form mode accepts whatever h3's `readFormData` buffers into memory.
- `ctx.event` is `undefined` for in-process (SSR) calls on the dev server, because Nitro's async context is not available in the dev worker. Guard it when an action may be called from `definePageData`. HTTP (RPC) calls always have it, and production builds have it in-process too.
- `experimental.asyncContext` is what makes in-process `ctx.event` work in production. On edge presets it requires runtime `AsyncLocalStorage` support (for example Cloudflare's `nodejs_compat`).
- A `.server.ts` module outside the project root is stubbed in the client build but never registered on the server — its ids resolve to a silent 404. Keep action modules inside the app.
- `export *` from a `.server.ts` module is a build error. Export names must be statically knowable to generate client stubs.
- The non-function export guard is best-effort. Exports with statically ambiguous initializers (identifiers, call expressions, conditional expressions) pass the build. Any export that resolves to a non-function at runtime is never registered; calling it returns a 404 — the value is neither executed nor leaked.
- Named re-exports (`export { x } from './y'`) are stubbed and callable if `x` resolves to a function at runtime; they 404 otherwise.
