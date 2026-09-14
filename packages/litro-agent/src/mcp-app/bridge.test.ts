/**
 * @vitest-environment jsdom
 *
 * The bridge ships as a source string, so tsc never type-checks it. These tests
 * are what pays that back: they evaluate the EXACT string that gets inlined and
 * drive it through a fake host, so the protocol is exercised, not described.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BRIDGE_SOURCE, DEFAULT_REQUEST_TIMEOUT_MS } from './bridge.js';

interface RpcMessage {
  jsonrpc?: string;
  id?: number;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: unknown;
}

let sent: RpcMessage[] = [];
let fakeParent: { postMessage: (msg: RpcMessage) => void };
let listeners: EventListener[] = [];

/** Delivers a message as if the host frame sent it. */
function fromHost(data: unknown, source: unknown = fakeParent): void {
  const evt = new MessageEvent('message', { data });
  Object.defineProperty(evt, 'source', { value: source });
  window.dispatchEvent(evt);
}

/** Lets every already-queued promise callback run. */
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  sent = [];
  listeners = [];
  fakeParent = { postMessage: (msg) => sent.push(msg) };
  Object.defineProperty(window, 'parent', { value: fakeParent, configurable: true });

  document.body.innerHTML = '<weather-card></weather-card>';
  document.documentElement.removeAttribute('data-theme');
  delete (window as unknown as Record<string, unknown>).litroMcpApply;

  // Each evaluation registers its own listener on window. Capture them so the
  // next test starts with exactly one live bridge and not a pile of them.
  const realAdd = window.addEventListener.bind(window);
  window.addEventListener = ((type: string, fn: EventListener, opts?: unknown) => {
    if (type === 'message') listeners.push(fn);
    return realAdd(type, fn, opts as never);
  }) as typeof window.addEventListener;

  new Function(BRIDGE_SOURCE)();

  window.addEventListener = realAdd;
});

afterEach(() => {
  for (const fn of listeners) window.removeEventListener('message', fn);
});

describe('the handshake', () => {
  it('opens with ui/initialize as JSON-RPC 2.0', () => {
    expect(sent).toHaveLength(1);
    expect(sent[0].jsonrpc).toBe('2.0');
    expect(sent[0].method).toBe('ui/initialize');
    expect(typeof sent[0].id).toBe('number');
  });

  it('applies hostContext and confirms with ui/notifications/initialized', async () => {
    fromHost({ jsonrpc: '2.0', id: sent[0].id, result: { hostContext: { theme: 'dark', locale: 'en-GB' } } });
    await flush();

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.getAttribute('lang')).toBe('en-GB');
    expect(sent.map((m) => m.method)).toContain('ui/notifications/initialized');
  });

  it('survives a host that refuses the handshake, leaving the shell on screen', async () => {
    fromHost({ jsonrpc: '2.0', id: sent[0].id, error: { code: -32601, message: 'no' } });
    await flush();

    // No throw, no unhandled rejection, and the server-rendered shell stands.
    expect(document.body.firstElementChild?.tagName).toBe('WEATHER-CARD');
  });

  it('answers ping with the same id', () => {
    fromHost({ jsonrpc: '2.0', id: 99, method: 'ping' });
    expect(sent.at(-1)).toEqual({ jsonrpc: '2.0', id: 99, result: {} });
  });
});

