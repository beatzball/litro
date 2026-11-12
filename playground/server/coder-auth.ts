import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { getCookie, getRequestHeader, getRequestURL, getRouterParam, setCookie, type H3Event } from 'h3';
import { AgentError } from '@beatzball/litro-agent';

interface Credential { principal: string; secret: string }
export interface CoderIdentity { principal: string; agent: 'coder'; session: string; transport: 'chat' | 'mcp' }
// Only the access guard can populate identity. Request JSON/context is never trusted.
const identities = new WeakMap<H3Event, CoderIdentity>();
const COOKIE = 'litro_coder_login';
const SESSION_SECONDS = 12 * 60 * 60;

function credentials(): Credential[] {
  const values: Record<string, string> = {};
  if (process.env.CODER_ACCESS_TOKEN) values.shared = process.env.CODER_ACCESS_TOKEN;
  if (process.env.CODER_ACCESS_TOKENS) {
    let named: unknown;
    try { named = JSON.parse(process.env.CODER_ACCESS_TOKENS); } catch { /* Configuration error below. */ }
    if (!named || typeof named !== 'object' || Array.isArray(named) ||
        !Object.entries(named).every(([name, token]) => /^[a-zA-Z0-9_-]{1,64}$/.test(name) && typeof token === 'string' && token.length >= 16)) {
      throw new AgentError('CODER_ACCESS_TOKENS must be a JSON object of principal names to secrets of at least 16 characters.', { status: 503 });
    }
    Object.assign(values, named);
  }
  if (!Object.keys(values).length) throw new AgentError('Coder access is disabled. Configure CODER_ACCESS_TOKEN or CODER_ACCESS_TOKENS on the server.', { status: 503 });
  if (Object.values(values).some((secret) => secret.length < 16) || new Set(Object.values(values)).size !== Object.keys(values).length) {
    throw new AgentError('Coder secrets must be unique and at least 16 characters long.', { status: 503 });
  }
  return Object.entries(values).map(([name, secret]) => ({ principal: createHash('sha256').update(name).digest('hex'), secret }));
}
function equal(a: string, b: string): boolean {
  const left = Buffer.from(a), right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
function sign(value: string, credential: Credential): string {
  return createHmac('sha256', credential.secret).update(`${credential.principal}:${value}`).digest('base64url').slice(0, 24);
}
function authenticate(event: H3Event): Credential {
  const available = credentials();
  const auth = getRequestHeader(event, 'authorization');
  if (auth) {
    const credential = available.find(({ secret }) => equal(auth, `Bearer ${secret}`));
    if (credential) return credential;
  }
  {
    const origin = getRequestHeader(event, 'origin');
    if (getRequestHeader(event, 'sec-fetch-site') === 'cross-site' || (origin && origin !== getRequestURL(event).origin)) {
      throw new AgentError('Coder cookie access requires the same origin.', { status: 403 });
    }
    const cookie = getCookie(event, COOKIE) ?? '';
    const [expiry, signature] = cookie.split('.');
    if (/^[0-9]+$/.test(expiry ?? '') && Number(expiry) > Date.now() / 1000) {
      const credential = available.find((candidate) => equal(signature ?? '', sign(`login:${expiry}`, candidate)));
      if (credential) return credential;
    }
  }
  throw new AgentError('Sign in with a coder access token.', { status: 401 });
}
export function issueCoderSession(event: H3Event): { sessionId: string } {
  const credential = authenticate(event);
  const expiry = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  setCookie(event, COOKIE, `${expiry}.${sign(`login:${expiry}`, credential)}`, {
    httpOnly: true, sameSite: 'strict', path: '/', maxAge: SESSION_SECONDS,
    secure: getRequestURL(event).protocol === 'https:',
  });
  const nonce = randomBytes(12).toString('base64url');
  const body = `c_${expiry.toString(36)}_${nonce}`;
  return { sessionId: `${body}_${sign(`session:${body}`, credential)}` };
}
export function coderAccess(event: H3Event): void {
  const credential = authenticate(event);
  const session = getRouterParam(event, 'session');
  if (session !== undefined) {
    const match = /^(c_([a-z0-9]+)_[A-Za-z0-9_-]{16})_([A-Za-z0-9_-]{24})$/.exec(session);
    if (!match || parseInt(match[2], 36) <= Date.now() / 1000 || !equal(match[3], sign(`session:${match[1]}`, credential))) {
      throw new AgentError('This coder session is invalid, expired, or belongs to another principal. Sign in to start a session.', { status: 403 });
    }
  }
  identities.set(event, { principal: credential.principal, agent: 'coder', session: session ?? '', transport: session === undefined ? 'mcp' : 'chat' });
}
export function coderIdentity(event: H3Event | undefined, session: string): CoderIdentity {
  const identity = event && identities.get(event);
  if (!identity || (identity.transport === 'chat' && identity.session !== session)) {
    throw new AgentError('Run-code requires an authenticated coder HTTP request. Stdio is not supported.', { status: 401 });
  }
  return identity;
}
