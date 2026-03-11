import { test, expect } from '@playwright/test';

test('GET /api/posts returns array', async ({ request }) => {
  const response = await request.get('/api/posts');
  expect(response.status()).toBe(200);
  const json = await response.json();
  expect(Array.isArray(json)).toBe(true);
  expect(json.length).toBeGreaterThan(0);
  const first = json[0];
  expect(first).toHaveProperty('title');
  expect(first).toHaveProperty('url');
});

test('GET /api/hello returns message and timestamp', async ({ request }) => {
  const response = await request.get('/api/hello');
  expect(response.status()).toBe(200);
  const json = await response.json();
  expect(json).toHaveProperty('message');
  expect(json).toHaveProperty('timestamp');
});
