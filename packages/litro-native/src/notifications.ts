/**
 * Local notifications.
 *
 * Scheduling works only through a native host. On the web `schedule` returns an
 * empty id, because browsers cannot run a timer for a closed page. Check
 * `supports` for `'notifications'` before offering a reminder feature at all,
 * rather than scheduling one and hoping.
 */

import { getBridge } from './bridge.js';
import type { LocalNotification } from './types.js';

export const notifications = {
  /** Returns the new notification's id, or an empty string if none was set. */
  async schedule(n: LocalNotification): Promise<string> {
    return (await getBridge()).notifications.schedule(n);
  },
  async cancel(id: string): Promise<void> {
    await (await getBridge()).notifications.cancel(id);
  },
};
