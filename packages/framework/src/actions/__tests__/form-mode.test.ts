import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp, createRouter, toNodeListener } from 'h3';
import { createActionHandler, type ActionModuleEntry } from '../handler.js';
import { defineAction } from '../define.js';
import { hashActionId } from '../hash.js';
import { CSRF_COOKIE, FORM_ERROR_COOKIE } from '../server.js';
import type { StandardSchemaV1 } from '../standard-schema.js';

interface EntryInput {
  name: string;
  tags?: string[];
}

// Strict schema: rejects unknown keys, so a leaked _litro_csrf field fails it.
const entrySchema: StandardSchemaV1<unknown, EntryInput> = {
  '~standard': {
    version: 1,
    vendor: 'litro-test',
    validate(value) {
      const v = value as Record<string, unknown> | null;
      if (!v || typeof v !== 'object') return { issues: [{ message: 'Expected an object' }] };
      const issues: { message: string }[] = [];
      if (typeof v.name !== 'string' || v.name === '') issues.push({ message: 'Name is required' });
      for (const k of Object.keys(v)) {
        if (k !== 'name' && k !== 'tags') issues.push({ message: `Unknown field: ${k}` });
      }
      if (issues.length) return { issues };
      return { value: v as unknown as EntryInput };
    },
  },
};

const seen: EntryInput[] = [];
const formAction = defineAction({
  input: entrySchema,
  form: { redirect: '/after' },
  async handler(input) {
    seen.push(input);
    return { count: seen.length };
  },
});
const tokenAction = defineAction({
  input: entrySchema,
  csrf: 'token',
  async handler(input) {
    seen.push(input);
    return { count: seen.length };
  },
});
const noSchemaAction = defineAction({
  async handler() {
    return 'x';
  },
});
const noRedirectAction = defineAction({
  input: entrySchema,
  async handler(input) {
    seen.push(input);
    return 'ok';
  },
});
const throwingAction = defineAction({
  input: entrySchema,
  async handler(): Promise<never> {
    throw new Error('db exploded');
  },
});
const streamingAction = defineAction({
  input: entrySchema,
  async *handler() {
    yield 1;
  },
});
async function plainFn(): Promise<string> {
  return 'plain';
}

const REL = 'actions/forms.server';
const module = { formAction, tokenAction, noSchemaAction, noRedirectAction, throwingAction, streamingAction, plainFn };
const entries: ActionModuleEntry[] = [{ relPath: REL, module }];
const id = (name: string) => hashActionId(REL, name);

let server: Server;
let base: string;

