/**
 * @vitest-environment jsdom
 *
 * The parts of the bridge a REAL host exercised and our own fake host did not.
 *
 * Every case here exists because something outside this repo disagreed with us:
 * an Inspector run rejected the handshake outright, four independent reviewers
 * found the fill step was an injection sink, and the spec text settled the rest.
 * `bridge.test.ts` covers the happy path; this file covers what we got wrong.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BRIDGE_SOURCE, DENIED_PROPERTIES, MCP_UI_PROTOCOL_VERSION } from './bridge.js';

interface RpcMessage {
  jsonrpc?: string;
  id?: number;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
}

let sent: RpcMessage[] = [];
let fakeParent: { postMessage: (msg: RpcMessage) => void };
let listeners: EventListener[] = [];

function fromHost(data: unknown): void {
  const evt = new MessageEvent('message', { data });
  Object.defineProperty(evt, 'source', { value: fakeParent });
  window.dispatchEvent(evt);
}

const flush = () => new Promise((r) => setTimeout(r, 0));

function boot(appMeta?: Record<string, unknown>) {
  sent = [];
  listeners = [];
  fakeParent = { postMessage: (msg) => sent.push(msg) };
  Object.defineProperty(window, 'parent', { value: fakeParent, configurable: true });

  document.body.innerHTML = '<weather-card></weather-card>';
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('data-display-mode');
  delete (window as unknown as Record<string, unknown>).litroMcpApply;
  (window as unknown as Record<string, unknown>).__litroMcpApp = appMeta;

  const realAdd = window.addEventListener.bind(window);
  window.addEventListener = ((type: string, fn: EventListener, opts?: unknown) => {
    if (type === 'message') listeners.push(fn);
    return realAdd(type, fn, opts as never);
  }) as typeof window.addEventListener;

  new Function(BRIDGE_SOURCE)();

  window.addEventListener = realAdd;
}

beforeEach(() => boot());
afterEach(() => {
  for (const fn of listeners) window.removeEventListener('message', fn);
});

describe('the ui/initialize params a real host validates', () => {
  // Inspector V2 answered our original request with:
  //   -32602 Invalid params for ui/initialize: appInfo: Invalid input,
  //   appCapabilities: Invalid input, protocolVersion: Invalid input
  // Three required fields, not one. The handshake failed, so our `initialized`
  // never fired — and the spec says the host MUST NOT send anything before it.
  // The card only rendered because Inspector injects a compatibility shim that
  // did the handshake on our behalf. A strict host would show the empty shell
  // forever.
  it('sends protocolVersion, appInfo, clientInfo and appCapabilities', () => {
    const params = sent[0].params as Record<string, Record<string, unknown>>;

    expect(sent[0].method).toBe('ui/initialize');
    expect(params.protocolVersion).toBe(MCP_UI_PROTOCOL_VERSION);
    expect(params.appInfo).toEqual({ name: 'litro-mcp-app', version: '0.0.0' });
    // The spec's own example names this `clientInfo` while the reference host
    // validates for `appInfo`. Both are sent; it costs one line.
    expect(params.clientInfo).toEqual(params.appInfo);
    // "View MUST declare all display modes it supports in
    // appCapabilities.availableDisplayModes during initialization." (spec:781)
    expect(params.appCapabilities.availableDisplayModes).toEqual(['inline']);
  });

  it('never sends the bare "capabilities" key that was rejected', () => {
    expect(sent[0].params).not.toHaveProperty('capabilities');
  });

  it('takes name, version and display modes from the document', () => {
    boot({ name: 'weather-card', version: '2.1.0', displayModes: ['inline', 'fullscreen'] });
    const params = sent[0].params as Record<string, Record<string, unknown>>;

    expect(params.appInfo).toEqual({ name: 'weather-card', version: '2.1.0' });
    expect(params.appCapabilities.availableDisplayModes).toEqual(['inline', 'fullscreen']);
  });
});

describe('the fill step refuses scripting sinks', () => {
  // `structuredContent` is server JSON, and tool results routinely carry
  // third-party text. `Object.assign(el, data)` — the original default — sets
  // `innerHTML`, which parses HTML. The host's own default CSP is
  // `script-src 'self' 'unsafe-inline'`, which permits inline event handlers,
  // so the injected code runs. It then holds `window.litroMcp.callTool` and can
  // drive the MCP server through the host.
  it('does not let structuredContent set innerHTML', () => {
    fromHost({
      jsonrpc: '2.0',
      method: 'ui/notifications/tool-result',
      params: { structuredContent: { innerHTML: '<img src=x onerror="BOOM">' } },
    });

    const el = document.body.firstElementChild as HTMLElement;
    expect(el.innerHTML).toBe('');
    expect(el.querySelector('img')).toBeNull();
  });

  it.each(['outerHTML', 'srcdoc', 'src', 'href', 'style', 'onclick', 'onerror', 'formaction'])(
    'refuses %s',
    (key) => {
      const before = document.body.innerHTML;
      fromHost({
        jsonrpc: '2.0',
        method: 'ui/notifications/tool-result',
        params: { structuredContent: { [key]: 'x' } },
      });
      expect(document.body.innerHTML).toBe(before);
    },
  );

  it('refuses every name in DENIED_PROPERTIES and anything starting with on', () => {
    expect(DENIED_PROPERTIES).toContain('innerHTML');
    expect(DENIED_PROPERTIES).toContain('srcdoc');
    expect(DENIED_PROPERTIES).toContain('__proto__');
  });

  it('still applies ordinary data properties alongside a refused one', () => {
    fromHost({
      jsonrpc: '2.0',
      method: 'ui/notifications/tool-result',
      params: { structuredContent: { city: 'Doha', tempC: 38, innerHTML: '<b>no</b>' } },
    });

    const el = document.body.firstElementChild as unknown as { city: string; tempC: number };
    expect(el.city).toBe('Doha');
    expect(el.tempC).toBe(38);
    expect((document.body.firstElementChild as HTMLElement).innerHTML).toBe('');
  });

  it('tells the host what it refused instead of dropping it silently', () => {
    fromHost({
      jsonrpc: '2.0',
      method: 'ui/notifications/tool-result',
      params: { structuredContent: { innerHTML: 'x' } },
    });

    const log = sent.find((m) => m.method === 'notifications/message');
    expect(log?.params?.level).toBe('warning');
    expect(String(log?.params?.data)).toContain('innerHTML');
  });
});

describe('the rest of the lifecycle', () => {
  it('does NOT answer a ping with no id, because that is a notification', () => {
    // A JSON-RPC request without an id is a notification; responding to one is
    // a protocol violation, and we were replying with `id: undefined`.
    const before = sent.length;
    fromHost({ jsonrpc: '2.0', method: 'ping' });
    expect(sent).toHaveLength(before);
  });

  it('answers ui/resource-teardown, which the host waits on before tearing down', () => {
    fromHost({ jsonrpc: '2.0', id: 7, method: 'ui/resource-teardown', params: { reason: 'closed' } });
    expect(sent.at(-1)).toEqual({ jsonrpc: '2.0', id: 7, result: {} });
  });

  it('reports its size once the handshake completes', async () => {
    // Inspector sent flexible containerDimensions and, getting no size from us,
    // fell back to a fixed 400px for 112px of content.
    fromHost({ jsonrpc: '2.0', id: sent[0].id, result: {} });
    await flush();

    const size = sent.find((m) => m.method === 'ui/notifications/size-changed');
    expect(size).toBeDefined();
    expect(typeof size?.params?.width).toBe('number');
    expect(typeof size?.params?.height).toBe('number');
  });

  it('applies a later host-context-changed', () => {
    fromHost({
      jsonrpc: '2.0',
      method: 'ui/notifications/host-context-changed',
      params: { hostContext: { theme: 'light', displayMode: 'fullscreen' } },
    });

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.documentElement.getAttribute('data-display-mode')).toBe('fullscreen');
  });

  it('survives a response whose id is a prototype key', () => {
    // `pending` is a null-prototype object for this reason: a lookup of
    // "__proto__" on a plain object returns an inherited member, and the
    // handler would throw rather than ignore the message.
    expect(() => fromHost({ jsonrpc: '2.0', id: '__proto__', result: {} })).not.toThrow();
    expect(() => fromHost({ jsonrpc: '2.0', id: 'constructor', result: {} })).not.toThrow();
  });
});
