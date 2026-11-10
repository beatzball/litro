---
'@beatzball/create-litro': patch
---

Escape the request path on the 404 page of every recipe (issue 295).

The catch-all handler, `server/routes/[...].ts`, wrote the request path into its 404 page as `${pathname}`, with no escaping. A browser percent-encodes `<`, `>` and `"` in a path, so this was hard to reach from an address bar, but `&` and `'` were never encoded (a request for `/a&lt;b&gt;` showed `<b>`), and a proxy or runtime that decodes the path would have opened the rest. New apps get the fix. An existing app needs two edits to its own `server/routes/[...].ts`:

1. Add this function below the imports:

   ```ts
   function escapeHtml(text: string): string {
     return text
       .replace(/&/g, '&amp;')
       .replace(/</g, '&lt;')
       .replace(/>/g, '&gt;')
       .replace(/"/g, '&quot;')
       .replace(/'/g, '&#39;');
   }
   ```

   Keep `&` first, or the other entities get escaped twice.

2. In the 404 page, change `<code>${pathname}</code>` to `<code>${escapeHtml(pathname)}</code>`.

The page's text and look do not change.
