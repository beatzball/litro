/**
 * Nitro runtime plugin — FAST DOM shim
 *
 * @microsoft/fast-element accesses `document` at module eval time
 * (in templating/compiler.js). The DOM shim must be installed BEFORE
 * any FAST Element code is evaluated. Nitro auto-discovers and runs
 * plugins in server/plugins/ at startup, before request handlers —
 * making this the correct place to install the shim.
 */

import '@microsoft/fast-ssr/install-dom-shim.js';

export default () => {};
