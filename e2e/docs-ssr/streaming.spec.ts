import { test, expect } from '@playwright/test';

// Representative routes across different page types
const ROUTES = [
  { path: '/', label: 'home' },
  { path: '/blog', label: 'blog index' },
  { path: '/docs/introduction', label: 'docs page' },
  { path: '/search?q=router', label: 'search page' },
];

// ---------------------------------------------------------------------------
// HTML structure checks
// ---------------------------------------------------------------------------

for (const { path, label } of ROUTES) {
  test(`${label} (${path}) returns valid SSR HTML`, async ({ request }) => {
    const res = await request.get(path);
    expect(res.status()).toBe(200);

    const html = await res.text();
    expect(html).toMatch(/^<!DOCTYPE html>/i);
    expect(html).toContain('</html>');
    // Verify SSR rendered the page (lit-part markers or DSD templates present)
    const hasSSRContent = html.includes('<!--lit-part') || html.includes('<template shadowrootmode=');
    expect(hasSSRContent).toBe(true);
  });
}

// ---------------------------------------------------------------------------
// Chunked transfer encoding (streaming)
// ---------------------------------------------------------------------------

test('home page is served with chunked transfer encoding', async ({ request }) => {
  const res = await request.get('/');
  // Nitro/Node.js uses chunked encoding by default for streamed responses
  const te = res.headers()['transfer-encoding'];
  expect(te).toBe('chunked');
});

// ---------------------------------------------------------------------------
// Shell ordering: hydration support script before app bundle
// ---------------------------------------------------------------------------

test('app bundle script appears in the document foot', async ({ request }) => {
  const res = await request.get('/');
  const html = await res.text();

  // The app entry <script type="module"> must be present in the HTML.
  // Hydration support (lit-element-hydrate-support.js) is the first import
  // inside app.ts and is bundled into app.js — no separate script tag needed.
  // Dev serves the live source entry (`/app.ts`, issue 97); prod/preview
  // serves the built bundle (`/_litro/app.js`) — accept either.
  const appIdx = html.search(/src="[^"]*app\.(js|ts)"/);
  expect(appIdx).toBeGreaterThan(-1);
  // The script should appear after the main content (in the foot)
  const outletIdx = html.indexOf('</litro-outlet>');
  expect(outletIdx).toBeGreaterThan(-1);
  expect(appIdx).toBeGreaterThan(outletIdx);
});

// ---------------------------------------------------------------------------
// JSON mode (SPA navigation)
// ---------------------------------------------------------------------------

test('docs page returns JSON when Accept: application/json', async ({ request }) => {
  const res = await request.get('/docs/introduction', {
    headers: { Accept: 'application/json' },
  });
  expect(res.status()).toBe(200);
  const contentType = res.headers()['content-type'] ?? '';
  expect(contentType).toContain('application/json');

  const data = await res.json();
  expect(data).toHaveProperty('doc');
  expect(data.doc).toHaveProperty('title');
});

test('blog post returns JSON when Accept: application/json', async ({ request }) => {
  const res = await request.get('/blog/welcome', {
    headers: { Accept: 'application/json' },
  });
  expect(res.status()).toBe(200);
  const data = await res.json();
  expect(data).toHaveProperty('post');
  expect(data.post).toHaveProperty('title');
});

// ---------------------------------------------------------------------------
// 404 handling
// ---------------------------------------------------------------------------

test('non-existent route returns valid HTML', async ({ request }) => {
  const res = await request.get('/does-not-exist-xyz');
  // Framework may return 200 with a client-side "not found" page or 404
  expect([200, 404]).toContain(res.status());
  const html = await res.text();
  expect(html).toContain('</html>');
});

// ---------------------------------------------------------------------------
// DSD polyfill present
// ---------------------------------------------------------------------------

test('DSD polyfill script is present in head', async ({ request }) => {
  const res = await request.get('/');
  const html = await res.text();
  // The polyfill uses MutationObserver + shadowrootmode
  expect(html).toContain('shadowrootmode');
});

// ---------------------------------------------------------------------------
// Response is not truncated (complete HTML)
// ---------------------------------------------------------------------------

for (const { path, label } of ROUTES) {
  test(`${label} response is complete (opens and closes all major tags)`, async ({ request }) => {
    const res = await request.get(path);
    const html = await res.text();

    // Every opened <html> and <body> is closed
    expect(html).toContain('<html');
    expect(html).toContain('</html>');
    expect(html).toContain('<body');
    expect(html).toContain('</body>');
    expect(html).toContain('<head');
    expect(html).toContain('</head>');
  });
}
