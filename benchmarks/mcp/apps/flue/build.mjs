import { build } from 'esbuild';
import { rm } from 'node:fs/promises';

await rm('dist', { recursive: true, force: true });
await build({ entryPoints: ['weather.ts', 'verify.ts'], outdir: 'dist', outExtension: { '.js': '.mjs' }, bundle: true, packages: 'external', platform: 'node', format: 'esm', target: 'node24', logLevel: 'silent' });
