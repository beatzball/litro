/**
 * The gates in front of the Streamable HTTP route — decision 3 of
 * `design/specs/2026-09-24-mcp-server.md`, and nothing more than decision 3.
 *
 * The MCP specification makes authorization OPTIONAL, and then requires three
 * things of any Streamable HTTP server whether it authorizes or not: validate
 * `Origin` and answer 403 when it is present and invalid, bind only to
 * localhost when running locally, and implement proper authentication. This
 * file is the first and the third; the second is Nitro's, and the route's job
 * there is only not to undo it.
 *
 * WHY THIS IS NOT `checkGates` FROM `../runtime/handler.ts`
 *
 * The agent route's gate stack requires `x-litro-agent: 1` on every POST and
 * requires `Origin` to equal `Host`. No MCP host sends that header, and a
 * browser-based inspector's `Origin` is its own — so reusing those gates would
 * answer 403 to every `tools/call`. Two gate stacks, two threat models: the
 * agent route is called by a page in the same site, and this route is called by
 * a host that is not a browser at all.
 *
 * NOT OAUTH. The OAuth 2.1 profile is phase 6 and only if someone asks. A
 * static bearer token is what hosts can already send, and it costs the reader
 * one line of configuration.
 */
import { getRequestHeader, type H3Event } from 'h3';
import { createHash, timingSafeEqual } from 'node:crypto';
import { AgentError } from '../errors.js';

/** The shared secret. A host sends it as `Authorization: Bearer <token>`. */
export const TOKEN_ENV = 'LITRO_MCP_TOKEN';

/** Comma-separated exact origins a browser-based host may call from. */
export const ORIGINS_ENV = 'LITRO_MCP_ORIGINS';

/** `1`/`true` says the route is reachable from localhost alone, which is the
 *  only case where no token is honest. `0`/`false` forces the token check on. */
export const LOCAL_ENV = 'LITRO_MCP_LOCAL';

export interface McpGateConfig {
  /** True when the route is reachable from this machine only. */
  local: boolean;
  /** The shared secret, or undefined in local mode. */
  token?: string;
  /** Exact origin strings a browser-based host may call from. */
  allowedOrigins: string[];
}

export interface GateOverrides {
  local?: boolean;
  token?: string;
  allowedOrigins?: string[];
}

/** `a, b ,,c` -> `['a','b','c']`. Empty entries are dropped rather than
 *  becoming an origin of `''`, which would match nothing and read as a bug. */
export function parseOriginList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function envFlag(raw: string | undefined): boolean | undefined {
  if (raw === undefined || raw === '') return undefined;
  const v = raw.trim().toLowerCase();
  if (v === '1' || v === 'true' || v === 'yes') return true;
  if (v === '0' || v === 'false' || v === 'no') return false;
  return undefined;
}

/**
 * Is this a development server?
 *
 * A dev server binds to localhost, so it is the one case that can be local by
 * default rather than by configuration.
 *
 * THREE SIGNALS, IN THIS ORDER, and the list is what measurement produced
 * rather than what looked likely:
 *
 *   - `LITRO_DEV=true` is set by `litro dev` itself
 *     (`packages/framework/src/cli/index.ts`), and it is what
 *     `create-page-handler.ts` already reads for the same question.
 *   - `NITRO_DEV_WORKER_ID` is present in a Nitro dev worker, which covers a
 *     project driven by `nitro dev` without the Litro CLI.
 *   - `process.dev` is checked last for an older Nitro. Measured on nitropack
 *     2.13.4 it is `undefined` in the dev worker and `false` in a build, so on
 *     its own it would have called `litro dev` a deployment — which is exactly
 *     what happened, and is why the other two are here.
 *
 * NODE_ENV is deliberately NOT one of them. Measured: `undefined` under
 * `litro dev` and `"production"` in a build — so reading it as "not production
 * means local" would make a deployment that forgot to set it open by default,
 * which is the one outcome decision 3 exists to prevent.
 */
export function isDevServer(env: Record<string, string | undefined> = process.env): boolean {
  if (env.LITRO_DEV === 'true') return true;
  if (env.NITRO_DEV_WORKER_ID !== undefined) return true;
  return (process as unknown as { dev?: boolean }).dev === true;
}

/**
 * Reads the route's configuration, and refuses to build an open one.
 *
 * THE STARTUP FAILURE IS THE POINT OF THIS FUNCTION. A production build with no
 * token is the case where a silent default of "open" would publish a project's
 * tools to anyone who found the URL. So a build that is not marked local and
 * carries no token does not start, and the message names the two environment
 * variables that fix it — which of the two is right is the operator's call and
 * cannot be guessed from here.
 *
 * A dev server is local by default because Nitro binds it to localhost. That
 * default is deliberately NOT extended to a build: a build is deployed, and
 * "it happens to be on my laptop today" is not something this code can read.
 */
