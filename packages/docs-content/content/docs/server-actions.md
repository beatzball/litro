---
title: Server Actions
description: Call server-side functions from your components over a typed RPC without writing API routes.
date: 2026-07-04
---

# Server Actions

Export an async function from a `*.server.ts` module and import it anywhere in your application. During SSR the call runs in the same process with no network hop. In the browser the same import is replaced by a generated stub that sends a typed `POST /__litro/action/<id>` request and deserializes the result — the entire server module and all of its transitive dependencies (database drivers, secrets) never enter the client bundle.

## Security

Every export of a `.server.ts` module is a public HTTP endpoint. Treat all arguments as hostile input regardless of how the action is called — in-process SSR calls and browser RPC calls share the same handler code. Authentication and authorization belong inside the handler, not at the call site. Return values are serialized and sent to the client; shape them to expose only what the caller needs. Rate limiting composes at the Nitro middleware layer (`server/middleware/`). The built-in CSRF protections guard the transport channel; they do not substitute for handler-level auth.

Only export what should be reachable over HTTP. The Vite plugin detects some non-function exports at build time and raises an error; anything that reaches the runtime and is not a function is silently unregistered — it is never executed or leaked.

## Setup

Five one-time edits wire the feature into a Litro project. Add them once per project; there is nothing per-action. The `server/stubs/` directory is generated on every build and dev restart and should be gitignored.

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

The Vite plugin intercepts any `*.server.ts` import entering the client module graph and replaces it wholesale with a generated stub before Vite's import analysis runs. The original module code and all of its transitive imports are structurally absent from `dist/client/`.

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

Stack traces are included in error payloads in development only. They are never included in production responses.

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
3. If `Origin` is present its host must match the request `Host` header.

Any check failure returns a 403. The generated client stubs (`callAction`) always send `x-litro-action: 1`; no application code needs to set it manually. There is no configuration surface for CSRF behavior in v1.

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

## Limitations (v1)

- No form / progressive-enhancement path. A no-JS `formAction` API with CSRF token support is planned for a later milestone.
- No streaming returns. Handlers must return a fully resolved value; `AsyncIterable` handlers are not supported.
- POST only. There is no GET action or cache-semantic variant.
- The `.server.ts` filename is the only server-module marker. A `'use server'` directive may be added in a future version without breaking existing code.
- `export *` from a `.server.ts` module is a build error. Export names must be statically knowable to generate client stubs.
- The non-function export guard is best-effort. Exports with statically ambiguous initializers (identifiers, call expressions, conditional expressions) pass the build. Any export that resolves to a non-function at runtime is never registered; calling it returns a 404 — the value is neither executed nor leaked.
- Named re-exports (`export { x } from './y'`) are stubbed and callable if `x` resolves to a function at runtime; they 404 otherwise.
- The `create-litro` scaffolding templates do not yet include server actions wiring. Follow the setup steps above when adding actions to a new project.