describe('data arriving after the handshake', () => {
  it('fills the shell from structuredContent on tool-result', () => {
    fromHost({
      jsonrpc: '2.0',
      method: 'ui/notifications/tool-result',
      params: { structuredContent: { city: 'Doha', tempC: 38 } },
    });

    const el = document.body.firstElementChild as unknown as { city: string; tempC: number };
    expect(el.city).toBe('Doha');
    expect(el.tempC).toBe(38);
  });

  it('sets the arguments on tool-input, before any result exists', () => {
    fromHost({
      jsonrpc: '2.0',
      method: 'ui/notifications/tool-input',
      params: { arguments: { city: 'Doha' } },
    });

    const el = document.body.firstElementChild as unknown as { toolInput: { city: string } };
    expect(el.toolInput).toEqual({ city: 'Doha' });
  });

  it('prefers a custom window.litroMcpApply when one is installed', () => {
    const seen: unknown[] = [];
    (window as unknown as Record<string, unknown>).litroMcpApply = (el: Element, data: unknown) => {
      seen.push([el.tagName, data]);
    };

    fromHost({
      jsonrpc: '2.0',
      method: 'ui/notifications/tool-result',
      params: { structuredContent: { tempC: 38 } },
    });

    expect(seen).toEqual([['WEATHER-CARD', { tempC: 38 }]]);
    // The default Object.assign must NOT also run.
    expect((document.body.firstElementChild as unknown as { tempC?: number }).tempC).toBeUndefined();
  });

  it('finds the shell past the lit-part comment that real SSR output begins with', () => {
    // What the packager actually emits starts with a marker comment, not the
    // element — `<!--lit-part ...--><weather-card>`. firstElementChild must skip
    // it, and this is the shape the document really has.
    document.body.innerHTML = '<!--lit-part 5geuK0TrhQM=--><weather-card></weather-card><!--/lit-part-->';

    fromHost({
      jsonrpc: '2.0',
      method: 'ui/notifications/tool-result',
      params: { structuredContent: { tempC: 38 } },
    });

    const el = document.body.firstElementChild as unknown as { tempC: number };
    expect(el.tempC).toBe(38);
  });

  it('finds the shell in FAST output, which opens with the element itself', () => {
    // FAST emits declarative shadow DOM with no marker comment, so the element
    // is first. Both adapters must land on the same node.
    document.body.innerHTML =
      '<forecast-card><template shadowrootmode="open"><p>Loading…</p></template></forecast-card>';

    fromHost({
      jsonrpc: '2.0',
      method: 'ui/notifications/tool-result',
      params: { structuredContent: { tempC: 38 } },
    });

    const el = document.body.firstElementChild as unknown as { tempC: number };
    expect(el.tempC).toBe(38);
  });

  it('ignores a result that carries no structuredContent', () => {
    expect(() =>
      fromHost({ jsonrpc: '2.0', method: 'ui/notifications/tool-result', params: {} }),
    ).not.toThrow();
  });
});

describe('what it refuses', () => {
  it('ignores a message from anything that is not the host frame', () => {
    fromHost(
      {
        jsonrpc: '2.0',
        method: 'ui/notifications/tool-result',
        params: { structuredContent: { tempC: 999 } },
      },
      { postMessage() {} },
    );

    expect((document.body.firstElementChild as unknown as { tempC?: number }).tempC).toBeUndefined();
  });

  it('ignores traffic that is not JSON-RPC 2.0', () => {
    fromHost({ method: 'ui/notifications/tool-result', params: { structuredContent: { tempC: 999 } } });
    fromHost(null);
    expect((document.body.firstElementChild as unknown as { tempC?: number }).tempC).toBeUndefined();
  });

  it('ignores a response whose id it never sent', () => {
    expect(() => fromHost({ jsonrpc: '2.0', id: 4242, result: {} })).not.toThrow();
  });
});

describe('calling back into the server', () => {
  it('exposes callTool as a tools/call request', () => {
    const api = (window as unknown as { litroMcp: { callTool(n: string, a?: unknown): Promise<unknown> } })
      .litroMcp;
    void api.callTool('refresh', { city: 'Doha' });

    expect(sent.at(-1)?.method).toBe('tools/call');
    expect(sent.at(-1)?.params).toEqual({ name: 'refresh', arguments: { city: 'Doha' } });
  });

  it('resolves callTool when the host answers', async () => {
    const api = (window as unknown as { litroMcp: { callTool(n: string): Promise<unknown> } }).litroMcp;
    const promise = api.callTool('refresh');
    const id = sent.at(-1)?.id;

    fromHost({ jsonrpc: '2.0', id, result: { structuredContent: { tempC: 21 } } });
    await expect(promise).resolves.toEqual({ structuredContent: { tempC: 21 } });
  });
});

