import { rm, mkdir, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';

await rm(new URL('./dist/', import.meta.url), { recursive: true, force: true });
await mkdir(new URL('./dist/', import.meta.url), { recursive: true });
const ui = await build({
  entryPoints: ['src/ui.ts'],
  bundle: true,
  platform: 'browser',
  format: 'iife',
  target: 'es2022',
  minify: true,
  legalComments: 'none',
  write: false,
});
const script = ui.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
await writeFile(new URL('./dist/weather.html', import.meta.url), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Weather</title>
<style>body{font:16px system-ui;margin:0;padding:16px}h1{font-size:20px}</style></head>
<body><h1>Weather</h1><p id="weather" aria-live="polite">Waiting for weather…</p><script>${script}</script></body></html>\n`);
await build({
  entryPoints: ['src/server.ts'],
  outfile: 'dist/server.mjs',
  bundle: true,
  packages: 'external',
  platform: 'node',
  format: 'esm',
  target: 'node22',
  sourcemap: false,
  legalComments: 'none',
});
