/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { enhanceForms } from '../form-client.js';
import { serializeValue } from '../serialize.js';
import { LitroActionError } from '../error.js';

const fetchMock = vi.fn();
let detach: (() => void) | undefined;

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  document.body.innerHTML = '';
});
afterEach(() => {
  detach?.();
  detach = undefined;
  vi.unstubAllGlobals();
});

function okResponse(value: unknown) {
  return new Response(serializeValue(value), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function buildForm(action: string, fields: Record<string, string | string[]>): HTMLFormElement {
  const form = document.createElement('form');
  form.setAttribute('method', 'post');
  form.setAttribute('action', action);
  for (const [name, v] of Object.entries(fields)) {
    for (const value of Array.isArray(v) ? v : [v]) {
      const input = document.createElement('input');
      input.name = name;
      input.value = value;
      form.appendChild(input);
    }
  }
  document.body.appendChild(form);
  return form;
}

function submit(form: HTMLFormElement): Event {
  const e = new Event('submit', { bubbles: true, cancelable: true });
  form.dispatchEvent(e);
  return e;
}

const ACTION = '/__litro/action/abc123def456';

describe('enhanceForms', () => {
  it('intercepts action forms and performs the RPC with converted input', async () => {
    detach = enhanceForms();
    fetchMock.mockResolvedValue(okResponse({ count: 1 }));
    const form = buildForm(ACTION, { name: 'Ada', tag: ['a', 'b'], _litro_csrf: 'tok' });
    const e = submit(form);
    expect(e.defaultPrevented).toBe(true);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(ACTION);
    // args = [input]; token field stripped, repeats collapsed to array
    const { deserializeValue } = await import('../serialize.js');
    expect(deserializeValue(init.body as string)).toEqual([{ name: 'Ada', tag: ['a', 'b'] }]);
  });

  it('dispatches litro:action-success with the result, bubbling and composed', async () => {
    detach = enhanceForms();
    fetchMock.mockResolvedValue(okResponse({ count: 7 }));
    const form = buildForm(ACTION, { name: 'Ada' });
    const events: CustomEvent[] = [];
    document.addEventListener('litro:action-success', (e) => events.push(e as CustomEvent));
    submit(form);
    await vi.waitFor(() => expect(events).toHaveLength(1));
    expect(events[0].detail).toEqual({ count: 7 });
    expect(events[0].composed).toBe(true);
  });

  it('dispatches litro:action-error with the LitroActionError', async () => {
    detach = enhanceForms();
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ name: 'LitroActionError', message: 'Action input validation failed', status: 400, issues: [{ message: 'Name is required' }] }),
        { status: 400, headers: { 'content-type': 'application/json' } },
      ),
    );
    const form = buildForm(ACTION, { name: '' });
    const events: CustomEvent[] = [];
    form.addEventListener('litro:action-error', (e) => events.push(e as CustomEvent));
    submit(form);
    await vi.waitFor(() => expect(events).toHaveLength(1));
    expect(events[0].detail).toBeInstanceOf(LitroActionError);
    expect((events[0].detail as LitroActionError).issues).toEqual([{ message: 'Name is required' }]);
  });

  it('ignores non-action forms', () => {
    detach = enhanceForms();
    const form = buildForm('/regular/endpoint', { name: 'x' });
    const e = submit(form);
    expect(e.defaultPrevented).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('attaches to a shadow root (submit is composed:false and never reaches document)', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });
    const form = document.createElement('form');
    form.setAttribute('action', ACTION);
    shadow.appendChild(form);

    const documentDetach = enhanceForms();
    const e1 = new Event('submit', { bubbles: true, cancelable: true });
    form.dispatchEvent(e1);
    expect(e1.defaultPrevented).toBe(false); // document listener cannot see it
    documentDetach();

    detach = enhanceForms(shadow);
    fetchMock.mockResolvedValue(okResponse('ok'));
    const e2 = new Event('submit', { bubbles: true, cancelable: true });
    form.dispatchEvent(e2);
    expect(e2.defaultPrevented).toBe(true);
  });

  it('the detach function removes the listener', () => {
    const off = enhanceForms();
    off();
    const form = buildForm(ACTION, { name: 'x' });
    const e = submit(form);
    expect(e.defaultPrevented).toBe(false);
  });
});
