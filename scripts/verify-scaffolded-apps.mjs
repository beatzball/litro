#!/usr/bin/env node
/**
 * verify-scaffolded-apps.mjs — build every recipe the way a real user gets it.
 *
 * WHY THIS EXISTS
 *
 * Every e2e project in this repo runs against a workspace playground, where
 * `node_modules/@beatzball/litro` is a symlink into `packages/framework`. That
 * is the one path where everything works. An app created with `create-litro`
 * resolves the same package from a real `node_modules` install, and that path
 * had never been executed by a test.
 *
 * It was broken for months in four of six recipe variants: Vite does not
 * transpile TypeScript that lives inside node_modules, so resolving the
 * package to its `src/` emitted raw decorators —
 *
 *     (@at(`litro-outlet`) class extends rt { ... })
 *
 * — which no browser can parse. The build still exited 0, the prerendered HTML
 * was still perfect, and the only symptom was a blank white page in a browser.
 * Nothing in CI could see it.
 *
 * So this script packs the real tarballs, scaffolds each recipe against them,
 * builds, and then PARSES the emitted client bundle. A bundle that does not
 * parse is a dead site, no matter what the build said.
 *
 * Usage:
 *   node scripts/verify-scaffolded-apps.mjs            # all variants
 *   node scripts/verify-scaffolded-apps.mjs --keep     # keep the temp dir
 *   node scripts/verify-scaffolded-apps.mjs --only starlight:lit
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Recipe + adapter pairs create-litro can produce. */
const VARIANTS = [
  { recipe: 'fullstack', adapter: 'lit' },
  { recipe: 'fullstack', adapter: 'elena' },
  { recipe: '11ty-blog', adapter: 'lit' },
  { recipe: 'starlight', adapter: 'lit' },
  { recipe: 'starlight', adapter: 'fast' },
  { recipe: 'starlight', adapter: 'elena' },
];

/** Workspace packages an app installs from the registry. */
const PACKED = [
  { name: '@beatzball/litro', dir: 'packages/framework' },
  { name: '@beatzball/litro-router', dir: 'packages/litro-router' },
  { name: '@beatzball/litro-agent', dir: 'packages/litro-agent' },
];

/**
 * The scaffolder is packed and unpacked too, never run from the local build.
 *
 * A tarball is not just "the source directory with a different name": npm
 * strips `.gitignore` from every package it publishes. Running the local
 * `dist/` would scaffold from files that never reach a real user, and the
 * missing ignore file would sail straight through this check.
 */
const SCAFFOLDER = { name: '@beatzball/create-litro', dir: 'packages/create-litro' };

const args = process.argv.slice(2);
const keep = args.includes('--keep');

/**
 * True when any file under `dir` contains `needle`. Small recursive search
 * rather than a shell grep, so this script keeps working the same way on any
 * platform and stays dependency-free.
 */
function grepDir(dir, needle) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (grepDir(full, needle)) return true;
    } else if (entry.isFile()) {
      try {
        if (readFileSync(full, 'utf-8').includes(needle)) return true;
      } catch {
        // Unreadable or binary — nothing to match in it.
      }
    }
  }
  return false;
}

const onlyIdx = args.indexOf('--only');
const only = onlyIdx !== -1 ? args[onlyIdx + 1] : null;

function run(cmd, cmdArgs, cwd, label) {
  try {
    execFileSync(cmd, cmdArgs, { cwd, stdio: 'pipe', encoding: 'utf-8' });
    return { ok: true };
  } catch (err) {
    const out = `${err.stdout ?? ''}${err.stderr ?? ''}`.trim();
    return { ok: false, error: `${label} failed:\n${out.slice(-3000)}` };
  }
}

const work = mkdtempSync(join(tmpdir(), 'litro-verify-'));
console.log(`[verify] workspace: ${work}\n`);

