import '@lit-labs/ssr-client/lit-element-hydrate-support.js';
import '@beatzball/litro/runtime/LitroOutlet.js';
import '@beatzball/litro/runtime/LitroLink.js';
import { routes } from './routes.generated.js';

const outlet = document.querySelector('litro-outlet') as (Element & { routes: unknown }) | null;
if (outlet) {
  outlet.routes = routes;
}
