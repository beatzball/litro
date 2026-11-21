import { build } from 'esbuild';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { buildMcpAppDocument } from '@beatzball/litro-agent/mcp-app';

await rm('dist', { recursive: true, force: true });
await mkdir('dist/mcp-apps', { recursive: true });
await build({ entryPoints: ['server.ts', 'app.ts'], outdir: 'dist', outExtension: { '.js': '.mjs' }, bundle: true, packages: 'external', platform: 'node', format: 'esm', target: 'node24', logLevel: 'silent' });
const app = (await import('./dist/app.mjs')).default;
const { html, descriptor } = await buildMcpAppDocument(app);
await writeFile('dist/mcp-apps/weather.html', html);
await writeFile('dist/mcp-apps/weather.json', JSON.stringify(descriptor));
await writeFile('dist/mcp-apps/manifest.json', JSON.stringify([{ name: 'weather', uri: descriptor.uri, html: 'weather.html', descriptor: 'weather.json' }]));