// ---------------------------------------------------------------------------
// 1. Pack the real tarballs. This is what npm would publish.
// ---------------------------------------------------------------------------
const tarballs = {};
for (const { name, dir } of PACKED) {
  const pkgDir = join(REPO, dir);
  const out = execFileSync('pnpm', ['pack', '--pack-destination', work], {
    cwd: pkgDir,
    encoding: 'utf-8',
  });
  const tgz = out.trim().split('\n').pop().trim();
  if (!existsSync(tgz)) throw new Error(`[verify] pnpm pack gave no tarball for ${name}: ${out}`);
  tarballs[name] = tgz;
  console.log(`[verify] packed ${name}`);
}

// Pack + unpack the scaffolder, then run it from the extracted tarball.
const scaffolderTgz = execFileSync('pnpm', ['pack', '--pack-destination', work], {
  cwd: join(REPO, SCAFFOLDER.dir),
  encoding: 'utf-8',
}).trim().split('\n').pop().trim();
const scaffolderDir = join(work, 'scaffolder');
mkdirSync(scaffolderDir, { recursive: true });
execFileSync('tar', ['-xzf', scaffolderTgz, '-C', scaffolderDir], { stdio: 'pipe' });
const CREATE_CLI = join(scaffolderDir, 'package/dist/src/index.js');
if (!existsSync(CREATE_CLI)) {
  throw new Error(
    `[verify] the packed scaffolder has no dist/src/index.js.\n` +
      `Build it first:  pnpm --filter create-litro build`,
  );
}
console.log(`[verify] packed ${SCAFFOLDER.name} and unpacked it for scaffolding`);
console.log('');

// ---------------------------------------------------------------------------
// 2. Scaffold, install against the tarballs, build, PARSE the bundle.
// ---------------------------------------------------------------------------
const results = [];

