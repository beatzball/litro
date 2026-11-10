// Self-test fixture for scripts/check-catch-all-escape.mjs. Every interpolation
// in an HTML template below is a mistake the check must report.

function escapeHtml(text: string): string {
  // Wrong: `&` last, so the entities the others write are escaped twice.
  return text
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/&/g, '&amp;');
}

export function page(pathname: string, url: URL): string {
  return `<!DOCTYPE html>
<body><p>No page matched <code>${pathname}</code>.</p>
<p>${url.search}</p>
<p>${String(escapeHtml(pathname))}</p></body>`;
}