beforeAll(async () => {
  const app = createApp();
  const router = createRouter();
  router.post('/__litro/action/:id', createActionHandler(entries));
  app.use(router);
  server = createServer(toNodeListener(app));
  await new Promise<void>((resolve) => server.listen(0, resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

function postForm(actionName: string, fields: Record<string, string | string[]>, headers: Record<string, string> = {}) {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(fields)) {
    for (const item of Array.isArray(v) ? v : [v]) body.append(k, item);
  }
  return fetch(`${base}/__litro/action/${id(actionName)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', ...headers },
    body: body.toString(),
    redirect: 'manual',
  });
}

describe('form mode', () => {
  it('does not require the x-litro-action header for form posts', async () => {
    const res = await postForm('formAction', { name: 'Ada' });
    expect(res.status).toBe(303);
  });

  it('valid post redirects to form.redirect', async () => {
    const res = await postForm('formAction', { name: 'Ada' });
    expect(res.headers.get('location')).toBe('/after');
  });

  it('falls back to Referer, then /, for the success redirect', async () => {
    const withReferer = await postForm('noRedirectAction', { name: 'x' }, { referer: `${base}/somewhere` });
    expect(withReferer.status).toBe(303);
    expect(withReferer.headers.get('location')).toBe(`${base}/somewhere`);
    const bare = await postForm('noRedirectAction', { name: 'x' });
    expect(bare.headers.get('location')).toBe('/');
  });

  it('validation failure bounces 303 to Referer with the one-shot issues cookie', async () => {
    const res = await postForm('formAction', { name: '' }, { referer: `${base}/forms` });
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe(`${base}/forms`);
    const cookie = res.headers.get('set-cookie') ?? '';
    expect(cookie).toContain(`${FORM_ERROR_COOKIE}=`);
    const raw = decodeURIComponent(cookie.split(`${FORM_ERROR_COOKIE}=`)[1].split(';')[0]);
    const parsed = JSON.parse(raw) as { actionId: string; issues: { message: string }[] };
    expect(parsed.actionId).toBe(id('formAction'));
    expect(parsed.issues[0].message).toBe('Name is required');
  });

  it('handler throw bounces 303 with message/status in the cookie', async () => {
    const res = await postForm('throwingAction', { name: 'Ada' }, { referer: `${base}/forms` });
    expect(res.status).toBe(303);
    const cookie = res.headers.get('set-cookie') ?? '';
    const raw = decodeURIComponent(cookie.split(`${FORM_ERROR_COOKIE}=`)[1].split(';')[0]);
    const parsed = JSON.parse(raw) as { message: string; status: number };
    expect(parsed.message).toBe('db exploded');
    expect(parsed.status).toBe(500);
  });

  it('repeated fields arrive as arrays and _litro_csrf is stripped', async () => {
    seen.length = 0;
    const res = await postForm('formAction', { name: 'Ada', tags: ['a', 'b'], _litro_csrf: 'tok' });
    expect(res.status).toBe(303); // strict schema passed → token field was stripped
    expect(seen[0]).toEqual({ name: 'Ada', tags: ['a', 'b'] });
  });

  it('plain-function and schema-less targets get 400 with an explanation', async () => {
    for (const name of ['plainFn', 'noSchemaAction']) {
      const res = await postForm(name, { name: 'x' });
      expect(res.status).toBe(400);
      const body = (await res.json()) as { message: string };
      expect(body.message).toContain('input schema');
    }
  });

  it('token mode: missing token 403, wrong token 403, matching token 303', async () => {
    const missing = await postForm('tokenAction', { name: 'x' });
    expect(missing.status).toBe(403);
    const wrong = await postForm('tokenAction', { name: 'x', _litro_csrf: 'bad' }, { cookie: `${CSRF_COOKIE}=good` });
    expect(wrong.status).toBe(403);
    const ok = await postForm('tokenAction', { name: 'x', _litro_csrf: 'good' }, { cookie: `${CSRF_COOKIE}=good` });
    expect(ok.status).toBe(303);
  });

  it('streaming actions invoked via form mode get 400', async () => {
    const res = await postForm('streamingAction', { name: 'x' });
    expect(res.status).toBe(400);
  });

  it('content-type essence match: charset parameter does not break form-mode detection', async () => {
    const res = await postForm('formAction', { name: 'Ada' }, {
      'content-type': 'application/x-www-form-urlencoded; charset=utf-8',
    });
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/after');
  });

  it('content-type essence match: a form media-type name inside another type is not form mode', async () => {
    // text/plain with a bogus parameter that merely mentions multipart/form-data
    // must not be misclassified as form mode by a naive substring match. With
    // no x-litro-action header, it should be rejected as RPC mode instead.
    const res = await fetch(`${base}/__litro/action/${id('formAction')}`, {
      method: 'POST',
      headers: { 'content-type': 'text/plain; x="multipart/form-data"' },
      body: 'name=Ada',
      redirect: 'manual',
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { message: string };
    expect(body.message).toContain('x-litro-action');
  });

  it('malformed multipart body returns a curated 400, not a raw 500', async () => {
    const res = await fetch(`${base}/__litro/action/${id('formAction')}`, {
      method: 'POST',
      headers: { 'content-type': 'multipart/form-data', 'x-litro-action': '1' },
      body: 'not-multipart',
      redirect: 'manual',
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { message: string };
    expect(body.message.toLowerCase()).toContain('form');
  });

  it('Origin gate honors x-forwarded-host (both modes)', async () => {
    const pass = await postForm('formAction', { name: 'x' }, {
      origin: 'https://public.example',
      'x-forwarded-host': 'public.example, internal:3000',
    });
    expect(pass.status).toBe(303);
    const fail = await postForm('formAction', { name: 'x' }, {
      origin: 'https://evil.example',
      'x-forwarded-host': 'public.example',
    });
    expect(fail.status).toBe(403);
  });
});
