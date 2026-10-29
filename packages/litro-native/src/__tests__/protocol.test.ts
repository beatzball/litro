/**
 * Protocol tests.
 *
 * These pin the wire format described in
 * design/specs/2026-10-29-litro-native-bridge-protocol.md. They exist before
 * either side of the bridge is implemented, which is the point: the native
 * shell and the page transport are both written against what passes here.
 *
 * A rule in the document with no test below is a rule neither implementer has
 * to honor. When the document changes, change these first.
 *
 * Run with: pnpm --filter @beatzball/litro-native test
 */

// @vitest-environment node

import { describe, expect, it } from 'vitest';
import {
  BRIDGE_PROTOCOL_VERSION,
  DEFAULT_TIMEOUT_MS,
  ERROR_CODES,
  GLOBAL_NAME,
  HANDLER_NAME,
  HANDSHAKE_TIMEOUT_MS,
  INTERACTIVE_METHODS,
  INTERACTIVE_TIMEOUT_MS,
  METHODS,
  MIN_SUPPORTED_SHELL_VERSION,
  capabilityFor,
  failure,
  isBridgeError,
  isBridgeRequest,
  isBridgeResponse,
  isCapabilityAvailable,
  isHandshakeResult,
  isMethod,
  isVersionSupported,
  request,
  success,
  timeoutFor,
  type Method,
} from '../protocol.js';
import type { Capability } from '../types.js';

const ALL: readonly Capability[] = ['haptics', 'notifications', 'badging', 'secureStorage', 'share', 'review'];

describe('version', () => {
  it('is an integer, because PlatformInfo.bridgeVersion is a number and must never be parsed', () => {
    expect(Number.isInteger(BRIDGE_PROTOCOL_VERSION)).toBe(true);
    expect(Number.isInteger(MIN_SUPPORTED_SHELL_VERSION)).toBe(true);
  });

  it('cannot require a shell newer than the one this package speaks', () => {
    // A floor above our own version would reject every shell, including ours.
    expect(MIN_SUPPORTED_SHELL_VERSION).toBeLessThanOrEqual(BRIDGE_PROTOCOL_VERSION);
  });

  it('accepts a shell NEWER than this page', () => {
    // An installed app updates on its own schedule and may run ahead of the
    // deployed page. Rejecting it would break working apps on deploy.
    expect(isVersionSupported(BRIDGE_PROTOCOL_VERSION + 5)).toBe(true);
  });

  it('rejects a shell below the floor', () => {
    expect(isVersionSupported(MIN_SUPPORTED_SHELL_VERSION - 1)).toBe(false);
  });

  it('rejects a version that is not an integer', () => {
    for (const bad of [1.5, NaN, Infinity]) expect(isVersionSupported(bad)).toBe(false);
  });
});

describe('transport names', () => {
  it('are non-empty and valid JavaScript identifiers, since the shell injects one as a global', () => {
    for (const name of [HANDLER_NAME, GLOBAL_NAME]) {
      expect(name).not.toBe('');
      expect(name).toMatch(/^[A-Za-z_$][A-Za-z0-9_$]*$/);
    }
  });

  it('differ, so the handler and the global cannot be confused for one another', () => {
    expect(HANDLER_NAME).not.toBe(GLOBAL_NAME);
  });
});

describe('methods', () => {
  it('are unique', () => {
    expect(new Set(METHODS).size).toBe(METHODS.length);
  });

  it('cover every operation on the NativeBridge contract', () => {
    // Written out rather than derived, so that adding a method to the contract
    // without adding it here fails instead of silently passing.
    expect([...METHODS].sort()).toEqual(
      [
        'handshake',
        'haptics.impact',
        'haptics.notify',
        'haptics.selection',
        'notifications.schedule',
        'notifications.cancel',
        'badging.set',
        'badging.clear',
        'secureStorage.get',
        'secureStorage.set',
        'secureStorage.remove',
        'canShare',
        'share',
        'requestReview',
      ].sort(),
    );
  });

  it('recognizes its own names and nothing else', () => {
    for (const m of METHODS) expect(isMethod(m)).toBe(true);
    for (const bad of ['', 'haptics', 'Haptics.impact', 'haptics.impact ', null, 7, {}]) {
      expect(isMethod(bad)).toBe(false);
    }
  });

  it('maps every method to a capability, or to none for the handshake', () => {
    for (const m of METHODS) {
      const cap = capabilityFor(m);
      if (m === 'handshake') expect(cap).toBeNull();
      else expect(ALL).toContain(cap);
    }
  });
});

