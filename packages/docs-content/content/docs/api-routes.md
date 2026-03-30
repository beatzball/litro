---
title: API Routes
description: Create API endpoints in server/api/ using standard Nitro/H3 handlers.
date: 2026-01-01
---

# API Routes

API routes are standard Nitro/H3 event handlers placed in `server/api/`. No Lit involved.

## Creating an API Route

```ts
// server/api/hello.ts
import { defineEventHandler } from 'h3';

export default defineEventHandler((event) => {
  return { message: 'Hello from the API', timestamp: Date.now() };
});
```

This file is automatically registered at `/api/hello` by Nitro's route scanner.

## HTTP Methods

Use filename suffixes for method-specific handlers:

```
server/api/
  posts.get.ts     → GET /api/posts
  posts.post.ts    → POST /api/posts
  posts/[id].ts    → /api/posts/:id (all methods)
```

## Reading Request Data

```ts
import { defineEventHandler, readBody, getQuery } from 'h3';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const body = await readBody(event);
  return { query, body };
});
```

## Error Responses

```ts
import { defineEventHandler, createError } from 'h3';

export default defineEventHandler((event) => {
  const id = event.context.params?.id;
  if (!id) throw createError({ statusCode: 400, message: 'Missing id' });
  // ...
});
```
