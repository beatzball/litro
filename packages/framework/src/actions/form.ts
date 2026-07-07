/**
 * Form-mode handling for POST /__litro/action/:id — the no-JS progressive
 * enhancement path (spec section 2.3). SERVER-ONLY.
 *
 * Error-surface split:
 *   - Misconfiguration (plain-function target, schema-less defineAction,
 *     streaming result) and CSRF-token failures THROW LitroActionError —
 *     handler.ts turns them into plain JSON 400/403 responses. These are
 *     developer errors or attack traffic, not end-user flows.
 *   - Validation failures and handler throws PRG-bounce: one-shot
 *     litro-form-error cookie + 303 back to the Referer, so the re-rendered
 *     page can surface them via getFormErrors().
 */
import { readFormData, sendRedirect, getRequestHeader, type H3Event } from 'h3';
import { ACTION_CONFIG, runAction, type ActionConfig } from './define.js';
import { LitroActionError } from './error.js';
import { formDataToObject, CSRF_FIELD } from './form-data.js';
import { isAsyncIterable } from './serialize.js';
import { setFormErrorCookie, verifyCsrfToken } from './server.js';

export function isFormContentType(contentType: string | undefined): boolean {
  if (!contentType) return false;
  // Parse the media-type essence (strip parameters like charset/boundary) so
  // a header such as `text/plain; x="multipart/form-data"` isn't
  // misclassified as form mode by a naive substring match.
  const essence = contentType.split(';')[0].trim().toLowerCase();
  return essence === 'application/x-www-form-urlencoded' || essence === 'multipart/form-data';
}

export async function handleFormMode(
  event: H3Event,
  actionId: string,
  fn: (...args: unknown[]) => unknown,
): Promise<unknown> {
  const config = (fn as unknown as Record<symbol, unknown>)[ACTION_CONFIG] as
    | ActionConfig<unknown, unknown>
    | undefined;
  if (!config?.input) {
    throw new LitroActionError(
      'Form posts require a defineAction export with an input schema — form fields ' +
        'are untrusted strings and the schema is the parse boundary.',
      { status: 400 },
    );
  }

  let fd: FormData;
  try {
    fd = await readFormData(event);
  } catch (err) {
    throw new LitroActionError('Malformed form request body', { status: 400, cause: err });
  }
  if (config.csrf === 'token' && !verifyCsrfToken(event, fd.get(CSRF_FIELD))) {
    throw new LitroActionError('Invalid or missing CSRF token', { status: 403 });
  }

  const input = formDataToObject(fd);
  const referer = getRequestHeader(event, 'referer');

  let result: unknown;
  try {
    result = await runAction(config, input, { event });
  } catch (err) {
    if (err instanceof LitroActionError && err.issues) {
      setFormErrorCookie(event, { actionId, issues: err.issues });
    } else {
      const e = err instanceof Error ? err : new Error(String(err));
      const status = err instanceof LitroActionError ? err.status : 500;
      setFormErrorCookie(event, { actionId, message: e.message, status });
    }
    return sendRedirect(event, referer ?? '/', 303);
  }

  // Escape hatch: the handler wrote its own response via ctx.event.
  if (event.handled) return undefined;

  if (isAsyncIterable(result)) {
    throw new LitroActionError('Streaming actions cannot respond to form posts', { status: 400 });
  }

  return sendRedirect(event, config.form?.redirect ?? referer ?? '/', 303);
}
