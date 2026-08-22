#!/usr/bin/env node
/**
 * check-doc-refs — guards Markdown against citing things that do not exist.
 *
 * Two checks, both deliberately narrow so a failure is always a real bug:
 *
 *   1. REPO PATHS — an inline code span like `packages/framework/src/cli/port.ts`
 *      must resolve to a real file or directory. Only paths rooted at a known
 *      top-level repo directory are checked, so user-project-relative examples
 *      (`pages/index.ts`, `server/api/hello.ts`) are left alone.
 *
 *   2. PACKAGE IMPORTS — a named import from one of our own published packages
 *      (`import { defineConfig } from '@beatzball/litro'`) must correspond to a
 *      real export. Export names are read from the TypeScript source behind
 *      each exports-map entry (derived from its `import` target), following
 *      `export * from './x.js'` re-exports.
 *
 * Anything genuinely intentional goes in scripts/doc-refs-allow.txt.
 *
 * Usage: node scripts/check-doc-refs.mjs [--list-checked]
 * Exit code 1 if any reference fails.
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deriveSourceTarget } from './litro-source-alias.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/* ── What we scan ─────────────────────────────────────────────────────── */

// Historical PRDs (prd/, seo-prd/) are intentionally excluded: they describe
// past or planned state and carry their own "Historical document" banners.
const SCAN_FILES = [
  'README.md',
  'ARCHITECTURE.md',
  'DECISIONS.md',
  'CLAUDE.md',
  'packages/framework/README.md',
  'packages/litro-router/README.md',
  'packages/create-litro/README.md',
  'packages/litro-agent/README.md',
];
const SCAN_DIRS = ['packages/docs-content/content'];

/* ── Check 1: repo paths ──────────────────────────────────────────────── */

// A code span is only treated as a repo path when its first segment is one of
// these. Everything else is assumed to be relative to a scaffolded user app.
const TOP_DIRS = new Set([
  'packages', 'docs', 'docs-ssr', 'benchmarks', 'e2e', 'scripts', 'research',
  '.changeset', 'playground', 'playground-11ty', 'playground-fast',
  'playground-elena', 'playground-starlight', 'playground-starlight-fast',
  'playground-starlight-elena',
]);

const PATH_EXTS = /\.(ts|tsx|js|mjs|cjs|json|md|css|html|yml|yaml|png|svg|xml|txt)$/;

/** Trim the `:117`, `:20-32`, `:46,55` line-number suffixes docs use. */
function stripLineRef(ref) {
  return ref.replace(/:[\d,\s-]+$/, '');
}

