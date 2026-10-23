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
import { join, dirname, resolve, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Recipe + adapter pairs create-litro can produce.
 *
 * `flags` are extra command-line arguments handed to the scaffolder, for a
 * recipe that asks its own questions. A recipe option changes what is ON DISK
 * after the copy — supernova's `--no-blog` deletes pages, unpicks links and
 * rewrites the generated e2e spec — so each answer is a different app and
 * needs its own build.
 *
 * `id` names a variant when recipe and adapter alone no longer tell two apart.
 * It is what `--only` matches and what the report prints.
 *
 * `fixture` names extra source files written into the scaffolded app before it
 * is installed. A recipe as shipped cannot exercise a bundler fault that only
 * appears in an app of a certain SHAPE, and a check over a shape no recipe has
 * is a green check over nothing. See BARREL_FIXTURE.
 */
const VARIANTS = [
  { recipe: 'fullstack', adapter: 'lit' },
  { recipe: 'fullstack', adapter: 'elena' },
  { recipe: '11ty-blog', adapter: 'lit' },
  { recipe: 'starlight', adapter: 'lit' },
  { recipe: 'starlight', adapter: 'fast' },
  { recipe: 'starlight', adapter: 'elena' },
  { recipe: 'supernova', adapter: 'lit', id: 'supernova:lit:blog', flags: ['--blog'] },
  { recipe: 'supernova', adapter: 'lit', id: 'supernova:lit:no-blog', flags: ['--no-blog'] },
  // `--for-repo` writes its OWN server/starlight.config.js rather than copying
  // the template's, so every navigation fix has to be made twice. Nothing built
  // this path before: the unit tests pin the emitted spec text and the template
  // e2e suite runs `pnpm dev`, which serves every page file whether or not it
  // prerendered. Only a real build can tell that /docs is missing.
  { recipe: 'starlight', adapter: 'lit', id: 'starlight:lit:for-repo', flags: ['--for-repo', '.'] },
  // The same fullstack:lit app plus an app-level barrel. The plain variant above
  // stays, because both shapes have to keep working: this one exists only so the
  // HYDRATE-ORDER check has a trigger it can actually see.
  { recipe: 'fullstack', adapter: 'lit', id: 'fullstack:lit:barrel', fixture: 'barrel' },
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

/**
 * BARREL_FIXTURE — the app shape that makes Rolldown refuse to fold `lit-element`.
 *
 * WHY A FIXTURE AT ALL
 *
 * Every recipe as shipped builds clean, so a hydration-order check over the
 * recipes alone would be a green check over a trigger it cannot see. The fault
 * needs an app-level barrel: `src/lib/index.ts` that BOTH the entry and a page
 * component import, where the component pulls a barrel module the entry never
 * uses, and the barrel also re-exports a module that imports `lit`.
 *
 * All three conditions are load-bearing, and were established by removing them
 * one at a time: bypass the barrel from either side and the fault goes away;
 * have `ui-helper.ts` import a local module instead of `lit` and it goes away;
 * drop the component-only module and it goes away. The CONTENTS of the files
 * never mattered — ten variants of `polling.ts` behaved identically.
 *
 * WHAT GOES WRONG
 *
 * From Vite 8.1.6 (Rolldown 1.1.5) onward, that shape leaves `lit-element` in a
 * chunk `app.js` imports STATICALLY. A static import evaluates before the
 * importing module's own body, so the first line of `app.ts` — the hydrate
 * support import — runs second, and the one line in `lit-element` that reads
 * `globalThis.litElementHydrateSupport` sees nothing. Hydration never installs
 * for the life of the page. The build exits 0, the bundle parses, the
 * prerendered HTML is perfect, and the browser throws it all away and
 * re-renders. See BUILD-009.
 *
 * Nothing here is contrived: a `src/lib/` barrel that also exports an `html` or
 * `css` helper is what an ordinary Lit app looks like.
 */
const BARREL_FIXTURE = {
  // Used by the ENTRY, and by nothing else.
  'src/lib/session.ts': `export let user: string | null = null;

export function loadFromStorage(): void {
  user = localStorage.getItem('user');
}
`,

  // Used by a PAGE COMPONENT, never by the entry. Rolldown places this module
  // in the page's chunk, which is correct — it is consumer-local — and that
  // placement is what makes the entry's predicted import graph look cyclic.
  'src/lib/polling.ts': `export function startPolling(fn: () => void, ms: number): () => void {
  const timer = setInterval(fn, ms);
  return () => clearInterval(timer);
}
`,

  // Imports \`lit\`. Nothing has to CALL it — being re-exported by the barrel is
  // enough. Point this import at a local module instead and the fault vanishes.
  'src/lib/ui-helper.ts': `import { html } from 'lit';

export function helper(s: string) {
  return html\`<b>\${s}</b>\`;
}
`,

  // The barrel. Both sides go through this one file, which is the whole trigger.
  'src/lib/index.ts': `export { loadFromStorage, user } from './session.js';
export { startPolling } from './polling.js';
export { helper } from './ui-helper.js';
`,

  // An ordinary recipe-style component. It reaches the barrel for a module the
  // entry does not use, and stops its own timer so the fixture leaks nothing.
  'src/components/x-comp-1.ts': `import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { startPolling } from '../lib/index.js';

@customElement('x-comp-1')
export class XComp1 extends LitElement {
  override connectedCallback() {
    super.connectedCallback();
    startPolling(() => {}, 60_000)();
  }

  override render() {
    return html\`<p>barrel fixture</p>\`;
  }
}
`,

  // The page that loads the component. The page scanner turns \`pages/x1.ts\`
  // into the tag \`page-x1\` and a route whose action is a dynamic import, so
  // the component lands in a lazily-loaded chunk — as it would in a real app.
  'pages/x1.ts': `import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import '../src/components/x-comp-1.js';

@customElement('page-x1')
export class X1Page extends LitElement {
  override render() {
    return html\`
      <main>
        <h1>Barrel fixture</h1>
        <x-comp-1></x-comp-1>
      </main>
    \`;
  }
}

export default X1Page;
`,
};

/**
 * Write BARREL_FIXTURE into a scaffolded app and wire its main module to it.
 *
 * The barrel import goes into `app-main.ts`, not `app.ts`, because that is where
 * BUILD-009 says every import belongs: `app.ts` is a two-statement bootstrap
 * whose whole job is to install the hydration hook before any Lit code runs.
 * Writing it into `app.ts` instead would be a fixture of a rule violation, not
 * of an ordinary app — and it would pass the fault off as unfixed when the real
 * cause was the fixture. (That mistake was made once while building this check:
 * a barrel import in `app.ts` drags the `lit` package entry, and `lit`
 * re-exports `lit-element`, so the entry statically reaches the very module it
 * is trying to get ahead of.)
 *
 * This also asserts the bootstrap shape it depends on, so a recipe that quietly
 * loses the split fails here by name rather than producing a confusing result.
 */
function applyBarrelFixture(appDir) {
  for (const [rel, text] of Object.entries(BARREL_FIXTURE)) {
    const full = join(appDir, rel);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, text);
  }

  const bootstrap = readFileSync(join(appDir, 'app.ts'), 'utf-8');
  const mainPath = join(appDir, 'app-main.ts');
  if (!bootstrap.includes("void import('./app-main.js')") || !existsSync(mainPath)) {
    throw new Error(
      `[verify] ${join(appDir, 'app.ts')} is not a bootstrap entry that loads ` +
        `./app-main.js, so this fixture has nowhere to put an app-level import. ` +
        `Either the recipe lost the split (that is the bug — see BUILD-009) or ` +
        `applyBarrelFixture() needs updating.`,
    );
  }

  const main = readFileSync(mainPath, 'utf-8');
  writeFileSync(
    mainPath,
    `// Barrel fixture (see BARREL_FIXTURE in verify-scaffolded-apps.mjs).\n` +
      `import { loadFromStorage } from './src/lib/index.js';\n\n` +
      `${main}\nloadFromStorage();\n`,
  );
}

/**
 * The two markers that decide whether Lit hydration installed.
 *
 * `@lit-labs/ssr-client/lit-element-hydrate-support.js` patches nothing itself.
 * It only ASSIGNS `globalThis.litElementHydrateSupport`. The patch is applied by
 * `lit-element`, on one line of its own module body:
 *
 *   globalThis.litElementHydrateSupport?.({ LitElement });
 *
 * That line runs once, when `lit-element` is evaluated, and the `?.` makes a
 * missing hook a silent no-op forever. So the whole contract is: the assignment
 * must execute before that call. Both markers survive minification — the
 * property name is a global and cannot be renamed, and `?.` is the shortest
 * spelling of an optional call.
 */
const HYDRATE_INSTALL = /litElementHydrateSupport\s*=/;
const HYDRATE_CALL = /litElementHydrateSupport\s*\?\./;

/** Every emitted JavaScript file under `dir`, as paths relative to `dir`. */
function emittedScripts(dir, prefix = '') {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...emittedScripts(join(dir, entry.name), rel));
    else if (entry.isFile() && /\.(?:js|mjs)$/.test(entry.name)) out.push(rel);
  }
  return out;
}