describe('a host that never answers', () => {
  type Api = {
    callTool(n: string, a?: unknown, o?: { timeoutMs?: number }): Promise<unknown>;
    readResource(u: string, o?: { timeoutMs?: number }): Promise<unknown>;
  };
  const api = () => (window as unknown as { litroMcp: Api }).litroMcp;

  // The bridge is evaluated in beforeEach, before these fake timers exist. That
  // is fine: request() calls setTimeout when a call is MADE, and every call
  // below is made after useFakeTimers.
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('rejects callTool after the default timeout, naming the method', async () => {
    const promise = api().callTool('refresh');
    const outcome = promise.then(
      () => 'resolved',
      (err: Error) => err,
    );

    await vi.advanceTimersByTimeAsync(DEFAULT_REQUEST_TIMEOUT_MS - 1);
    let settled = false;
    void outcome.then(() => (settled = true));
    await Promise.resolve();
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    const err = await outcome;
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toMatch(/timed out/);
    expect((err as Error).message).toContain('tools/call');
    expect((err as Error).message).toContain(String(DEFAULT_REQUEST_TIMEOUT_MS));
  });

  it('rejects readResource the same way', async () => {
    const outcome = api()
      .readResource('ui://x/y')
      .catch((err: Error) => err);
    await vi.advanceTimersByTimeAsync(DEFAULT_REQUEST_TIMEOUT_MS);
    const err = await outcome;
    expect((err as Error).message).toMatch(/timed out/);
    expect((err as Error).message).toContain('resources/read');
  });

  it('ignores an answer that arrives after the timeout', async () => {
    const outcome = api()
      .callTool('refresh')
      .then(
        (r) => ({ resolved: r }),
        (e: Error) => ({ rejected: e.message }),
      );
    const id = sent.at(-1)?.id;
    await vi.advanceTimersByTimeAsync(DEFAULT_REQUEST_TIMEOUT_MS);

    // The slot is gone, so this is a response to an id the bridge no longer
    // holds: no throw, and the promise keeps the rejection it already has.
    expect(() => fromHost({ jsonrpc: '2.0', id, result: { late: true } })).not.toThrow();
    expect(await outcome).toEqual({ rejected: expect.stringMatching(/timed out/) });
  });

  it('does not reject a call the host answered in time', async () => {
    const promise = api().callTool('refresh');
    const id = sent.at(-1)?.id;
    fromHost({ jsonrpc: '2.0', id, result: { ok: true } });
    await expect(promise).resolves.toEqual({ ok: true });

    // The timer was cleared, so running past the deadline changes nothing.
    await vi.advanceTimersByTimeAsync(DEFAULT_REQUEST_TIMEOUT_MS * 2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('takes a per-call timeoutMs for a tool that is slow on purpose', async () => {
    const outcome = api()
      .callTool('slow', { n: 1 }, { timeoutMs: DEFAULT_REQUEST_TIMEOUT_MS * 4 })
      .then(
        () => 'resolved',
        (e: Error) => e.message,
      );
    expect(sent.at(-1)?.params).toEqual({ name: 'slow', arguments: { n: 1 } });

    let settled = false;
    void outcome.then(() => (settled = true));
    await vi.advanceTimersByTimeAsync(DEFAULT_REQUEST_TIMEOUT_MS * 2);
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(DEFAULT_REQUEST_TIMEOUT_MS * 2);
    expect(await outcome).toMatch(/timed out after 120000ms/);
  });

  it('waits forever when timeoutMs is 0', async () => {
    const promise = api().callTool('slow', {}, { timeoutMs: 0 });
    const id = sent.at(-1)?.id;
    await vi.advanceTimersByTimeAsync(DEFAULT_REQUEST_TIMEOUT_MS * 100);
    fromHost({ jsonrpc: '2.0', id, result: { eventually: true } });
    await expect(promise).resolves.toEqual({ eventually: true });
  });

  it('does not time out the handshake, so a slow host still completes it', async () => {
    // The handshake was sent in beforeEach under real timers, so re-run the
    // bridge under fake ones to put ITS request on the fake clock.
    for (const fn of listeners) window.removeEventListener('message', fn);
    sent = [];
    const realAdd = window.addEventListener.bind(window);
    window.addEventListener = ((type: string, fn: EventListener, opts?: unknown) => {
      if (type === 'message') listeners.push(fn);
      return realAdd(type, fn, opts as never);
    }) as typeof window.addEventListener;
    new Function(BRIDGE_SOURCE)();
    window.addEventListener = realAdd;

    const init = sent[0];
    expect(init.method).toBe('ui/initialize');
    await vi.advanceTimersByTimeAsync(DEFAULT_REQUEST_TIMEOUT_MS * 10);

    fromHost({ jsonrpc: '2.0', id: init.id, result: { hostContext: { theme: 'dark' } } });
    await vi.advanceTimersByTimeAsync(0);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(sent.map((m) => m.method)).toContain('ui/notifications/initialized');
  });
});
