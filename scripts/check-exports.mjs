#!/usr/bin/env node
/**
 * check-exports — guards a package manifest against promising files it does
 * not ship.
 *
 * Every `exports`, `main`, `module`, `types`, `browser` and `bin` target of
 * each published package must resolve inside the tarball npm would actually
 * publish. The tarball is the point: a target can exist in `dist/` on a
 * developer's disk and still be missing from the package, because the `files`
 * allowlist excluded it. Checking the working tree would pass in both cases.
 *
 * This exists because `@beatzball/litro` declared `main` and a root `require`
 * condition pointing at `dist/index.cjs` for its entire published life. The
 * build is a single tsc pass over a `"type": "module"` package and cannot emit
 * .cjs, so the file was never in any tarball. Every CI job stayed green,
 * because nothing ever resolved the require condition. Only a reader of the
 * manifest would have caught it (issue 262).
 *
 * Packing is done with `pnpm pack`, never `npm pack`: npm leaves `workspace:^`
 * ranges in the manifest it writes, which is REL-005 in
 * .agents/rules/release-deps.md.
 *
 * A package is checked when packages/<name>/package.json has no `private: true`.
 * Build the packages first; an unbuilt package reports every target missing.
 *
 * Usage:
 *   node scripts/check-exports.mjs              check every published package
 *   node scripts/check-exports.mjs --self-test  prove the checks still fire
 *   node scripts/check-exports.mjs --list       print every target checked
 *
 * Exit code 1 if any target fails to resolve.
 */

import { readFileSync, existsSync, readdirSync, mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LIST = process.argv.includes('--list');

/* ── Collecting the targets a manifest promises ───────────────────────── */

// Conditions that never name a file we ship. `types` IS a real file, so it is
// not here; these are the ones whose value is a nested condition object or a
// platform hint handled by recursion.
const TOP_LEVEL_FIELDS = ['main', 'module', 'types', 'typings', 'browser', 'style', 'unpkg'];

/** Every path a manifest points at, as [label, './relative/path']. */
function collectTargets(manifest) {
  const targets = [];

  const add = (label, value) => {
    // Only repo-relative targets are ours to check. A bare specifier in a
    // browser field or an exports entry is a redirect to another package.
    if (typeof value === 'string' && value.startsWith('./')) targets.push([label, value]);
  };

  for (const field of TOP_LEVEL_FIELDS) add(field, manifest[field]);

  const bin = manifest.bin;
  if (typeof bin === 'string') add('bin', bin);
  else if (bin && typeof bin === 'object') for (const [k, v] of Object.entries(bin)) add(`bin[${k}]`, v);

  // exports is a tree: subpath keys and condition keys nest arbitrarily, and a
  // value may be an array of fallbacks.
  const walk = (node, path) => {
    if (typeof node === 'string') return add(`exports[${path || '.'}]`, node);
    if (Array.isArray(node)) return node.forEach((n, i) => walk(n, `${path}[${i}]`));
    if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) walk(v, path ? `${path}${k.startsWith('.') ? k.slice(1) : ' ' + k}` : k);
    }
  };
  walk(manifest.exports, '');

  return targets;
}

/* ── Resolving one target inside an extracted tarball ─────────────────── */

/**
 * An exports glob is a single `*` standing for any substring, including `/`.
 * Node matches it against the files on disk, so the check is "does at least
 * one file match", not "does this exact path exist".
 */
function globMatches(pkgRoot, rel) {
  const [before, after] = rel.slice(2).split('*');
  const files = [];
  const walkDir = (dir) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = join(dir, e.name);
      if (e.isDirectory()) walkDir(full);
      else files.push(relative(pkgRoot, full).split(sep).join('/'));
    }
  };
  walkDir(pkgRoot);
  return files.some((f) => f.startsWith(before) && f.endsWith(after) && f.length >= before.length + after.length);
}

/** Check one extracted package. Returns { name, total, globbed, missing[] }. */
function checkPackage(pkgRoot) {
  const manifest = JSON.parse(readFileSync(join(pkgRoot, 'package.json'), 'utf8'));
  const targets = collectTargets(manifest);
  const missing = [];
  let globbed = 0;

  for (const [label, rel] of targets) {
    const isGlob = rel.includes('*');
    const ok = isGlob ? globMatches(pkgRoot, rel) : existsSync(join(pkgRoot, rel.slice(2)));
    if (ok && isGlob) globbed++;
    if (!ok) missing.push({ label, rel, why: isGlob ? 'no file in the tarball matches this glob' : 'file is not in the tarball' });
    if (LIST) console.log(`    ${ok ? 'ok  ' : 'MISS'}  ${label}  ->  ${rel}`);
  }

  return { name: manifest.name, total: targets.length, globbed, missing };
}

/* ── Packing ──────────────────────────────────────────────────────────── */

