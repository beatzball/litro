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

// Starts with escapeHtml( and ends with ), but the value is not escaped.
export function suffix(pathname: string, url: URL): string {
  return `<p>${escapeHtml(pathname) + pathname.slice()}</p>
<p>${escapeHtml(pathname) || String(url.search)}</p>`;
}

// HTML the lint cannot follow: it must fail closed, not pass.
export function quoted(pathname: string): string {
  return '<p>' + pathname + '</p>';
}

export function replaced(pathname: string): string {
  return `<p>__PATH__</p>`.replace('__PATH__', pathname);
}

export function hidden(pathname: string): string {
  return `\x3cp>${escapeHtml(pathname)}\x3c/p>`;
}
