---
'@beatzball/create-litro': patch
---

Escape the request path on the 404 page of every recipe (issue 295).

The catch-all handler, `server/routes/[...].ts`, wrote the request path into its 404 page as `${pathname}`, with no escaping. The risk today is low: the server percent-encodes `<`, `>` and `"` in the path, so no markup from the request reaches the page. But the page relied on that encoding, not on escaping, and a client or proxy that hands the handler a decoded path would make it an injection. `&` and `'` were never encoded, so a path holding `&amp;` or `&lt;` displayed as `&` or `<` instead of the path as typed. New apps get the fix. An existing app needs two edits to its own `server/routes/[...].ts`:

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
