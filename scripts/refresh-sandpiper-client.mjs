#!/usr/bin/env node
// Copy the built, dependency-free client. Never store a checkout path in the vendor manifest.
import { readFile, readdir, mkdir, writeFile, copyFile, rm } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const source = process.env.SANDPIPER_CLIENT_DIR ?? process.argv[2];
if (!source) throw new Error('Set SANDPIPER_CLIENT_DIR or pass the relative clients/ts directory. Build that client first with npm ci && npm run build.');
const input = resolve(source);
const upstream = JSON.parse(await readFile(join(input, 'package.json'), 'utf8'));
if (upstream.name !== '@beatzball/sandpiper') throw new Error('Expected the @beatzball/sandpiper client directory.');
if (Object.keys(upstream.dependencies ?? {}).length) throw new Error('Review new runtime dependencies before vendoring this client.');
const destination = resolve(dirname(fileURLToPath(import.meta.url)), '../playground/vendor/sandpiper');
const files = (await readdir(join(input, 'dist'))).filter((file) => /\.(js|d\.ts)$/.test(file)).sort();
if (!files.includes('index.js') || !files.includes('index.d.ts')) throw new Error('Build the client before refreshing it.');
const hash = createHash('sha256');
for (const file of files) {
  hash.update(file).update('\0').update(await readFile(join(input, 'dist', file))).update('\0');
}
await rm(join(destination, 'lib'), { recursive: true, force: true });
await mkdir(join(destination, 'lib'), { recursive: true });
for (const file of files) await copyFile(join(input, 'dist', file), join(destination, 'lib', file));
await writeFile(join(destination, 'LICENSE'), (await readFile(join(input, '../../LICENSE'), 'utf8')).trimEnd() + '\n');
await writeFile(join(destination, 'package.json'), JSON.stringify({
  name: upstream.name, version: upstream.version, private: true, type: 'module', license: upstream.license,
  engines: upstream.engines,
  exports: { '.': { types: './lib/index.d.ts', import: './lib/index.js' } },
}, null, 2) + '\n');
await writeFile(join(destination, 'SOURCE.json'), JSON.stringify({
  repository: 'https://github.com/beatzball/sandpiper', directory: 'clients/ts', version: upstream.version,
  sha256: hash.digest('hex'),
}, null, 2) + '\n');
console.log(`Refreshed ${files.length} built Sandpiper client files.`);
