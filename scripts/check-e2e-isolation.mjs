#!/usr/bin/env node
/**
 * check-e2e-isolation — stops one e2e spec from deleting another's live state.
 *
 * The e2e suite runs `fullyParallel`, and several specs spawn their own dev
 * server inside a workspace app directory that a SHARED dev server is already
 * serving other specs from. Any spec that deletes a path inside such a
 * directory is therefore deleting files a concurrently running server may be
 * reading or writing right now.
 *
 * That is not hypothetical: issue #118. `e2e/playground/agent-resume.spec.ts`
 * wiped `playground/.litro/` around its test while the shared playground
 * server on port 3030 kept its agent session logs in that same directory. All
 * three tests in `e2e/playground/agent.spec.ts` went red together whenever the
 * wipe landed mid-test — including the browserless one — and the failure was
 * invisible locally because it depends on which specs happen to overlap.
 *
 * THE RULE: a spec may delete only inside `test-results/`, `e2e/test-results/`
 * or the OS temp directory. Anywhere else, give the spec its own directory
 * (for session logs: the `LITRO_AGENT_SESSIONS_DIR` env var) and delete that.
 *
 * The check is deliberately narrow — it only looks at delete calls, and only
 * at targets it can resolve statically — so a failure is always a real bug. A
 * target it cannot resolve is also reported: an unreadable delete target in a
 * parallel suite is exactly the thing this check exists to prevent.
 *
 * Usage: node scripts/check-e2e-isolation.mjs [--self-test]
 * Exit code 1 if any spec deletes outside the allowed directories.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const E2E_DIR = join(ROOT, 'e2e');

/** Deleting inside these is fine — they hold nothing a server serves. */
const ALLOWED = [join(ROOT, 'test-results'), join(ROOT, 'e2e', 'test-results')];

/** fs functions that remove things. */
const DESTRUCTIVE = ['rm', 'rmSync', 'rmdir', 'rmdirSync', 'unlink', 'unlinkSync'];

/* ── Resolving a delete target ────────────────────────────────────────── */

// A value is either a concrete absolute path, the OS temp directory (always
// allowed, and its exact location does not matter), or unresolvable.
const TMP = { kind: 'tmp' };
const UNKNOWN = { kind: 'unknown' };
const asPath = (value) => ({ kind: 'path', value });

