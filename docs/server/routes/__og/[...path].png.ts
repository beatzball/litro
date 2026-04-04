import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createOgHandler } from '@beatzball/litro/runtime/og-handler.js';
import { routes, pageModules } from '#litro/page-manifest';

// Read the logo and encode as a data URI. Try multiple resolution strategies
// since the working directory differs between dev, SSG prerender, and SSR.
function loadLogoDataUri(): string | undefined {
  const candidates = [
    resolve('public/logo.png'),                 // dev: cwd is docs/
    resolve('docs/public/logo.png'),             // prerender: cwd is repo root
    resolve('dist/server/public/logo.png'),      // SSR production: copied to output
  ];
  for (const p of candidates) {
    if (existsSync(p)) {
      return `data:image/png;base64,${readFileSync(p).toString('base64')}`;
    }
  }
  return undefined;
}

export default createOgHandler({
  siteName: 'Litro',
  accentColor: '#ea580c',
  logoDataUri: loadLogoDataUri(),
  routes,
  pageModules,
});