describe('capability gating', () => {
  it('lets the handshake through even when the shell reports nothing', () => {
    expect(isCapabilityAvailable('handshake', [])).toBe(true);
  });

  it('blocks a method whose capability the shell did not compile in', () => {
    expect(isCapabilityAvailable('haptics.impact', ['badging'])).toBe(false);
  });

  it('allows every method when every capability is present', () => {
    for (const m of METHODS) expect(isCapabilityAvailable(m, ALL)).toBe(true);
  });

  it('gates share and canShare together, since one answers for the other', () => {
    expect(isCapabilityAvailable('share', ['share'])).toBe(true);
    expect(isCapabilityAvailable('canShare', ['share'])).toBe(true);
    expect(isCapabilityAvailable('share', [])).toBe(false);
    expect(isCapabilityAvailable('canShare', [])).toBe(false);
  });

  it('has NO error code for an unavailable capability', () => {
    // The contract says a capability call never throws for a missing platform
    // feature. A code for it would invite a shell that breaks that promise;
    // the page must answer such a call itself instead of sending it.
    const names = Object.keys(ERROR_CODES).join(' ').toLowerCase();
    expect(names).not.toContain('unsupported_capability');
    expect(names).not.toContain('capability');
  });
});

describe('timeouts', () => {
  it('gives the handshake the shortest budget, because startup queues behind it', () => {
    expect(HANDSHAKE_TIMEOUT_MS).toBeLessThan(DEFAULT_TIMEOUT_MS);
    expect(timeoutFor('handshake')).toBe(HANDSHAKE_TIMEOUT_MS);
  });

  it('gives calls that wait on a person the longest budget', () => {
    expect(INTERACTIVE_TIMEOUT_MS).toBeGreaterThan(DEFAULT_TIMEOUT_MS);
    for (const m of INTERACTIVE_METHODS) expect(timeoutFor(m)).toBe(INTERACTIVE_TIMEOUT_MS);
  });

  it('gives every other method the default', () => {
    for (const m of METHODS) {
      if (m === 'handshake' || INTERACTIVE_METHODS.includes(m)) continue;
      expect(timeoutFor(m)).toBe(DEFAULT_TIMEOUT_MS);
    }
  });

  it('never returns zero or a negative budget, which would fail every call at once', () => {
    for (const m of METHODS) expect(timeoutFor(m)).toBeGreaterThan(0);
  });

  it('treats canShare as a plain call, not an interactive one', () => {
    // canShare only asks whether a payload is shareable. It opens no sheet, so
    // a user-sized budget would hide a dropped message for two minutes.
    expect(timeoutFor('canShare')).toBe(DEFAULT_TIMEOUT_MS);
  });
});

