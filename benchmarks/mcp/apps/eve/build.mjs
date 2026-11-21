import { build } from 'esbuild';
import { rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

await rm('dist', { recursive: true, force: true });
await rm('.output', { recursive: true, force: true });
await rm('.eve', { recursive: true, force: true });
const native = spawnSync(process.execPath, ['node_modules/eve/bin/eve.js', 'build', '--skip-sandbox-prewarm'], { stdio: 'inherit' });
if (native.error) throw native.error;
if (native.status !== 0) process.exit(native.status ?? 1);
await build({ entryPoints: ['server.ts'], outdir: 'dist', outExtension: { '.js': '.mjs' }, bundle: true, packages: 'external', platform: 'node', format: 'esm', target: 'node24', logLevel: 'silent' });
