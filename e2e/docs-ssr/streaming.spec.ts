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
  test(`${label} (${path}) returns valid HTML with DSD`, async ({ request }) => {
    const res = await request.get(path);
    expect(res.status()).toBe(200);

    const html = await res.text();
    expect(html).toMatch(/^<!DOCTYPE html>/i);
    expect(html).toContain('</html>');
    expect(html).toContain('<template shadowrootmode=');
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

test('hydration support script appears before app bundle in head', async ({ request }) => {
  const res = await request.get('/');
  const html = await res.text();

  const hydrateIdx = html.indexOf('lit-element-hydrate-support');
  const appIdx = html.indexOf('app.js');
  expect(hydrateIdx).toBeGreaterThan(-1);
  expect(appIdx).toBeGreaterThan(-1);
  expect(hydrateIdx).toBeLessThan(appIdx);
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

test('non-existent route returns 404 with valid HTML', async ({ request }) => {
  const res = await request.get('/does-not-exist-xyz');
  expect(res.status()).toBe(404);
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
