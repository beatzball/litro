// Self-test fixture for scripts/check-catch-all-escape.mjs. Nothing here may be
// reported.

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function matcher(path: string): RegExp {
  // `${` inside a regex literal is not a template.
  const literal = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // A template with no markup may interpolate freely.
  return new RegExp(`^${literal}$`);
}

export function page(pathname: string): string {
  // "a quoted `backtick` and ${not} a template" in a comment.
  const note = 'a `quoted` ${string}';
  return `<!DOCTYPE html>
<body><p>No page matched <code>${escapeHtml(pathname)}</code>.</p>
<p>${escapeHtml(`${note} (${pathname.length})`)}</p></body>`;
}
