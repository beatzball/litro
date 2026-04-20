import '@beatzball/litro/adapter/elena/runtime';
import { routes } from './routes.generated.js';

const outlet = document.querySelector('litro-outlet') as (Element & { routes: unknown }) | null;
if (outlet) {
  outlet.routes = routes;
}
