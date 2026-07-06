/**
 * @beatzball/litro/actions/server — SERVER-ONLY action utilities.
 * Touches node:crypto (Task 7 adds cookie/CSRF helpers here). Page modules
 * may import it (the fetcher runs server-side); the Vite actions plugin
 * replaces this module with throwing stubs in client builds.
 */
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { getCookie, setCookie, deleteCookie, type H3Event } from 'h3';
import { hashActionId } from './hash.js';
import { ACTION_ID } from './client.js';
import type { ActionModuleEntry } from './handler.js';

/** Called at Nitro boot by the generated server/plugins/litro-actions.ts:
 *  stamps every scanned function export with its wire id so actionUrl()
 *  resolves during SSR. Mirrors the handler registry's enumeration exactly. */
export function stampActionIds(entries: ActionModuleEntry[]): void {
  for (const { relPath, module } of entries) {
    for (const exportName of Object.keys(module)) {
      const value = module[exportName];
      if (typeof value !== 'function') continue;
      if ((value as unknown as Record<symbol, unknown>)[ACTION_ID] !== undefined) continue;
      Object.defineProperty(value, ACTION_ID, {
        value: hashActionId(relPath, exportName),
        enumerable: false,
      });
    }
  }
}

export const CSRF_COOKIE = '__Host-litro-csrf';
export const FORM_ERROR_COOKIE = 'litro-form-error';

/** Returns the current CSRF token, minting + setting the __Host- cookie when
 *  absent. Call inside definePageData fetchers for pages that render
 *  csrf:'token' forms, and put the value in
 *  <input type="hidden" name="_litro_csrf" value=...>.
 *  __Host- requires Secure + Path=/ and no Domain; browsers treat
 *  http://localhost as trustworthy, so dev works. */
export function csrfToken(event: H3Event): string {
  const existing = getCookie(event, CSRF_COOKIE);
  if (existing) return existing;
  const token = randomBytes(32).toString('base64url');
  setCookie(event, CSRF_COOKIE, token, {
    path: '/',
    secure: true,
    httpOnly: true,
    sameSite: 'lax',
  });
  return token;
}

/** Constant-time double-submit comparison: the _litro_csrf form field must
 *  equal the __Host-litro-csrf cookie. */
export function verifyCsrfToken(event: H3Event, submitted: unknown): boolean {
  const cookie = getCookie(event, CSRF_COOKIE);
  if (!cookie || typeof submitted !== 'string' || submitted.length === 0) return false;
  const a = Buffer.from(cookie);
  const b = Buffer.from(submitted);
  return a.length === b.length && timingSafeEqual(a, b);
}

export interface FormErrors {
  actionId: string;
  issues?: unknown[];
  message?: string;
  status?: number;
}

/** One-shot PRG error transport. HttpOnly is off by design: the payload is
 *  already client-visible data, and enhanced clients may read it too. */
export function setFormErrorCookie(event: H3Event, errors: FormErrors): void {
  setCookie(event, FORM_ERROR_COOKIE, JSON.stringify(errors), {
    path: '/',
    sameSite: 'lax',
    maxAge: 30,
    httpOnly: false,
  });
}

/** Reads and clears the one-shot error cookie set by a failed form post —
 *  call inside definePageData so the re-rendered page can surface issues. */
export function getFormErrors(event: H3Event): FormErrors | null {
  const raw = getCookie(event, FORM_ERROR_COOKIE);
  if (!raw) return null;
  deleteCookie(event, FORM_ERROR_COOKIE, { path: '/' });
  try {
    return JSON.parse(raw) as FormErrors;
  } catch {
    return null;
  }
}