/** Splits an argument list on top-level commas (parens/quotes aware). */
function splitArgs(src) {
  const out = [];
  let depth = 0;
  let quote = '';
  let current = '';
  for (const ch of src) {
    if (quote) {
      current += ch;
      if (ch === quote) quote = '';
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    if (ch === ')' || ch === ']' || ch === '}') depth--;
    if (ch === ',' && depth === 0) {
      out.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

/** Evaluates the small subset of expressions specs use to build a path:
 *  string literals, `__dirname`, `tmpdir()`/`mkdtemp(...)`, previously
 *  declared consts, and `path.join`/`path.resolve` over those. */
function evaluate(expr, vars, specDir) {
  const src = expr.trim();

  const literal = /^(['"])(.*)\1$/.exec(src);
  if (literal) return asPath(literal[2]);

  if (src === '__dirname') return asPath(specDir);
  if (/^(os\.)?tmpdir\(\)$/.test(src)) return TMP;
  if (/^(await\s+)?mkdtemp\(/.test(src)) return TMP;

  if (/^[A-Za-z_$][\w$]*$/.test(src)) return vars.get(src) ?? UNKNOWN;

  const call = /^(?:path\.)?(join|resolve)\(([\s\S]*)\)$/.exec(src);
  if (call) {
    const parts = splitArgs(call[2]).map((a) => evaluate(a, vars, specDir));
    if (parts.some((p) => p.kind === 'unknown')) return UNKNOWN;
    if (parts.some((p) => p.kind === 'tmp')) return TMP;
    return asPath(resolve(...parts.map((p) => p.value)));
  }

  return UNKNOWN;
}

/** Collects `const NAME = <expr>;` bindings, in source order, so later
 *  declarations can refer to earlier ones. */
function collectVars(source, specDir) {
  const vars = new Map();
  const re = /^\s*const\s+([A-Za-z_$][\w$]*)\s*=\s*([^;\n]+);/gm;
  for (const m of source.matchAll(re)) vars.set(m[1], evaluate(m[2], vars, specDir));
  return vars;
}

/** Every delete call in a spec, with its target resolved. */
function findDeletes(source, specDir) {
  const vars = collectVars(source, specDir);
  const found = [];
  const re = new RegExp(String.raw`\b(${DESTRUCTIVE.join('|')})\s*\(`, 'g');
  for (const m of source.matchAll(re)) {
    // Skip the import statement / the function's own definition.
    const lineStart = source.lastIndexOf('\n', m.index) + 1;
    const line = source.slice(lineStart, source.indexOf('\n', m.index));
    if (/^\s*(import|export|function)\b/.test(line)) continue;

    const argSrc = source.slice(m.index + m[0].length);
    const end = matchingParen(argSrc);
    if (end === -1) continue;
    const [first] = splitArgs(argSrc.slice(0, end));
    found.push({
      fn: m[1],
      line: source.slice(0, m.index).split('\n').length,
      target: first === undefined ? UNKNOWN : evaluate(first, vars, specDir),
      source: line.trim(),
    });
  }
  return found;
}

/** Index of the `)` closing the call whose `(` was just consumed. */
function matchingParen(src) {
  let depth = 0;
  let quote = '';
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quote) {
      if (ch === quote) quote = '';
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') quote = ch;
    else if (ch === '(') depth++;
    else if (ch === ')') {
      if (depth === 0) return i;
      depth--;
    }
  }
  return -1;
}

function isAllowed(target) {
  if (target.kind === 'tmp') return true;
  if (target.kind !== 'path') return false;
  const path = isAbsolute(target.value) ? target.value : resolve(ROOT, target.value);
  // Outside the repo entirely (a scratch dir elsewhere) is not our business.
  if (relative(ROOT, path).startsWith('..')) return true;
  return ALLOWED.some((allowed) => path === allowed || !relative(allowed, path).startsWith('..'));
}

/* ── Runner ───────────────────────────────────────────────────────────── */

function specFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...specFiles(full));
    else if (entry.endsWith('.spec.ts')) out.push(full);
  }
  return out;
}

function checkSource(source, specPath) {
  return findDeletes(source, dirname(specPath))
    .filter((del) => !isAllowed(del.target))
    .map((del) => ({
      ...del,
      file: relative(ROOT, specPath),
      why:
        del.target.kind === 'path'
          ? `deletes ${relative(ROOT, resolve(ROOT, del.target.value))}`
          : 'delete target could not be resolved statically',
    }));
}

function selfTest() {
  const spec = join(E2E_DIR, 'playground', 'fixture.spec.ts');
  const cases = [
    [
      "const repoRoot = path.resolve(__dirname, '../..');\n" +
        "const d = path.join(repoRoot, 'e2e/test-results/mine');\n" +
        'await rm(d, { recursive: true });',
      0,
    ],
    ["const dir = await mkdtemp(join(tmpdir(), 'x'));\nawait rm(dir, { recursive: true });", 0],
    // The issue #118 shape: wiping state a shared dev server is using.
    [
      "const repoRoot = path.resolve(__dirname, '../..');\n" +
        "const playgroundDir = path.join(repoRoot, 'playground');\n" +
        "const litroDataDir = path.join(playgroundDir, '.litro');\n" +
        'await rm(litroDataDir, { recursive: true, force: true });',
      1,
    ],
    ["await rm(process.env.SOMETHING, { recursive: true });", 1],
    ['await rm(join(repoRoot, "docs/dist"));', 1],
  ];
  let failures = 0;
  for (const [source, expected] of cases) {
    const got = checkSource(source, spec).length;
    if (got !== expected) {
      failures++;
      console.error(`self-test: expected ${expected} finding(s), got ${got} for:\n${source}\n`);
    }
  }
  if (failures > 0) {
    console.error(`check-e2e-isolation self-test FAILED (${failures} case(s))`);
    process.exit(1);
  }
  console.log(`check-e2e-isolation self-test passed (${cases.length} cases)`);
}

if (process.argv.includes('--self-test')) {
  selfTest();
} else {
  // The self-test runs first, every time: a checker that has quietly stopped
  // matching anything would otherwise pass forever.
  selfTest();
  const findings = specFiles(E2E_DIR).flatMap((file) => checkSource(readFileSync(file, 'utf-8'), file));
  if (findings.length > 0) {
    console.error('\ne2e specs may only delete inside test-results/ or the OS temp dir.\n');
    for (const f of findings) {
      console.error(`  ${f.file}:${f.line}  ${f.why}\n    ${f.source}`);
    }
    console.error(
      '\nGive the spec its own directory instead (for agent session logs: the\n' +
        'LITRO_AGENT_SESSIONS_DIR env var on the server it spawns) and delete that.\n' +
        'See issue #118.\n',
    );
    process.exit(1);
  }
  console.log(`check-e2e-isolation: ${specFiles(E2E_DIR).length} spec files, no cross-spec deletes`);
}
