import { createOgHandler } from '@beatzball/litro/runtime/og-handler.js';
import { routes, pageModules } from '#litro/page-manifest';

export default createOgHandler({
  siteName: 'Litro',
  accentColor: '#ea580c',
  routes,
  pageModules,
});