export function resolveGateConfig(
  env: Record<string, string | undefined> = process.env,
  overrides: GateOverrides = {},
): McpGateConfig {
  const local = overrides.local ?? envFlag(env[LOCAL_ENV]) ?? isDevServer(env);
  const token = overrides.token ?? (env[TOKEN_ENV]?.trim() || undefined);
  const allowedOrigins = overrides.allowedOrigins ?? parseOriginList(env[ORIGINS_ENV]);

  if (!local && !token) {
    throw new AgentError(
      `${TOKEN_ENV} is not set, and this MCP route is not local.\n` +
        `  Set ${TOKEN_ENV} to a shared secret; a host sends it as "Authorization: Bearer <token>".\n` +
        `  Set ${LOCAL_ENV}=1 instead only when the route is reachable from localhost alone.\n` +
        '  A route with no token answers every request that reaches it, so there is no default for this.',
      { status: 500 },
    );
  }

  return { local, token, allowedOrigins };
}

/** localhost, in the three spellings a browser actually sends. */
export function isLocalOrigin(origin: string): boolean {
  let host: string;
  try {
    const url = new URL(origin);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    host = url.hostname;
  } catch {
    return false;
  }
  // `new URL` keeps the brackets on an IPv6 hostname.
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1';
}

/**
 * Is this `Origin` allowed to call the route?
 *
 * An explicit allowlist always wins, in either mode — an operator who names
 * origins means those origins. With no allowlist, a local route accepts any
 * localhost origin, because that is where a browser-based inspector runs and
 * its port changes between runs. A non-local route with no allowlist accepts
 * none: a deployed MCP route has no browser client unless someone said so.
 */
export function isOriginAllowed(origin: string, config: McpGateConfig): boolean {
  if (config.allowedOrigins.includes(origin)) return true;
  if (config.allowedOrigins.length > 0) return false;
  return config.local && isLocalOrigin(origin);
}

/**
 * A comparison whose duration does not depend on where two strings differ.
 *
 * `timingSafeEqual` needs equal lengths, and the length of the value being
 * compared is itself a leak, so both sides are hashed first and the digests are
 * compared. That is fixed-width whatever the inputs were.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a, 'utf8').digest();
  const hb = createHash('sha256').update(b, 'utf8').digest();
  return timingSafeEqual(ha, hb);
}

/** The bearer token on a request, or undefined. The scheme is matched
 *  case-insensitively, which is what RFC 9110 asks for. */
export function bearerToken(event: H3Event): string | undefined {
  const header = getRequestHeader(event, 'authorization');
  if (!header) return undefined;
  const match = /^bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : undefined;
}

export interface GateResult {
  /** The origin to echo back, or undefined when there is nothing to echo.
   *  NEVER `*` — a wildcard would let any page on the internet drive the
   *  route from a reader's browser. */
  echoOrigin?: string;
}

/**
 * Runs the Origin gate.
 *
 * ABSENT IS ALLOWED, and that is not an oversight. A CLI or desktop host sends
 * no `Origin` at all; refusing that would refuse every host that is not a
 * browser, which is most of them. The specification asks for 403 when the
 * header is present and invalid, and says nothing about its absence.
 */
export function checkOrigin(event: H3Event, config: McpGateConfig): GateResult {
  const origin = getRequestHeader(event, 'origin');
  if (!origin) return {};
  if (!isOriginAllowed(origin, config)) {
    throw new AgentError(
      `Origin "${origin}" is not allowed to reach this MCP route.\n` +
        `  Add it to ${ORIGINS_ENV} (comma-separated) if it should be.`,
      { status: 403 },
    );
  }
  return { echoOrigin: origin };
}

/**
 * Runs the token gate. Skipped entirely when no token is configured, which
 * `resolveGateConfig` allows only in local mode.
 *
 * 401 and not 403: the host has not proved who it is, and 401 is the status a
 * host reads as "authenticate", including the one that can send a static
 * header.
 */
export function checkToken(event: H3Event, config: McpGateConfig): void {
  if (!config.token) return;
  const sent = bearerToken(event);
  if (sent === undefined) {
    throw new AgentError(
      'This MCP route needs a bearer token. Send "Authorization: Bearer <token>".',
      { status: 401 },
    );
  }
  if (!constantTimeEqual(sent, config.token)) {
    // Says nothing about the token that was sent. A message that distinguished
    // "too short" from "wrong" would be a free oracle.
    throw new AgentError('The bearer token is not valid for this MCP route.', { status: 401 });
  }
}
