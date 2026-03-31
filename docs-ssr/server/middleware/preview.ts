import { defineEventHandler, getQuery, setCookie, deleteCookie, getCookie } from 'h3';

/**
 * Preview mode middleware.
 *
 * Activates preview mode (draft content visible) when:
 *   - `?preview=1` query param is present (also sets a 1-hour cookie)
 *   - `__litro_preview=1` cookie is present
 *
 * Deactivates when `?preview=0` is present (clears cookie).
 *
 * Sets `event.context.preview = true/false` for downstream handlers.
 */
export default defineEventHandler((event) => {
  const query = getQuery(event);

  if (query.preview === '1') {
    setCookie(event, '__litro_preview', '1', {
      httpOnly: true,
      path: '/',
      maxAge: 60 * 60, // 1 hour
      sameSite: 'lax',
    });
    event.context.preview = true;
    return;
  }

  if (query.preview === '0') {
    deleteCookie(event, '__litro_preview', { path: '/' });
    event.context.preview = false;
    return;
  }

  const cookie = getCookie(event, '__litro_preview');
  event.context.preview = cookie === '1';
});