function publishedPackages() {
  return readdirSync(join(ROOT, 'packages'), { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => join(ROOT, 'packages', e.name))
    .filter((dir) => {
      const mf = join(dir, 'package.json');
      if (!existsSync(mf)) return false;
      return JSON.parse(readFileSync(mf, 'utf8')).private !== true;
    });
}

/** Pack with pnpm (REL-005) and extract, returning the extracted package dir. */
function packAndExtract(pkgDir, destRoot) {
  const out = execFileSync('pnpm', ['pack', '--pack-destination', destRoot], {
    cwd: pkgDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const tgz = out.trim().split('\n').pop().trim();
  if (!existsSync(tgz)) throw new Error(`pnpm pack printed no usable tarball path for ${pkgDir}: ${out}`);
  const dest = join(destRoot, 'x-' + relative(join(ROOT, 'packages'), pkgDir));
  mkdirSync(dest, { recursive: true });
  execFileSync('tar', ['-xzf', tgz, '-C', dest], { stdio: 'ignore' });
  return join(dest, 'package');
}

/* ── Self-test ────────────────────────────────────────────────────────── */

// A guard nobody has seen fail is a guard nobody knows still works. This
// builds a fixture holding one of each failure shape and asserts the checker
// reports exactly those and nothing else.
if (process.argv.includes('--self-test')) {
  const dir = mkdtempSync(join(tmpdir(), 'check-exports-selftest-'));
  const pkg = join(dir, 'package');
  mkdirSync(join(pkg, 'dist'), { recursive: true });
  writeFileSync(join(pkg, 'dist', 'index.js'), 'export const ok = 1;\n');
  writeFileSync(join(pkg, 'dist', 'a.js'), 'export const a = 1;\n');
  writeFileSync(
    join(pkg, 'package.json'),
    JSON.stringify(
      {
        name: 'self-test-fixture',
        main: './dist/index.cjs', // missing: the shape of issue 262
        module: './dist/index.js', // present
        exports: {
          '.': { types: './dist/index.d.ts', import: './dist/index.js' }, // one missing, one present
          './sub/*': { import: './dist/*.js' }, // glob that matches
          './gone/*': { import: './dist/gone/*.js' }, // glob that matches nothing
        },
        bin: { tool: './dist/cli.js' }, // missing
      },
      null,
      2,
    ),
  );

  const res = checkPackage(pkg);
  rmSync(dir, { recursive: true, force: true });

  const got = res.missing.map((m) => m.label).sort();
  const want = ['bin[tool]', 'exports[./gone/* import]', 'exports[. types]', 'main'].sort();
  const same = got.length === want.length && got.every((g, i) => g === want[i]);

  if (!same) {
    console.error('self-test FAILED — the checker no longer reports the expected targets.');
    console.error(`  expected: ${want.join(', ')}`);
    console.error(`  got     : ${got.join(', ') || '(nothing)'}`);
    process.exit(1);
  }
  if (res.globbed !== 1) {
    console.error(`self-test FAILED — expected exactly 1 glob to resolve, got ${res.globbed}.`);
    process.exit(1);
  }
  console.log(`check-exports: self-test OK — all ${want.length} failure shapes fire, and a matching glob still passes.`);
  process.exit(0);
}

/* ── Run ──────────────────────────────────────────────────────────────── */

const dirs = publishedPackages();
if (dirs.length === 0) {
  console.error('check-exports: found no published packages under packages/. Has the layout changed?');
  process.exit(1);
}

const destRoot = mkdtempSync(join(tmpdir(), 'check-exports-'));
const results = [];
try {
  for (const dir of dirs) {
    if (LIST) console.log(`\n  ${relative(ROOT, dir)}`);
    results.push(checkPackage(packAndExtract(dir, destRoot)));
  }
} finally {
  rmSync(destRoot, { recursive: true, force: true });
}

const broken = results.filter((r) => r.missing.length > 0);
const total = results.reduce((n, r) => n + r.total, 0);

if (broken.length === 0) {
  console.log(`check-exports: OK — ${total} targets across ${results.length} packages, all present in the packed tarball.`);
  for (const r of results) console.log(`  ${r.name}: ${r.total}${r.globbed ? ` (${r.globbed} via glob)` : ''}`);
  process.exit(0);
}

console.error(`check-exports: ${broken.reduce((n, r) => n + r.missing.length, 0)} target(s) missing from the packed tarball\n`);
for (const r of broken) {
  console.error(`  ${r.name}  (${r.total - r.missing.length}/${r.total} resolve)`);
  for (const m of r.missing) console.error(`    ${m.label}  ->  ${m.rel}   (${m.why})`);
}
console.error(`
How to fix, in order of likelihood:

  1. The file is built but excluded. Check the package's \`files\` field --
     the target must be inside one of its patterns, and not canceled by a
     later \`!\` pattern.
  2. The file is never built. Check the package's \`build\` script actually
     emits it. A single \`tsc\` pass over a "type": "module" package cannot
     emit .cjs, so a .cjs target needs a second build step or it is wrong.
  3. The manifest is wrong. If nothing needs the target, delete the field or
     the condition rather than inventing a build step for it.

Run the build before this check; an unbuilt package reports every target
missing.
`);
process.exit(1);
