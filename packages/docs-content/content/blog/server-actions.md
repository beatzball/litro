---
title: "Server Actions in Litro 0.11: Typed RPC, Forms Without JavaScript, and Streaming"
description: "Litro 0.11.0 ships Server Actions: call server functions from the browser with full type safety, submit forms that work with JavaScript disabled, and stream results chunk by chunk — no API routes, no schema duplication."
date: 2026-07-07
tags: [server-actions, forms, streaming, rpc]
---

# Server Actions in Litro 0.11: Typed RPC, Forms Without JavaScript, and Streaming

`@beatzball/litro` 0.11.0 introduces Server Actions: a typed function-call boundary between the browser and your server. Export an async function from a `*.server.ts` module and call it from anywhere — no API route files, no fetch wrappers, no duplicated types. The release includes the full feature set in one go: the RPC core, progressive-enhancement forms with a no-JS path, and streaming returns.

New projects scaffolded with `npm create @beatzball/litro` (`@beatzball/create-litro` 0.7.0+) come with everything pre-wired.

## One import, two execution paths

```ts
// posts/posts.server.ts — runs only on the server
export async function getPost(id: string) {
  return db.posts.findById(id); // db driver never enters the client bundle
}
```

```ts
// pages/posts/[id].ts — the SAME import works in both worlds
import { getPost } from '../../posts/posts.server.js';

// SSR: an in-process function call, no network hop
export const pageData = definePageData(async (event) => {
  return { post: await getPost(event.context.params?.id ?? '') };
});

// Browser: the same call becomes a typed POST /__litro/action/<id>
const fresh = await getPost(this.postId);
```

At build time, Litro's Vite plugin replaces every `.server.ts` module in the client graph with a generated stub, so server code and its transitive dependencies are structurally absent from the browser bundle. TypeScript resolves the import to the real file either way — the call is fully typed with no schema duplication. Rich values round-trip: `Date`, `Map`, `Set`, `BigInt`, and circular references all survive serialization.

Validation is built in. Wrap a handler with `defineAction` and any Standard Schema validator (Zod, Valibot, ArkType, or hand-rolled) becomes the parse boundary for hostile input:

```ts
import { defineAction } from '@beatzball/litro/actions';

export const createPost = defineAction({
  input: postSchema,
  async handler(input, ctx) {
    return db.posts.create(input);
  },
});
```

## Forms that work with JavaScript disabled

Point a plain HTML form at an action with `actionUrl()`. The markup is identical in all three adapters — it is ordinary attribute interpolation:

```ts
import { actionUrl } from '@beatzball/litro/actions/client';
import { createPost } from '../posts/posts.server.js';

html`
  <form method="post" action=${actionUrl(createPost)}>
    <input name="title" required />
    <textarea name="body"></textarea>
    <button>Publish</button>
  </form>`;
```

Without JavaScript, the browser posts the form natively and the server answers with a classic Post/Redirect/Get flow: success redirects with a 303, validation failures bounce back with a one-shot cookie your page reads via `getFormErrors(event)` and renders above the form. With JavaScript, one call to `enhanceForms()` upgrades the same form to a typed RPC and reports the outcome through `litro:action-success` / `litro:action-error` events — the page decides what to do with them.

Form posts are guarded by Origin and `Sec-Fetch-Site` checks by default, and actions that want defense in depth can opt into a double-submit cookie token with `defineAction({ csrf: 'token' })`. Form targets must declare an input schema — form fields are untrusted strings, and the schema is where they become data.

## Streaming returns

Any handler that returns an async iterable streams its chunks as they are produced:

```ts
export const tail = defineAction({
  input: jobSchema,
  async *handler({ jobId }) {
    for await (const line of logStream(jobId)) yield line;
  },
});
```

```ts
// client — chunks arrive incrementally, rich values revived per chunk
for await (const line of await tail({ jobId })) {
  render(line);
}
```

The transport is newline-delimited JSON of seroval nodes with a shared reference space, so object identity is preserved across chunks and a `Date` yielded mid-stream arrives as a `Date`. Mid-stream errors surface on the client as a thrown `LitroActionError`, and abandoning the loop cancels the underlying response instead of downloading it forever.

## Security posture

Every export of a `.server.ts` module is a public HTTP endpoint — the docs lead with that, and the defaults are built around it: CSRF gates on by default, no stack traces in production error payloads, schema validation as the documented path for anything touching data, and a build-time error for non-function exports that would otherwise leak.

## Getting it

Upgrade to `@beatzball/litro` 0.11.0. The feature is opt-in — nothing changes in an existing app until you wire it, and there are no breaking changes. Adding actions to an existing project is six one-time config edits; the [Server Actions guide](/docs/server-actions) walks through each one, including the upgrade checklist for apps coming from 0.10.x or earlier. Or scaffold a fresh app and let the template do the wiring:

```bash
npm create @beatzball/litro my-app
```

The full guide — including the worked form error-handling example and the streaming protocol details — lives at [/docs/server-actions](/docs/server-actions).
