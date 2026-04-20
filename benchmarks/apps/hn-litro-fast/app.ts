import '@microsoft/fast-element/install-element-hydration.js';
import '@beatzball/litro/adapter/fast/runtime';
import { routes } from './routes.generated.js';

const outlet = document.querySelector('litro-outlet') as (Element & { routes: unknown }) | null;
if (outlet) {
  outlet.routes = routes;
}