/**
 * Specifiers a chunk imports STATICALLY, in source order.
 *
 * Covers `import x from "y"`, a bare `import "y"`, and `export ... from "y"` —
 * a re-export is a static dependency too. A dynamic `import("y")` deliberately
 * does NOT match: a `(` follows `import` there, where this pattern needs either
 * `from` or a quote. That one distinction is the entire check, so it is not
 * incidental: a dynamic import is the only thing that CANNOT run ahead of the
 * entry's body.
 */
function staticDepsOf(text) {
  const re = /(?:^|[;}\s])(?:import|export)\s*(?:[^;'"]*?\bfrom\s*)?["']([^"']+)["']/g;
  const specs = [];
  let m;
  while ((m = re.exec(text)) !== null) specs.push(m[1]);
  return specs;
}

/**
 * Flatten the entry's static import graph into EVALUATION order.
 *
 * ES modules evaluate depth-first: every static import of a module runs to
 * completion before that module's own body. So a marker's real position is the
 * pair (step in this list, byte offset within that chunk). Comparing byte
 * offsets inside `app.js` alone is not enough, and believing otherwise is
 * exactly what let this fault ship — in the broken build the call site is not
 * in `app.js` at all, it is in a chunk `app.js` imports on its first line.
 */
function staticEvaluationOrder(clientDir, entryRel) {
  const order = [];
  const seen = new Set();

  const visit = (rel) => {
    if (seen.has(rel)) return;
    seen.add(rel);
    const abs = join(clientDir, rel);
    // A bare package specifier, or anything the build did not emit here.
    if (!existsSync(abs)) return;
    const text = readFileSync(abs, 'utf-8');
    for (const spec of staticDepsOf(text)) {
      if (!spec.startsWith('.')) continue;
      visit(posix.normalize(posix.join(posix.dirname(rel), spec)));
    }
    // Pushed AFTER its dependencies, so the list reads in evaluation order.
    order.push({ rel, text });
  };

  visit(entryRel);
  return order;
}

/** Where a marker first appears in evaluation order, or null. */
function firstMarker(order, re) {
  for (let step = 0; step < order.length; step++) {
    const m = re.exec(order[step].text);
    if (m) return { chunk: order[step].rel, step, byte: m.index };
  }
  return null;
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

for (const { recipe, adapter, id: variantId, flags = [], fixture } of VARIANTS) {
  const id = variantId ?? `${recipe}:${adapter}`;
  if (only && only !== id) continue;

  const name = `app-${id.replace(/:/g, '-')}`;
  const dir = join(work, name);

  let step = run(
    'node',
    [CREATE_CLI, name,
     '--recipe', recipe, '--mode', 'ssg', '--adapter', adapter, ...flags],
    work, 'scaffold',
  );
  if (!step.ok) { results.push({ id, status: 'SCAFFOLD-FAIL', detail: step.error }); continue; }

  if (fixture === 'barrel') applyBarrelFixture(dir);

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

  // A bundle can parse perfectly and still have thrown Lit's hydration away.
  //
  // `lit-element` reads `globalThis.litElementHydrateSupport` on one line of its
  // own module body, once, and the `?.` makes a missing hook a permanent silent
  // no-op. So the hydrate-support module has to be EVALUATED first — and a
  // static import evaluates before the importing module's body, which means an
  // `import` at the top of `app.ts` does not settle it. If the bundler leaves
  // `lit-element` in a chunk `app.js` imports statically, that chunk wins and
  // every server-rendered page is discarded and re-rendered in the browser.
  //
  // Nothing else in this script can see that. The build exits 0, the bundle
  // parses, and the prerendered HTML is byte-for-byte correct, because the
  // server never consults the hook. Only the emitted chunk graph shows it.
  const clientDir = join(dir, 'dist/client');
  const scripts = emittedScripts(clientDir);
  const readChunk = (rel) => readFileSync(join(clientDir, rel), 'utf-8');
  const callSomewhere = scripts.find((rel) => HYDRATE_CALL.test(readChunk(rel)));

  // No call site means `lit-element` never reached the client — a FAST or Elena
  // app. There is no hook to install and nothing to order.
  if (callSomewhere) {
    if (!scripts.some((rel) => HYDRATE_INSTALL.test(readChunk(rel)))) {
      results.push({
        id,
        status: 'NO-HYDRATE-SUPPORT',
        detail:
          `lit-element is in the client bundle (${callSomewhere}) but nothing ` +
          `assigns globalThis.litElementHydrateSupport anywhere under ` +
          `dist/client. The app never imports ` +
          `'@lit-labs/ssr-client/lit-element-hydrate-support.js', or it was ` +
          `tree-shaken out, so no element can ever hydrate. Every page is ` +
          `re-rendered from scratch and the server's work is wasted.`,
      });
      continue;
    }

    const order = staticEvaluationOrder(clientDir, 'app.js');
    const call = firstMarker(order, HYDRATE_CALL);
    // A call site outside the entry's STATIC graph is reached only through a
    // dynamic import, which cannot run before the entry body. That is the shape
    // the bootstrap entry exists to guarantee, and it needs no further checking.
    if (call) {
      const install = firstMarker(order, HYDRATE_INSTALL);
      const tooLate =
        !install ||
        install.step > call.step ||
        (install.step === call.step && install.byte > call.byte);
      if (tooLate) {
        const where = (m) => `${m.chunk} (step ${m.step + 1} of ${order.length}, byte ${m.byte})`;
        results.push({
          id,
          status: 'HYDRATE-ORDER',
          detail:
            `Lit's hydration patch never installs, so every server-rendered ` +
            `page is thrown away and re-rendered in the browser.\n\n` +
            `  lit-element reads the hook at: ${where(call)}\n` +
            `  ssr-client assigns it at:      ` +
            `${install ? where(install) : "nowhere in the entry's static graph"}\n\n` +
            `Steps are the entry's static import graph in EVALUATION order — ` +
            `depth first, each chunk's imports before its own body — so the ` +
            `assignment has to come first on that list, not merely first in ` +
            `app.ts.\n\n` +
            `From Vite 8.1.6 (Rolldown 1.1.5) onward this happens whenever an ` +
            `app-level barrel is imported by both the entry and a page ` +
            `component: lit-element is refused from app.js and lands in a chunk ` +
            `app.js imports statically, which evaluates first.\n\n` +
            `Fix: make the client entry a two-statement bootstrap — import the ` +
            `hydrate support, then \`void import('./app-main.js')\` — so no ` +
            `static import can be hoisted ahead of it. See BUILD-009.`,
        });
        continue;
      }
    }
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

  // The card grid is the second thing a tree-shaken registration empties, and
  // it fails more quietly than the credit line: every feature title is written
  // as an ATTRIBUTE on <litro-card>, so the words are in the file whether or
  // not the element rendered. Searching the raw HTML would pass on a page that
  // draws nothing. So the subtree between <litro-card-grid> and its closing tag
  // is stripped of tags — attributes go with them — and the feature title has
  // to survive as visible text.
  if (existsSync(home)) {
    const raw = readFileSync(home, 'utf-8').replace(/<!--.*?-->/gs, '');
    const start = raw.indexOf('<litro-card-grid');
    const end = raw.indexOf('</litro-card-grid>', start);
    if (start !== -1 && end !== -1) {
      const visible = raw.slice(start, end).replace(/<[^>]*>/g, ' ');
      if (!visible.includes('Structured documentation with sidebar')) {
        results.push({
          id,
          status: 'EMPTY-CARDS',
          detail:
            'The prerendered home page places <litro-card-grid> but the cards ' +
            'inside it rendered no text. The feature titles are present only as ' +
            'attributes on unexpanded <litro-card> tags, so the block is blank ' +
            'with JavaScript off. The usual cause is the page\u2019s bare ' +
            'side-effect import of the component being tree-shaken out of the ' +
            'server bundle, which leaves the element unregistered during SSR.',
        });
        continue;
      }
    }
  }

  // Every recipe with a docs half must prerender /docs, the section landing
  // page. Without it the path a reader types, or trims a URL back to, is a
  // 404 — and a static host turns that into a 403, which reads as "forbidden"
  // rather than "no such page".
  //
  // Both checks read the index's OWN <section class="doc-group"> blocks, and
  // nothing else on the page. The sidebar renders on /docs as well and carries
  // every label and every /docs/<slug> link, and the __litro_data__ script
  // repeats the whole sidebar as JSON, which is plain text once the tags come
  // off. A check against the whole page therefore passes on an index that
  // rendered nothing at all. No group sections is also what a tree-shaken
  // registration looks like: the element prints unexpanded and emits none.
  if (recipe === 'starlight' || recipe === 'supernova') {
    const docsIndex = join(dir, 'dist/static/docs/index.html');
    if (!existsSync(docsIndex)) {
      results.push({
        id,
        status: 'NO-DOCS-INDEX',
        detail:
          `/docs did not prerender to ${docsIndex}. Only /docs/<slug> exists, ` +
          `so /docs is a 404 on a static host — a 403 on one that refuses to ` +
          `list a directory. The recipe needs pages/docs/index.ts, and the site ` +
          `navigation has to link /docs so the prerender crawler can reach it.`,
      });
      continue;
    }
    const docsHtml = readFileSync(docsIndex, 'utf-8')
      // The serialized page data repeats every sidebar label as JSON text.
      .replace(/<script\b[^>]*\bid="__litro_data__"[^>]*>[\s\S]*?<\/script>/g, ' ');
    const docsGroups = docsHtml
      .split('<section class="doc-group">')
      .slice(1)
      .map((part) => part.split('</section>')[0] ?? '');
    const docsText = docsGroups
      .join(' ')
      .replace(/<!--.*?-->/gs, '')
      .replace(/<[^>]*>/g, ' ');
    // `--for-repo` deletes the recipe's sample pages and seeds one starter, so
    // it has a single group, labeled "Documentation", with a single entry.
    // Every other variant keeps the full sample sidebar: "Start Here" and
    // "Guides". Every string below is a group heading or a link label, so it
    // exists only where the index rendered that group.
    const wantDocsText = flags.includes('--for-repo')
      ? ['Documentation', 'Getting Started']
      : ['Start Here', 'Getting Started', 'Installation', 'Guides', 'Deploying'];
    const missingDocs = wantDocsText.filter((want) => !docsText.includes(want));
    if (docsGroups.length === 0 || missingDocs.length > 0) {
      results.push({
        id,
        status: 'EMPTY-DOCS-INDEX',
        detail:
          `/docs prerendered but its group list is wrong: ` +
          `${docsGroups.length} <section class="doc-group"> block(s)` +
          (missingDocs.length > 0
            ? `, missing text ${missingDocs.map((m) => JSON.stringify(m)).join(', ')}`
            : '') +
          `. The page rendered no link labels of its own, so it is blank with ` +
          `JavaScript off.`,
      });
      continue;
    }
  }

  // A recipe option answered on the command line has to reach the BUILT site,
  // not merely the files on disk. `--no-blog` deletes pages, unpicks the
  // landing page's button and card and drops the Blog entry from the site
  // navigation; a link left behind anywhere renders into every prerendered
  // page and is a 404 the moment a reader clicks it.
  if (flags.includes('--no-blog') || flags.includes('--blog')) {
    const wantBlog = flags.includes('--blog');
    const blogIndex = join(dir, 'dist/static/blog/index.html');
    const rendered = existsSync(home)
      ? readFileSync(home, 'utf-8').replace(/<!--.*?-->/gs, '')
      : '';

    if (wantBlog && !existsSync(blogIndex)) {
      results.push({
        id,
        status: 'NO-BLOG-BUILT',
        detail: `--blog was given but ${blogIndex} was not prerendered.`,
      });
      continue;
    }

    if (!wantBlog) {
      if (existsSync(blogIndex)) {
        results.push({
          id,
          status: 'BLOG-NOT-REMOVED',
          detail: `--no-blog was given but the blog still prerendered to ${blogIndex}.`,
        });
        continue;
      }
      if (rendered.includes('/blog')) {
        results.push({
          id,
          status: 'DEAD-BLOG-LINK',
          detail:
            'The prerendered home page still links to /blog after --no-blog. ' +
            'Check removeBlog() in packages/create-litro/src/blog.ts: the ' +
            'landing page button, the feature card and the site navigation ' +
            'entry all have to go.',
        });
        continue;
      }
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