function looksLikeRepoPath(raw) {
  const ref = stripLineRef(raw).trim();
  if (!ref || !ref.includes('/')) return false;
  if (/^(https?:|mailto:|@|#|\$|~|<)/.test(ref)) return false;
  if (/[{}*<>|`\s]/.test(ref)) return false;          // globs, braces, prose
  if (ref.includes('node_modules')) return false;
  const first = ref.split('/')[0];
  if (!TOP_DIRS.has(first)) return false;
  return PATH_EXTS.test(ref) || ref.endsWith('/');
}

function repoPathExists(raw) {
  const ref = stripLineRef(raw).trim().replace(/\/$/, '');
  return existsSync(join(ROOT, ref));
}

/* ── Check 2: package exports ─────────────────────────────────────────── */

const OUR_PACKAGES = [
  'packages/framework',
  'packages/litro-router',
  'packages/create-litro',
  'packages/litro-agent',
];

/** specifier ('@beatzball/litro/runtime') -> absolute source entry file */
const specifierToSource = new Map();
/** wildcard entries like "@beatzball/litro/runtime/*.js", resolved on demand */
const wildcardSubpaths = [];

/** Turn a wildcard specifier + source pattern into a concrete source file. */
function resolveWildcard(specifier) {
  for (const { specifier: pattern, sourcePattern } of wildcardSubpaths) {
    const [prefix, suffix] = pattern.split('*');
    if (!specifier.startsWith(prefix) || !specifier.endsWith(suffix)) continue;
    const star = specifier.slice(prefix.length, specifier.length - suffix.length);
    const file = sourcePattern.replace('*', star);
    if (existsSync(file)) return file;
  }
  return undefined;
}

for (const pkgDir of OUR_PACKAGES) {
  const pkgJsonPath = join(ROOT, pkgDir, 'package.json');
  if (!existsSync(pkgJsonPath)) continue;
  const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));
  const exportsMap = pkg.exports ?? {};
  for (const [subpath, cond] of Object.entries(exportsMap)) {
    if (typeof cond !== 'object' || cond === null) continue;
    // Derived from the "import" target, not a "source" condition: publishing
    // a "source" condition pointed installed apps at TypeScript that Vite
    // never transpiles, so it was removed from the packages.
    const src = deriveSourceTarget(cond.import);
    if (src === null) continue;
    const specifier = subpath === '.' ? pkg.name : `${pkg.name}/${subpath.slice(2)}`;
    if (subpath.includes('*')) {
      // e.g. "./runtime/*.js" -> "./src/runtime/*.ts": one entry per real file
      wildcardSubpaths.push({ specifier, sourcePattern: resolve(ROOT, pkgDir, src) });
    } else {
      specifierToSource.set(specifier, resolve(ROOT, pkgDir, src));
    }
  }
}

/** Collect every name a source file exports, following `export * from`. */
function collectExports(file, seen = new Set()) {
  if (seen.has(file) || !existsSync(file)) return new Set();
  seen.add(file);
  const src = readFileSync(file, 'utf-8');
  const names = new Set();

  for (const m of src.matchAll(
    /export\s+(?:declare\s+)?(?:async\s+)?(?:const|let|var|function\*?|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/g
  )) names.add(m[1]);

  if (/export\s+default/.test(src)) names.add('default');

  // export { a, b as c, type D }  — with or without a `from` clause
  for (const m of src.matchAll(/export\s+(?:type\s+)?\{([^}]*)\}/g)) {
    for (const part of m[1].split(',')) {
      const cleaned = part.trim().replace(/^type\s+/, '');
      if (!cleaned) continue;
      const asMatch = cleaned.match(/\s+as\s+([A-Za-z_$][\w$]*)$/);
      names.add(asMatch ? asMatch[1] : cleaned.split(/\s+/)[0]);
    }
  }

  // export * from './x.js'  — recurse into the re-exported module
  for (const m of src.matchAll(/export\s+\*\s+(?:as\s+[\w$]+\s+)?from\s*['"](\.[^'"]+)['"]/g)) {
    for (const n of collectExports(resolveRelativeSource(file, m[1]), seen)) names.add(n);
  }

  return names;
}

function resolveRelativeSource(fromFile, spec) {
  const base = resolve(dirname(fromFile), spec);
  for (const candidate of [
    base.replace(/\.js$/, '.ts'),
    base.replace(/\.js$/, '.tsx'),
    base,
    `${base}.ts`,
    join(base, 'index.ts'),
  ]) if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  return base;
}

const exportCache = new Map();
function exportsOf(specifier) {
  if (!exportCache.has(specifier)) {
    const src = specifierToSource.get(specifier) ?? resolveWildcard(specifier);
    exportCache.set(specifier, src ? collectExports(src) : null);
  }
  return exportCache.get(specifier);
}

/* ── Check 3: custom element tags ─────────────────────────────────────── */

// Only tags with prefixes WE own are checked. A reader's own `<my-counter>`
// example is none of our business.
const OWNED_TAG_PREFIXES = ['litro-', 'starlight-'];
const TAG_SOURCE_DIRS = [
  'packages/framework/src', 'packages/litro-router/src', 'packages/docs-ui/src',
  'packages/litro-agent/src', 'docs/pages', 'docs-ssr/pages',
];

const definedTags = new Set();
for (const dir of TAG_SOURCE_DIRS) {
  const abs = join(ROOT, dir);
  if (!existsSync(abs)) continue;
  const walk = (d) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, entry.name);
      if (entry.isDirectory()) { walk(p); continue; }
      if (!/\.(ts|tsx|js)$/.test(entry.name)) continue;
      const src = readFileSync(p, 'utf-8');
      for (const m of src.matchAll(/@customElement\(\s*['"]([a-z][\w-]*)['"]/g)) definedTags.add(m[1]);
      for (const m of src.matchAll(/customElements\.define\(\s*['"]([a-z][\w-]*)['"]/g)) definedTags.add(m[1]);
      // FAST/Elena style: name: 'litro-thing' inside a definition object
      for (const m of src.matchAll(/name:\s*['"]((?:litro|starlight)-[\w-]*)['"]/g)) definedTags.add(m[1]);
    }
  };
  walk(abs);
}

function isOwnedTag(tag) {
  return OWNED_TAG_PREFIXES.some(prefix => tag.startsWith(prefix));
}

/* ── Allowlist ────────────────────────────────────────────────────────── */

const allowFile = join(ROOT, 'scripts', 'doc-refs-allow.txt');
const allow = new Set();
if (existsSync(allowFile)) {
  for (const line of readFileSync(allowFile, 'utf-8').split('\n')) {
    const t = line.trim();
    if (t && !t.startsWith('#')) allow.add(t);
  }
}

/* ── Scan ─────────────────────────────────────────────────────────────── */

function collectMarkdown() {
  const files = SCAN_FILES.filter(f => existsSync(join(ROOT, f)));
  for (const dir of SCAN_DIRS) {
    const abs = join(ROOT, dir);
    if (!existsSync(abs)) continue;
    const walk = (d) => {
      for (const entry of readdirSync(d, { withFileTypes: true })) {
        const p = join(d, entry.name);
        if (entry.isDirectory()) walk(p);
        else if (entry.name.endsWith('.md')) files.push(relative(ROOT, p));
      }
    };
    walk(abs);
  }
  return files;
}

function scan(files) {
  const problems = [];
  for (const rel of files) {
    const lines = readFileSync(join(ROOT, rel), 'utf-8').split('\n');
  let inFence = false;
  let fenceLang = '';

  lines.forEach((line, i) => {
    const lineNo = i + 1;
    const fence = line.match(/^\s*```+\s*([\w-]*)/);
    if (fence) {
      if (inFence) { inFence = false; fenceLang = ''; }
      else { inFence = true; fenceLang = fence[1].toLowerCase(); }
      return;
    }

    // Check 1 runs on prose only. Directory trees inside fences are
    // illustrative, not real paths.
    if (!inFence) {
      for (const m of line.matchAll(/`([^`\n]+)`/g)) {
        const raw = m[1];
        if (allow.has(raw) || !looksLikeRepoPath(raw)) continue;
        if (!repoPathExists(raw)) {
          problems.push({ rel, lineNo, kind: 'missing path', detail: raw });
        }
      }
    }

    // Check 3: a `<litro-*>` / `<starlight-*>` tag must be a real element.
    // Runs everywhere, including fences — a copy-pasted example that names a
    // nonexistent element is exactly the bug worth catching.
    for (const m of line.matchAll(/<((?:litro|starlight)-[a-z][\w-]*)[\s/>]/g)) {
      const tag = m[1];
      if (allow.has(tag) || !isOwnedTag(tag)) continue;
      if (!definedTags.has(tag)) {
        problems.push({ rel, lineNo, kind: 'unknown element', detail: `<${tag}>` });
      }
    }

    // Check 2 runs on TypeScript/JavaScript fences.
    const isCodeLang = ['ts', 'tsx', 'js', 'jsx', 'typescript', 'javascript'].includes(fenceLang);
    if (inFence && isCodeLang) {
      // The published package is @beatzball/litro; a bare `litro` import is a
      // copy-paste trap that installs someone else's package.
      const bare = line.match(/from\s*['"](litro(?:-router)?(?:\/[^'"]*)?)['"]/);
      if (bare && !allow.has(bare[1])) {
        problems.push({ rel, lineNo, kind: 'wrong package name', detail: `'${bare[1]}' should be '@beatzball/${bare[1]}'` });
      }

      const imp = line.match(/import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"](@beatzball\/[^'"]+)['"]/);
      if (imp) {
        const specifier = imp[2];
        const available = exportsOf(specifier);
        if (available === null) {
          if (!allow.has(specifier)) {
            problems.push({ rel, lineNo, kind: 'unknown subpath', detail: specifier });
          }
        } else {
          for (const part of imp[1].split(',')) {
            const name = part.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim();
            if (!name) continue;
            const key = `${specifier}#${name}`;
            if (allow.has(key) || allow.has(name)) continue;
            if (!available.has(name)) {
              problems.push({ rel, lineNo, kind: 'not exported', detail: key });
            }
          }
        }
      }
    }
  });
}

  return problems;
}

