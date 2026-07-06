import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp, createRouter, defineEventHandler, toNodeListener } from 'h3';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { stampActionIds } from '../server.js';
import { ACTION_ID, actionUrl } from '../client.js';
import { hashActionId } from '../hash.js';
import type { ActionModuleEntry } from '../handler.js';
import {
  csrfToken,
  verifyCsrfToken,
  getFormErrors,
  setFormErrorCookie,
  CSRF_COOKIE,
  FORM_ERROR_COOKIE,
} from '../server.js';

describe('stampActionIds', () => {
  it('stamps every function export with hashActionId(relPath, exportName)', () => {
    const fn = async () => 'x';
    const other = async () => 'y';
    const entries: ActionModuleEntry[] = [
      { relPath: 'actions/demo.server', module: { fn, other, notAFn: 42 } },
    ];
    stampActionIds(entries);
    expect((fn as unknown as Record<symbol, unknown>)[ACTION_ID]).toBe(
      hashActionId('actions/demo.server', 'fn'),
    );
    expect(actionUrl(other)).toBe(
      `/__litro/action/${hashActionId('actions/demo.server', 'other')}`,
    );
  });

  it('is idempotent and skips already-stamped functions', () => {
    const fn = async () => 'x';
    const entries: ActionModuleEntry[] = [{ relPath: 'a.server', module: { fn } }];
    stampActionIds(entries);
    expect(() => stampActionIds(entries)).not.toThrow();
  });
});

describe('csrf + form-error cookies', () => {
  let server: Server;
  let base: string;

  beforeAll(async () => {
    const app = createApp();
    const router = createRouter();
    router.get('/token', defineEventHandler((event) => ({ token: csrfToken(event) })));
    router.get(
      '/verify',
      defineEventHandler((event) => ({
        ok: verifyCsrfToken(event, new URL(`http://x${event.path}`).searchParams.get('t')),
      })),
    );
    router.get(
      '/set-errors',
      defineEventHandler((event) => {
        setFormErrorCookie(event, { actionId: 'abc123def456', issues: [{ message: 'Name is required' }] });
        return 'ok';
      }),
    );
    router.get('/read-errors', defineEventHandler((event) => ({ errors: getFormErrors(event) })));
    app.use(router);
    server = createServer(toNodeListener(app));
    await new Promise<void>((resolve) => server.listen(0, resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  it('mints a __Host- cookie with Secure, Path=/, HttpOnly, SameSite=Lax', async () => {
    const res = await fetch(`${base}/token`);
    const setCookie = res.headers.get('set-cookie') ?? '';
    const { token } = (await res.json()) as { token: string };
    expect(token.length).toBeGreaterThanOrEqual(32);
    expect(setCookie).toContain(`${CSRF_COOKIE}=${token}`);
    expect(setCookie).toContain('Path=/');
    expect(setCookie).toContain('Secure');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Lax');
  });

  it('returns the existing token without re-setting the cookie', async () => {
    const first = await fetch(`${base}/token`);
    const { token } = (await first.json()) as { token: string };
    const second = await fetch(`${base}/token`, { headers: { cookie: `${CSRF_COOKIE}=${token}` } });
    expect(((await second.json()) as { token: string }).token).toBe(token);
    expect(second.headers.get('set-cookie')).toBeNull();
  });

  it('verifyCsrfToken matches only the exact cookie value', async () => {
    const okRes = await fetch(`${base}/verify?t=tok-1`, { headers: { cookie: `${CSRF_COOKIE}=tok-1` } });
    expect(((await okRes.json()) as { ok: boolean }).ok).toBe(true);
    const badRes = await fetch(`${base}/verify?t=wrong`, { headers: { cookie: `${CSRF_COOKIE}=tok-1` } });
    expect(((await badRes.json()) as { ok: boolean }).ok).toBe(false);
    const noneRes = await fetch(`${base}/verify?t=tok-1`);
    expect(((await noneRes.json()) as { ok: boolean }).ok).toBe(false);
  });

  it('form-error cookie round-trips once and is cleared on read', async () => {
    const set = await fetch(`${base}/set-errors`);
    const setCookie = set.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain(`${FORM_ERROR_COOKIE}=`);
    expect(setCookie).toContain('Max-Age=30');
    expect(setCookie).not.toContain('HttpOnly');
    const cookiePair = setCookie.split(';')[0];
    const read = await fetch(`${base}/read-errors`, { headers: { cookie: cookiePair } });
    const { errors } = (await read.json()) as { errors: { actionId: string; issues: { message: string }[] } };
    expect(errors.actionId).toBe('abc123def456');
    expect(errors.issues[0].message).toBe('Name is required');
    // read handler must clear the cookie (expiry set-cookie in the response)
    expect(read.headers.get('set-cookie')).toContain(`${FORM_ERROR_COOKIE}=`);
  });

  it('getFormErrors returns null for absent or malformed cookies', async () => {
    const none = await fetch(`${base}/read-errors`);
    expect(((await none.json()) as { errors: unknown }).errors).toBeNull();
    const bad = await fetch(`${base}/read-errors`, {
      headers: { cookie: `${FORM_ERROR_COOKIE}=not-json` },
    });
    expect(((await bad.json()) as { errors: unknown }).errors).toBeNull();
  });
});
