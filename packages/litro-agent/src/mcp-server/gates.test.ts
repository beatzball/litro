/**
 * The gates, on their own, without a server.
 *
 * These are the checks that can be made without a socket: what the environment
 * resolves to, and which origin is allowed. The ones that need a real request —
 * a 403 on the wire, a 401, the CORS header that must never be `*` — are in
 * `./http.test.ts`, which drives a real HTTP server, because a function that
 * returns 403 is not proof that a route answers 403.
 */
import { describe, it, expect } from 'vitest';
import { AgentError } from '../errors.js';
import {
  LOCAL_ENV,
  isDevServer,
  ORIGINS_ENV,
  TOKEN_ENV,
  constantTimeEqual,
  isLocalOrigin,
  isOriginAllowed,
  parseOriginList,
  resolveGateConfig,
} from './gates.js';

describe('resolveGateConfig', () => {
  it('refuses to build an open route: no token and not local is a startup failure', () => {
    expect(() => resolveGateConfig({}, { local: false })).toThrowError(AgentError);
    try {
      resolveGateConfig({}, { local: false });
    } catch (err) {
      // The message has to name what to set. A reader who gets "not allowed"
      // and no variable name has to read this file to recover.
      expect((err as Error).message).toContain(TOKEN_ENV);
      expect((err as Error).message).toContain(`${LOCAL_ENV}=1`);
      expect((err as AgentError).status).toBe(500);
    }
  });

  it('accepts a non-local route once a token is set', () => {
    const config = resolveGateConfig({ [TOKEN_ENV]: 'secret' }, { local: false });
    expect(config).toEqual({ local: false, token: 'secret', allowedOrigins: [] });
  });

  it('accepts a local route with no token', () => {
    expect(resolveGateConfig({}, { local: true })).toEqual({
      local: true,
      token: undefined,
      allowedOrigins: [],
    });
  });

  it('reads all three variables from the environment', () => {
    expect(
      resolveGateConfig({
        [LOCAL_ENV]: 'false',
        [TOKEN_ENV]: 'secret',
        [ORIGINS_ENV]: 'https://a.example, https://b.example',
      }),
    ).toEqual({
      local: false,
      token: 'secret',
      allowedOrigins: ['https://a.example', 'https://b.example'],
    });
  });

  it('treats a whitespace-only token as unset, because a typo is not a secret', () => {
    expect(() => resolveGateConfig({ [TOKEN_ENV]: '   ' }, { local: false })).toThrowError(
      /is not set/,
    );
  });

  it('defaults to NOT local when nothing says otherwise', () => {
    // An empty environment is what a deployment that configured nothing has.
    // The default is the strict one, so that case is the startup failure above.
    expect(() => resolveGateConfig({})).toThrowError(/is not local/);
  });

  it('is local with no token under `litro dev`', () => {
    // The dev loop must not need a token. This is the case that regressed once:
    // `process.dev` alone said a Nitro 2.13 dev worker was a deployment, and
    // `litro dev` refused to start on a project that enabled the route.
    expect(resolveGateConfig({ LITRO_DEV: 'true' })).toEqual({
      local: true,
      token: undefined,
      allowedOrigins: [],
    });
  });

  it('lets an explicit option beat the environment', () => {
    const config = resolveGateConfig({ [LOCAL_ENV]: '0' }, { local: true });
    expect(config.local).toBe(true);
  });
});