for (const { recipe, adapter } of VARIANTS) {
  const id = `${recipe}:${adapter}`;
  if (only && only !== id) continue;

  const name = `app-${recipe}-${adapter}`;
  const dir = join(work, name);

  let step = run(
    'node',
    [CREATE_CLI, name,
     '--recipe', recipe, '--mode', 'ssg', '--adapter', adapter],
    work, 'scaffold',
  );
  if (!step.ok) { results.push({ id, status: 'SCAFFOLD-FAIL', detail: step.error }); continue; }

  // Force every Litro package to the packed tarball, transitive deps included.
  const manifestPath = join(dir, 'package.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  manifest.pnpm ??= {};
  manifest.pnpm.overrides ??= {};
  for (const [pkgName, tgz] of Object.entries(tarballs)) {
    manifest.pnpm.overrides[pkgName] = `file:${tgz}`;
    if (manifest.dependencies?.[pkgName]) manifest.dependencies[pkgName] = `file:${tgz}`;
  }
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

  // npm strips .gitignore from published tarballs, so a template that stores
  // the file under its final name ships fine from a local build and silently
  // vanishes once installed from the registry. Only this packed-tarball path
  // can see that, which is exactly why the check lives here.
  const ignorePath = join(dir, '.gitignore');
  if (!existsSync(ignorePath)) {
    results.push({
      id,
      status: 'NO-GITIGNORE',
      detail:
        'The scaffolded app has no .gitignore. Its first `git add` would sweep ' +
        'in node_modules/, dist/ and any .env. npm strips .gitignore from the ' +
        'tarball, so the template must ship it under another name and the ' +
        'scaffolder must rename it (see RENAME_ON_COPY in scaffold.ts).',
    });
    continue;
  }
  const ignoreText = readFileSync(ignorePath, 'utf-8');
  const missing = ['node_modules/', 'dist/', 'server/stubs/'].filter(
    (rule) => !ignoreText.includes(rule),
  );
  if (missing.length > 0) {
    results.push({
      id,
      status: 'WEAK-GITIGNORE',
      detail: `.gitignore is missing: ${missing.join(', ')}`,
    });
    continue;
  }

  step = run('pnpm', ['install', '--ignore-workspace'], dir, 'install');
  if (!step.ok) { results.push({ id, status: 'INSTALL-FAIL', detail: step.error }); continue; }

  step = run('pnpm', ['build'], dir, 'build');
  if (!step.ok) { results.push({ id, status: 'BUILD-FAIL', detail: step.error }); continue; }

  const bundle = join(dir, 'dist/client/app.js');
  if (!existsSync(bundle)) {
    results.push({ id, status: 'NO-BUNDLE', detail: `expected ${bundle}` });
    continue;
  }

  // The whole point: a build can exit 0 and still emit unparseable JavaScript.
  const asModule = join(work, `${name}.check.mjs`);
  writeFileSync(asModule, readFileSync(bundle, 'utf-8'));
  step = run(process.execPath, ['--check', asModule], work, 'bundle parse');
  if (!step.ok) {
    results.push({
      id,
      status: 'BUNDLE-UNPARSEABLE',
      detail:
        'The build succeeded but the client bundle is not valid JavaScript, so ' +
        'the site is blank in a browser.\n' + step.error,
    });
    continue;
  }

  // The credit line must survive to rendered HTML, not merely compile. Three
  // things can silently drop it and still exit 0: Rollup tree-shaking the
  // component's registration, an adapter failing to expand an unregistered
  // element during SSR, and a page that imports it but never places it.
  //
  // A fourth is subtler and is why this reads the OUTPUT rather than trusting
  // the source: under fast-ssr a binding that returns a nested template is
  // simply not rendered, so the recipe name vanished from FAST's HTML while
  // the component looked correct.
  //
  // Only the starlight recipe prerenders during `pnpm build`. fullstack and
  // 11ty-blog choose their mode from LITRO_MODE at build time and default to
  // a server build, so for those the server bundle is the thing to inspect;
  // that still catches tree-shaking, which is the failure that actually bites.
  const home = join(dir, 'dist/static/index.html');
  const wantRecipe = `${recipe} recipe`;
  if (existsSync(home)) {
    // Lit's SSR writes <!--lit-part--> markers between static text and a
    // binding, which splits "starlight recipe" apart. Strip comments first so
    // the assertion tests the rendered TEXT, not one framework's marker style.
    const rendered = readFileSync(home, 'utf-8').replace(/<!--.*?-->/gs, '');
    const missing = ['Created using', 'https://litro.dev', wantRecipe].filter(
      (want) => !rendered.includes(want),
    );
    if (missing.length > 0) {
      results.push({
        id,
        status: 'NO-CREDIT',
        detail:
          `The prerendered home page is missing part of the <litro-footer> ` +
          `credit line: ${missing.map((m) => JSON.stringify(m)).join(', ')}.\n` +
          `An empty <litro-footer> element means its registration was ` +
          `tree-shaken and SSR could not expand it. A rendered footer that is ` +
          `missing only the recipe name means the conditional binding did not ` +
          `survive server rendering. No element at all means the page template ` +
          `does not place it.`,
      });
      continue;
    }
  } else {
    const serverDir = join(dir, 'dist/server');
    const found = existsSync(serverDir) && grepDir(serverDir, 'Created using');
    if (!found) {
      results.push({
        id,
        status: 'NO-CREDIT',
        detail:
          `This variant builds a server rather than prerendering, and the ` +
          `credit line is absent from ${serverDir}. The component was almost ` +
          `certainly tree-shaken out of the SSR module graph.`,
      });
      continue;
    }
  }

  results.push({ id, status: 'OK' });
}

// ---------------------------------------------------------------------------
// 3. Report.
// ---------------------------------------------------------------------------
console.log('');
console.log('  VARIANT                 RESULT');
console.log('  ----------------------- ------------------');
for (const r of results) console.log(`  ${r.id.padEnd(23)} ${r.status}`);
console.log('');

const failures = results.filter((r) => r.status !== 'OK');
for (const f of failures) {
  console.error(`\n=== ${f.id} — ${f.status} ===\n${f.detail}\n`);
}

if (!keep) rmSync(work, { recursive: true, force: true });
else console.log(`[verify] kept ${work}`);

if (failures.length > 0) {
  console.error(`[verify] ${failures.length} of ${results.length} variants FAILED`);
  process.exit(1);
}
console.log(`[verify] all ${results.length} variants OK`);
