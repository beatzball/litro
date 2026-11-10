#!/usr/bin/env node
/**
 * check-catch-all-escape.mjs — keep the request path out of the 404 page's
 * markup.
 *
 * Usage:
 *   node scripts/check-catch-all-escape.mjs              # scan tracked handlers
 *   node scripts/check-catch-all-escape.mjs --self-test  # prove the scanner fires
 *
 * Every app in this repository, and every app create-litro scaffolds, carries a
 * catch-all page handler at `server/routes/[...].ts`. On a miss it writes a 404
 * page with a template literal, and that page shows the request path. Issue 295:
 * the path went in as `${pathname}`, unescaped. A browser percent-encodes `<`,
 * `>` and `"` in a path, so it stayed text by luck, not by design. `&` and `'`
 * were never encoded, and a proxy or runtime that decodes the path would have
 * made the rest reachable too.
 *
 * THE RULE, for every tracked `server/routes/[...].ts`:
 *
 *   1. Every `${…}` inside a template literal that holds HTML is a call to
 *      `escapeHtml(…)`. Strict on purpose: a constant passes through the
 *      helper unchanged, so the rule costs nothing to follow, and a reader
 *      never has to decide which value came from the request.
 *   2. A file that calls `escapeHtml` defines it with exactly the canonical
 *      body below. The handler is copied into 17 places and scaffolded into
 *      every new app, so the copies must stay identical character for
 *      character — a copy that drops the `'` line, or escapes `&` last, fails.
 *
 * The scanner walks the source the way a tokenizer does, skipping comments,
 * quoted strings and regex literals, because the handlers' route matcher holds
 * `${` inside a regex (`/[.*+?^${}()|[\]\\]/g`) that is not a template.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE_BAD = 'scripts/__fixtures__/catch-all-escape-bad.ts';
const FIXTURE_GOOD = 'scripts/__fixtures__/catch-all-escape-good.ts';

/** The one helper every catch-all handler carries. See rule 2 above. */
export const CANONICAL_HELPER = `function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}`;

/* ── What we scan ─────────────────────────────────────────────────────── */

const HANDLER = /(^|\/)server\/routes\/\[\.\.\.\]\.ts$/;

function trackedHandlers() {
  const out = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' });
  return out.split('\n').filter((f) => f && HANDLER.test(f));
}

/* ── The scanner ──────────────────────────────────────────────────────── */

/**
 * Every template literal in a source file, with its interpolations.
 *
 * Returns `{ line, text, exprs: [{ line, expr }] }` per template. `text` is the
 * literal part only. A template nested inside an interpolation is returned on
 * its own as well.
 */
