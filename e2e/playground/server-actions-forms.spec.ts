import { test, expect } from '@playwright/test';
import { hashActionId } from '../../packages/framework/dist/actions/hash.js';

const ADD_ENTRY_ID = hashActionId('actions/forms.server', 'addEntry');
const TOKEN_ID = hashActionId('actions/forms.server', 'addEntryWithToken');

test.describe('server actions — no-JS form posts (PRG)', () => {
  test('full failure loop: invalid post, 303 bounce, error rendered once, then cleared', async ({ request, baseURL }) => {
    const res = await request.post(`/__litro/action/${ADD_ENTRY_ID}`, {
      form: { name: '', message: '' },
      headers: { referer: `${baseURL}/forms` },
      maxRedirects: 0,
    });
    expect(res.status()).toBe(303);
    expect(res.headers()['location']).toContain('/forms');
    expect(res.headers()['set-cookie']).toContain('litro-form-error=');

    // The request fixture's cookie jar carries the one-shot cookie.
    const bounced = await request.get('/forms');
    expect(await bounced.text()).toContain('Name is required');

    // One-shot: a second GET renders clean.
    const again = await request.get('/forms');
    expect(await again.text()).not.toContain('Name is required');
  });

  test('valid post redirects to form.redirect and the entry renders', async ({ request }) => {
    const res = await request.post(`/__litro/action/${ADD_ENTRY_ID}`, {
      form: { name: 'NoJs', message: 'hello from the no-js path' },
      maxRedirects: 0,
    });
    expect(res.status()).toBe(303);
    expect(res.headers()['location']).toBe('/forms');
    const pageRes = await request.get('/forms');
    expect(await pageRes.text()).toContain('hello from the no-js path');
  });

  test('token mode: missing token 403; minted token passes', async ({ request }) => {
    const missing = await request.post(`/__litro/action/${TOKEN_ID}`, {
      form: { name: 'x', message: 'y' },
      maxRedirects: 0,
    });
    expect(missing.status()).toBe(403);

    // GET /forms mints the __Host- cookie; read the token from the set-cookie
    // header explicitly (Secure cookies over http may not enter every jar).
    const pageRes = await request.get('/forms');
    const setCookie = pageRes.headers()['set-cookie'] ?? '';
    const token = /__Host-litro-csrf=([^;]+)/.exec(setCookie)?.[1];
    expect(token).toBeTruthy();

    const ok = await request.post(`/__litro/action/${TOKEN_ID}`, {
      form: { name: 'Tok', message: 'token path works', _litro_csrf: token! },
      headers: { cookie: `__Host-litro-csrf=${token!}` },
      maxRedirects: 0,
    });
    expect(ok.status()).toBe(303);
  });
});

test.describe('server actions — enhanced form posts', () => {
  test('validation error surfaces via litro:action-error without navigation', async ({ page }) => {
    await page.goto('/forms');
    // The router's initial resolve mounts a second (hidden) page-forms
    // alongside the SSR'd one to avoid a FOUC swap (see LitroOutlet.ts /
    // litro-router's _resolve()); wait for the atomic swap to settle before
    // interacting, matching the convention in server-actions.spec.ts.
    await page.waitForSelector('page-forms:not([hidden])');
    // Router "swap complete" marker — before it, clicks can land on the dead
    // SSR'd shell. Same convention as server-actions.spec.ts.
    await page.waitForSelector('litro-outlet[data-litro-settled]');
    await page.locator('#gb-submit').click();
    await expect(page.locator('#enhanced-error')).toContainText('Name is required');
    expect(page.url()).toContain('/forms');
    await expect(page.locator('#form-errors')).toHaveCount(0); // no PRG bounce happened
  });

  test('success surfaces via litro:action-success detail', async ({ page }) => {
    await page.goto('/forms');
    await page.waitForSelector('page-forms:not([hidden])');
    // Router "swap complete" marker (see the validation test above).
    await page.waitForSelector('litro-outlet[data-litro-settled]');
    await page.fill('#gb-name', 'Enhanced');
    await page.fill('#gb-message', 'enhanced hello');
    await page.locator('#gb-submit').click();
    await expect(page.locator('#enhanced-result')).toContainText('saved entry');
  });
});
