/**
 * The real client entry.
 *
 * app.ts loads this file with a dynamic import so that Lit's hydration support
 * is installed before any Lit code is evaluated. New imports belong here, never
 * in app.ts — see the header of app.ts and BUILD-009.
 */
import '@beatzball/litro/runtime/LitroOutlet.js';
import '@beatzball/litro/runtime/LitroLink.js';
import { routes } from './routes.generated.js';

const outlet = document.querySelector('litro-outlet') as (Element & { routes: unknown }) | null;
if (outlet) {
  outlet.routes = routes;
}