export function templatesIn(source) {
  const found = [];
  const lineOf = (index) => source.slice(0, index).split('\n').length;

  // A `/` starts a regex literal, not a division, after one of these.
  const REGEX_AFTER = /[(,=:[!&|?{};+\-*%<>~^]$|(^|[^\w$])(return|typeof|case|in|of|delete|void|throw|new)$/;

  function skipQuoted(i) {
    const quote = source[i];
    i += 1;
    while (i < source.length && source[i] !== quote) {
      if (source[i] === '\\') i += 1;
      else if (source[i] === '\n') break;
      i += 1;
    }
    return i + 1;
  }

  function skipRegex(i) {
    i += 1;
    let inClass = false;
    while (i < source.length) {
      const c = source[i];
      if (c === '\\') i += 2;
      else if (c === '[') (inClass = true), (i += 1);
      else if (c === ']') (inClass = false), (i += 1);
      else if (c === '/' && !inClass) return i + 1;
      else if (c === '\n') return i;
      else i += 1;
    }
    return i;
  }

  /** Walk JavaScript from `start` until an unmatched `}` (or the end). */
  function walkCode(start, stopAtBrace) {
    let i = start;
    let depth = 0;
    while (i < source.length) {
      const c = source[i];
      if (source.startsWith('//', i)) {
        const nl = source.indexOf('\n', i);
        i = nl === -1 ? source.length : nl;
        continue;
      }
      if (source.startsWith('/*', i)) {
        const end = source.indexOf('*/', i + 2);
        i = end === -1 ? source.length : end + 2;
        continue;
      }
      if (c === "'" || c === '"') {
        i = skipQuoted(i);
        continue;
      }
      if (c === '`') {
        i = walkTemplate(i + 1);
        continue;
      }
      if (c === '/') {
        const before = source.slice(Math.max(0, i - 12), i).replace(/\s+$/, '');
        if (before === '' || REGEX_AFTER.test(before)) {
          i = skipRegex(i);
          continue;
        }
      }
      if (c === '{') depth += 1;
      if (c === '}') {
        if (stopAtBrace && depth === 0) return i + 1;
        depth -= 1;
      }
      i += 1;
    }
    return i;
  }

  /** Walk one template body from `start`; return the index after its close. */
  function walkTemplate(start) {
    const tpl = { line: lineOf(start), text: '', exprs: [] };
    found.push(tpl);
    let i = start;
    while (i < source.length) {
      const c = source[i];
      if (c === '\\') {
        tpl.text += source.slice(i, i + 2);
        i += 2;
        continue;
      }
      if (source.startsWith('${', i)) {
        const end = walkCode(i + 2, true);
        tpl.exprs.push({ line: lineOf(i), expr: source.slice(i + 2, end - 1).trim() });
        i = end;
        continue;
      }
      if (c === '`') return i + 1;
      tpl.text += c;
      i += 1;
    }
    return i;
  }

  walkCode(0, false);
  return found;
}

/** A template that holds markup: a tag opener, a closing tag, or a doctype. */
const HOLDS_HTML = /<[a-zA-Z!/]/;

/** `escapeHtml(<anything>)` and nothing around it. */
const ESCAPED = /^escapeHtml\(([\s\S]*)\)$/;

export function problemsIn(source) {
  const problems = [];
  for (const tpl of templatesIn(source)) {
    if (!HOLDS_HTML.test(tpl.text)) continue;
    for (const { line, expr } of tpl.exprs) {
      if (!ESCAPED.test(expr)) {
        problems.push({ line, text: `\${${expr}} is written into HTML without escapeHtml()` });
      }
    }
  }
  if (/\bescapeHtml\(/.test(source) && !source.includes(CANONICAL_HELPER)) {
    const at = source.search(/function escapeHtml\b/);
    problems.push({
      line: at === -1 ? 1 : source.slice(0, at).split('\n').length,
      text:
        at === -1
          ? 'calls escapeHtml() but does not define it'
          : 'escapeHtml() differs from the canonical helper',
    });
  }
  return problems;
}

function scan(files) {
  const problems = [];
  for (const file of files) {
    const full = join(ROOT, file);
    if (!existsSync(full)) continue;
    for (const p of problemsIn(readFileSync(full, 'utf8'))) problems.push({ file, ...p });
  }
  return problems;
}

/* ── Self-test ────────────────────────────────────────────────────────── */

// A checker nobody tests is a checker that silently stops working. The bad
// fixture holds one mistake per shape; the good one holds the shapes that must
// pass, including the route matcher's regex with `${` inside it.
if (process.argv.includes('--self-test')) {
  for (const f of [FIXTURE_BAD, FIXTURE_GOOD]) {
    if (!existsSync(join(ROOT, f))) {
      console.error(`self-test: fixture missing at ${f}`);
      process.exit(1);
    }
  }
  const bad = scan([FIXTURE_BAD]);
  const good = scan([FIXTURE_GOOD]);
  const mustFind = [
    '${pathname} is written',
    '${url.search} is written',
    '${String(escapeHtml(pathname))} is written',
    'differs from the canonical helper',
  ];
  const blob = bad.map((p) => p.text).join('\n');
  const missed = mustFind.filter((w) => !blob.includes(w));
  if (missed.length || good.length) {
    for (const m of missed) console.error(`self-test FAILED — no longer caught: ${m}`);
    for (const g of good) console.error(`self-test FAILED — wrongly flagged: line ${g.line} ${g.text}`);
    process.exit(1);
  }
  console.log(`self-test OK — ${mustFind.length} mistakes caught, the good fixture left alone.`);
  process.exit(0);
}

const files = trackedHandlers();
if (files.length === 0) {
  // A guard on the guard: if the pattern stops matching, the check passes vacuously.
  console.error('check-catch-all-escape: no server/routes/[...].ts is tracked — the pattern is wrong');
  process.exit(1);
}
const problems = scan(files);
if (problems.length === 0) {
  console.log(`check-catch-all-escape: OK — ${files.length} catch-all handlers escape what they write.`);
  process.exit(0);
}
console.error(`check-catch-all-escape: ${problems.length} problem(s)\n`);
for (const p of problems) console.error(`  ${p.file}:${p.line}  ${p.text}`);
console.error(
  '\nA catch-all handler writes the request path into its 404 page, so every\n' +
    'interpolation in its HTML goes through escapeHtml(), and escapeHtml() is the\n' +
    'canonical helper in scripts/check-catch-all-escape.mjs, copied exactly (issue 295).',
);
process.exit(1);