/* ── Self-test ────────────────────────────────────────────────────────── */

// A checker nobody tests is a checker that silently stops working. This runs
// the real scan over a fixture of known-bad references and fails loudly if any
// of them stops being detected.
if (process.argv.includes('--self-test')) {
  const fixture = 'scripts/__fixtures__/doc-refs-bad.md';
  if (!existsSync(join(ROOT, fixture))) {
    console.error(`self-test: fixture missing at ${fixture}`);
    process.exit(1);
  }
  const expected = ['missing path', 'not exported', 'unknown element', 'wrong package name'];
  const found = scan([fixture]);
  const kinds = new Set(found.map(p => p.kind));
  const missed = expected.filter(k => !kinds.has(k));
  for (const p of found) console.log(`  detected: [${p.kind}] ${p.detail}`);
  if (missed.length) {
    console.error(`\nself-test FAILED — these checks no longer fire: ${missed.join(', ')}`);
    process.exit(1);
  }
  console.log(`\nself-test OK — all ${expected.length} check kinds fire on the fixture.`);
  process.exit(0);
}

/* ── Report ───────────────────────────────────────────────────────────── */

const checkedFiles = collectMarkdown();
const problems = scan(checkedFiles);

if (process.argv.includes('--list-checked')) {
  console.log(`Scanning ${checkedFiles.length} Markdown files:`);
  for (const f of checkedFiles) console.log(`  ${f}`);
  console.log(`\nKnown package specifiers: ${[...specifierToSource.keys()].sort().join(', ')}\n`);
}

if (problems.length === 0) {
  console.log(`check-doc-refs: OK — ${checkedFiles.length} Markdown files, no broken references.`);
  process.exit(0);
}

console.error(`check-doc-refs: ${problems.length} broken reference(s)\n`);
for (const p of problems) {
  console.error(`  ${p.rel}:${p.lineNo}  [${p.kind}]  ${p.detail}`);
}
console.error(`
How to fix:
  - "missing path"    the file was moved or never existed. Correct the path.
  - "not exported"    the docs invent an API. Use a real export, or add the
                      export if the docs describe intended behaviour.
  - "unknown subpath" the package exports map has no such entry.
  - "unknown element"  no @customElement/customElements.define declares this tag.
  - "wrong package"    published packages are scoped: @beatzball/litro.

If a reference is intentional (illustrative or forward-looking), add the exact
string shown above to scripts/doc-refs-allow.txt with a comment saying why.
`);
process.exit(1);