describe('isDevServer', () => {
  it('reads the marker `litro dev` sets', () => {
    expect(isDevServer({ LITRO_DEV: 'true' })).toBe(true);
    // Only the exact value, matching what create-page-handler.ts reads.
    expect(isDevServer({ LITRO_DEV: '1' })).toBe(false);
  });

  it('reads a Nitro dev worker, for a project driven by `nitro dev`', () => {
    expect(isDevServer({ NITRO_DEV_WORKER_ID: '0' })).toBe(true);
  });

  it('is false for a build, where NODE_ENV is the only thing set', () => {
    // MEASURED on nitropack 2.13.4: a built server has NODE_ENV=production and
    // `process.dev === false`; a dev worker has neither. So NODE_ENV is not a
    // signal here — a deployment that never set it must not read as local.
    expect(isDevServer({ NODE_ENV: 'production' })).toBe(false);
    expect(isDevServer({})).toBe(false);
    expect(isDevServer({ NODE_ENV: 'development' })).toBe(false);
  });
});

describe('parseOriginList', () => {
  it('splits, trims, and drops empty entries', () => {
    expect(parseOriginList('https://a.example, https://b.example ,, ')).toEqual([
      'https://a.example',
      'https://b.example',
    ]);
  });

  it('is empty for undefined and for an empty string', () => {
    expect(parseOriginList(undefined)).toEqual([]);
    expect(parseOriginList('')).toEqual([]);
  });
});

describe('isLocalOrigin', () => {
  it('accepts the three spellings of localhost, on any port', () => {
    expect(isLocalOrigin('http://localhost:6274')).toBe(true);
    expect(isLocalOrigin('http://127.0.0.1:3000')).toBe(true);
    expect(isLocalOrigin('http://[::1]:3000')).toBe(true);
    expect(isLocalOrigin('https://localhost')).toBe(true);
  });

  it('rejects anything else, including a hostname that merely contains it', () => {
    expect(isLocalOrigin('https://evil.example')).toBe(false);
    // The trap a substring check would fall into.
    expect(isLocalOrigin('https://localhost.evil.example')).toBe(false);
    expect(isLocalOrigin('https://notlocalhost')).toBe(false);
  });

  it('rejects a scheme that is not http or https, and a value that is not a URL', () => {
    expect(isLocalOrigin('file://localhost')).toBe(false);
    expect(isLocalOrigin('null')).toBe(false);
    expect(isLocalOrigin('')).toBe(false);
  });
});

describe('isOriginAllowed', () => {
  const local = { local: true, allowedOrigins: [] };
  const deployed = { local: false, token: 'secret', allowedOrigins: [] };
  const listed = { local: false, token: 'secret', allowedOrigins: ['https://a.example'] };

  it('allows any localhost origin on a local route with no allowlist', () => {
    expect(isOriginAllowed('http://localhost:6274', local)).toBe(true);
    expect(isOriginAllowed('https://evil.example', local)).toBe(false);
  });

  it('allows NO origin on a deployed route with no allowlist', () => {
    // A deployed MCP route has no browser client unless someone said so, and
    // "it is localhost to me" is not something the server can check.
    expect(isOriginAllowed('http://localhost:6274', deployed)).toBe(false);
    expect(isOriginAllowed('https://a.example', deployed)).toBe(false);
  });

  it('honors an explicit allowlist and nothing outside it', () => {
    expect(isOriginAllowed('https://a.example', listed)).toBe(true);
    expect(isOriginAllowed('https://b.example', listed)).toBe(false);
    // The allowlist replaces the localhost default rather than adding to it.
    expect(isOriginAllowed('http://localhost:6274', { ...listed, local: true })).toBe(false);
  });
});

describe('constantTimeEqual', () => {
  it('is true for equal strings and false for anything else', () => {
    expect(constantTimeEqual('secret', 'secret')).toBe(true);
    expect(constantTimeEqual('secret', 'Secret')).toBe(false);
    expect(constantTimeEqual('secret', 'secret ')).toBe(false);
    expect(constantTimeEqual('', '')).toBe(true);
  });

  it('compares strings of different lengths without throwing', () => {
    // `timingSafeEqual` throws on unequal lengths, which is why both sides are
    // hashed first. A throw here would become a 500 instead of a 401.
    expect(constantTimeEqual('a', 'a-much-longer-token')).toBe(false);
  });
});