describe('error codes', () => {
  it('are unique', () => {
    const codes = Object.values(ERROR_CODES);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('keeps the three reserved JSON-RPC codes at their specified values', () => {
    expect(ERROR_CODES.PARSE_ERROR).toBe(-32700);
    expect(ERROR_CODES.INVALID_REQUEST).toBe(-32600);
    expect(ERROR_CODES.METHOD_NOT_FOUND).toBe(-32601);
    expect(ERROR_CODES.INVALID_PARAMS).toBe(-32602);
    expect(ERROR_CODES.INTERNAL_ERROR).toBe(-32603);
  });

  it('puts every code of our own in the range JSON-RPC reserves for implementations', () => {
    for (const [name, code] of Object.entries(ERROR_CODES)) {
      if (code <= -32600) continue; // the reserved ones, checked above
      expect(code, `${name} must sit in -32000..-32099`).toBeGreaterThanOrEqual(-32099);
      expect(code, `${name} must sit in -32000..-32099`).toBeLessThanOrEqual(-32000);
    }
  });
});

describe('request construction and validation', () => {
  it('builds a request that its own validator accepts', () => {
    expect(isBridgeRequest(request('1', 'haptics.impact', { style: 'light' }))).toBe(true);
  });

  it('omits params entirely rather than sending undefined', () => {
    // `JSON.stringify` drops an undefined value, so a key present with
    // undefined and a key absent are the same on the wire. Keeping them the
    // same in memory means a test can compare exact objects.
    const req = request('1', 'requestReview');
    expect('params' in req).toBe(false);
  });

  it('accepts a request with no params', () => {
    expect(isBridgeRequest({ jsonrpc: '2.0', id: 'a', method: 'requestReview' })).toBe(true);
  });

  it.each([
    ['a missing jsonrpc tag', { id: 'a', method: 'requestReview' }],
    ['the wrong jsonrpc version', { jsonrpc: '1.0', id: 'a', method: 'requestReview' }],
    ['a numeric id', { jsonrpc: '2.0', id: 1, method: 'requestReview' }],
    ['an empty id', { jsonrpc: '2.0', id: '', method: 'requestReview' }],
    ['a missing id', { jsonrpc: '2.0', method: 'requestReview' }],
    ['an unknown method', { jsonrpc: '2.0', id: 'a', method: 'camera.capture' }],
    ['positional params', { jsonrpc: '2.0', id: 'a', method: 'share', params: ['x'] }],
    ['null params', { jsonrpc: '2.0', id: 'a', method: 'share', params: null }],
    ['a top-level array', [{ jsonrpc: '2.0', id: 'a', method: 'share' }]],
    ['null', null],
    ['a string', 'haptics.impact'],
  ])('rejects %s', (_label, value) => {
    expect(isBridgeRequest(value)).toBe(false);
  });

  it('rejects a batch, because this protocol has no batching', () => {
    const batch = [request('1', 'badging.clear'), request('2', 'requestReview')];
    expect(isBridgeRequest(batch)).toBe(false);
  });

  it('requires an id on every request, so no call can fail invisibly', () => {
    for (const m of METHODS) expect(request('x', m).id).toBe('x');
  });
});

describe('response validation', () => {
  it('accepts a success', () => {
    expect(isBridgeResponse(success('1', null))).toBe(true);
  });

  it('accepts a success whose result is undefined-like but present', () => {
    expect(isBridgeResponse({ jsonrpc: '2.0', id: '1', result: null })).toBe(true);
    expect(isBridgeResponse({ jsonrpc: '2.0', id: '1', result: false })).toBe(true);
    expect(isBridgeResponse({ jsonrpc: '2.0', id: '1', result: 0 })).toBe(true);
    expect(isBridgeResponse({ jsonrpc: '2.0', id: '1', result: '' })).toBe(true);
  });

  it('accepts a failure', () => {
    expect(isBridgeResponse(failure('1', ERROR_CODES.INTERNAL_ERROR, 'no'))).toBe(true);
  });

  it('rejects a reply carrying BOTH a result and an error', () => {
    // Ambiguous about whether the work happened.
    expect(isBridgeResponse({ jsonrpc: '2.0', id: '1', result: 1, error: { code: -32000, message: 'x' } })).toBe(false);
  });

  it('rejects a reply carrying NEITHER', () => {
    expect(isBridgeResponse({ jsonrpc: '2.0', id: '1' })).toBe(false);
  });

  it('rejects a failure whose error object is malformed', () => {
    for (const bad of [{ message: 'x' }, { code: 'x', message: 'y' }, { code: -1.5, message: 'y' }, { code: -1 }, null]) {
      expect(isBridgeResponse({ jsonrpc: '2.0', id: '1', error: bad })).toBe(false);
    }
  });

  it('validates an error object on its own', () => {
    expect(isBridgeError({ code: -32000, message: 'denied' })).toBe(true);
    expect(isBridgeError({ code: -32000, message: 'denied', data: { any: 'thing' } })).toBe(true);
    expect(isBridgeError({ code: -32000 })).toBe(false);
  });

  it('omits data entirely when none is given', () => {
    expect('data' in failure('1', -32000, 'x').error).toBe(false);
  });
});

describe('handshake result', () => {
  const ok = { version: BRIDGE_PROTOCOL_VERSION, os: 'ios' as const, capabilities: ALL };

  it('accepts a complete result', () => {
    expect(isHandshakeResult(ok)).toBe(true);
  });

  it('accepts a shell that compiled in nothing', () => {
    // Legal, and it means the page answers every capability call itself.
    expect(isHandshakeResult({ ...ok, capabilities: [] })).toBe(true);
  });

  it('accepts the optional version strings, and their absence', () => {
    expect(isHandshakeResult({ ...ok, appVersion: '1.2.0', osVersion: '19.0' })).toBe(true);
    expect(isHandshakeResult(ok)).toBe(true);
  });

  it.each([
    ['a missing version', { os: 'ios', capabilities: [] }],
    ['a non-integer version', { version: 1.5, os: 'ios', capabilities: [] }],
    ['an unknown os', { version: 1, os: 'windows', capabilities: [] }],
    ['capabilities that are not an array', { version: 1, os: 'ios', capabilities: 'all' }],
    ['an unknown capability', { version: 1, os: 'ios', capabilities: ['camera'] }],
    ['a numeric appVersion', { version: 1, os: 'ios', capabilities: [], appVersion: 2 }],
    ['null', null],
  ])('rejects %s', (_label, value) => {
    expect(isHandshakeResult(value)).toBe(false);
  });
});

/**
 * One end-to-end pass over the format, driven by a fake shell.
 *
 * This is not a transport test — there is no transport yet. It proves the
 * pieces above compose: a request this module builds validates, a reply the
 * fake shell builds validates, and the ids line up.
 */
describe('a full exchange against a fake shell', () => {
  /** A shell that compiled in only haptics and badging. */
  function fakeShell(capabilities: readonly Capability[]) {
    return (raw: unknown) => {
      if (!isBridgeRequest(raw)) {
        return failure('0', ERROR_CODES.INVALID_REQUEST, 'not a request');
      }
      if (raw.method === 'handshake') {
        return success(raw.id, { version: BRIDGE_PROTOCOL_VERSION, os: 'ios', capabilities });
      }
      if (!isCapabilityAvailable(raw.method, capabilities)) {
        // The page should never have sent this. If it does, the shell says so
        // plainly rather than inventing a capability error code.
        return failure(raw.id, ERROR_CODES.METHOD_NOT_FOUND, `not compiled in: ${raw.method}`);
      }
      return success(raw.id, null);
    };
  }

  it('completes a handshake and reports what the shell has', () => {
    const shell = fakeShell(['haptics', 'badging']);
    const res = shell(request('h1', 'handshake'));
    expect(isBridgeResponse(res)).toBe(true);
    expect('result' in res).toBe(true);
    const result = (res as { result: unknown }).result;
    expect(isHandshakeResult(result)).toBe(true);
    expect(isVersionSupported((result as { version: number }).version)).toBe(true);
    expect((result as { capabilities: Capability[] }).capabilities).toEqual(['haptics', 'badging']);
  });

  it('answers a supported call, with the id echoed back', () => {
    const shell = fakeShell(['haptics', 'badging']);
    const res = shell(request('r7', 'haptics.impact', { style: 'light' }));
    expect(res.id).toBe('r7');
    expect(isBridgeResponse(res)).toBe(true);
    expect('result' in res).toBe(true);
  });

  it('never sends a call the handshake said is unavailable', () => {
    const capabilities: readonly Capability[] = ['haptics', 'badging'];
    const method: Method = 'secureStorage.get';
    // This is the page's own rule, and it is what keeps the contract's "a
    // capability call never throws" promise true.
    expect(isCapabilityAvailable(method, capabilities)).toBe(false);
  });

  it('rejects a malformed message without crashing', () => {
    const shell = fakeShell(ALL);
    const res = shell({ jsonrpc: '2.0', id: 'x', method: 'camera.capture' });
    expect(isBridgeResponse(res)).toBe(true);
    expect('error' in res).toBe(true);
    expect((res as { error: { code: number } }).error.code).toBe(ERROR_CODES.INVALID_REQUEST);
  });

  it('survives a round trip through JSON, which is what the transport does', () => {
    const shell = fakeShell(ALL);
    const sent = request('j1', 'notifications.schedule', { title: 'Hi', at: 1_700_000_000_000 });
    const received = JSON.parse(JSON.stringify(sent));
    expect(received).toEqual(sent);
    const res = JSON.parse(JSON.stringify(shell(received)));
    expect(isBridgeResponse(res)).toBe(true);
    expect(res.id).toBe('j1');
  });
});
