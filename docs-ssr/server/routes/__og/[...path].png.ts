import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createOgHandler } from '@beatzball/litro/runtime/og-handler.js';
import { routes, pageModules } from '#litro/page-manifest';

// Read the logo and encode as a data URI. Reuses docs/ public directory.
function loadLogoDataUri(): string | undefined {
  const candidates = [
    resolve('docs/public/logo.png'),             // dev/build: cwd is repo root
    resolve('../docs/public/logo.png'),           // prerender: cwd may be docs-ssr/
    resolve('dist/server/public/logo.png'),       // SSR production: copied to output
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
