#!/usr/bin/env node
/**
 * check-catch-all-escape.mjs — a lint for the one shape the catch-all 404
 * pages use. It is NOT a proof that a handler is safe.
 *
 * Usage:
 *   node scripts/check-catch-all-escape.mjs              # lint tracked handlers
 *   node scripts/check-catch-all-escape.mjs --self-test  # prove the lint fires
 *
 * Every app in this repository, and every app create-litro scaffolds, carries a
 * catch-all page handler at `server/routes/[...].ts`. On a miss it writes a 404
 * page with a template literal, and that page shows the request path. Issue 295:
 * the path went in as `${pathname}`, unescaped. h3's getRequestURL() parses the
 * path with `new URL(path, base)`, which percent-encodes `<`, `>` and `"`, so it
 * stayed text by luck, not by design. `&` and `'` were never encoded, and a
 * proxy or runtime that hands the handler a decoded path would make the rest
 * reachable.
 *
 * WHERE THE REAL CHECK LIVES. `packages/create-litro/src/catch-all-handler.test.ts`
 * RUNS every tracked handler with hostile paths and asserts on the HTML it
 * returns. That is the behavioral net. This script is a fast, install-free lint
 * that catches the obvious regression (someone drops `escapeHtml(` again) and
 * keeps the 17 helper copies identical. It has known blind spots, tracked in
 * issue 299.
 *
 * WHAT IT CHECKS, for every tracked `server/routes/[...].ts`:
 *
 *   1. Every `${…}` inside a template literal that holds HTML is exactly one
 *      call, `escapeHtml(…)`, with nothing before or after it. A constant
 *      passes through the helper unchanged, so the rule costs nothing to follow.
 *   2. A file that calls `escapeHtml` defines it with exactly the canonical
 *      body below. The copies must stay identical character for character — a
 *      copy that drops the `'` line, or escapes `&` last, fails.
 *
 * WHERE IT FAILS CLOSED. HTML built in a way this lint cannot follow is
 * reported, not passed: markup in a quoted string, an HTML template joined
 * with `+` or passed through `.replace()` / `.concat()`, and a template that
 * spells `<` as an escape (`\x3c`, `\u003c`). Write the page as one template
 * literal instead.
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
  /** Quoted ('…' and "…") string bodies, for the fail-closed check. */
  const quoted = [];
  found.quoted = quoted;
  const lineOf = (index) => source.slice(0, index).split('\n').length;

  // A `/` starts a regex literal, not a division, after one of these.
  const REGEX_AFTER = /[(,=:[!&|?{};+\-*%<>~^]$|(^|[^\w$])(return|typeof|case|in|of|delete|void|throw|new)$/;

  function skipQuoted(i) {
    const quote = source[i];
    const open = i;
    i += 1;
    while (i < source.length && source[i] !== quote) {
      if (source[i] === '\\') i += 1;
      else if (source[i] === '\n') break;
      i += 1;
    }
    quoted.push({ line: lineOf(open), text: source.slice(open + 1, i) });
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
    const tpl = { line: lineOf(start), start: start - 1, end: -1, text: '', exprs: [] };
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
      if (c === '`') {
        tpl.end = i + 1;
        return i + 1;
      }
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

/**
 * True when `expr` is one `escapeHtml(…)` call and nothing else.
 *
 * A regex on the first and last characters is not enough:
 * `escapeHtml(a) + b.slice()` starts and ends right. So this finds the
 * parenthesis that closes the call, skipping strings and nested templates,
 * and requires it to be the last character.
 */
export function isWholeEscapeCall(expr) {
  if (!expr.startsWith('escapeHtml(')) return false;
  return closeOf(expr, 'escapeHtml'.length) === expr.length - 1;
}

/** Index of the `)` matching the `(` at `open`, or -1. */
function closeOf(s, open) {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    const c = s[i];
    if (c === "'" || c === '"') {
      i += 1;
      while (i < s.length && s[i] !== c) i += s[i] === '\\' ? 2 : 1;
    } else if (c === '`') {
      i = skipTemplate(s, i) - 1;
    } else if (c === '(') {
      depth += 1;
    } else if (c === ')') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Index after the template that opens at `i`. */
function skipTemplate(s, i) {
  i += 1;
  while (i < s.length) {
    if (s[i] === '\\') i += 2;
    else if (s[i] === '`') return i + 1;
    else if (s.startsWith('${', i)) {
      let depth = 1;
      i += 2;
      while (i < s.length && depth > 0) {
        if (s[i] === '`') {
          i = skipTemplate(s, i);
          continue;
        }
        if (s[i] === '{') depth += 1;
        else if (s[i] === '}') depth -= 1;
        i += 1;
      }
    } else i += 1;
  }
  return i;
}

/** `<` written as an escape, which hides markup from HOLDS_HTML. */
const ESCAPED_LT = /\\(x3c|u003c|u\{3c\})/i;

export function problemsIn(source) {
  const problems = [];
  const templates = templatesIn(source);
  for (const tpl of templates) {
    if (ESCAPED_LT.test(tpl.text)) {
      problems.push({
        line: tpl.line,
        text: 'template spells < as an escape; this lint cannot analyze it (fail closed)',
      });
      continue;
    }
    if (!HOLDS_HTML.test(tpl.text)) continue;
    for (const { line, expr } of tpl.exprs) {
      if (!isWholeEscapeCall(expr)) {
        problems.push({ line, text: `\${${expr}} is written into HTML but is not one whole escapeHtml() call` });
      }
    }
    const before = source.slice(0, tpl.start).trimEnd();
    const after = source.slice(tpl.end).trimStart();
    if (before.endsWith('+') || /^(\+|\.\s*(replace|replaceAll|concat)\b)/.test(after)) {
      problems.push({
        line: tpl.line,
        text: 'HTML template is joined or rewritten after it is built; this lint cannot analyze it (fail closed)',
      });
    }
  }
  for (const q of templates.quoted) {
    if (HOLDS_HTML.test(q.text)) {
      problems.push({
        line: q.line,
        text: 'HTML in a quoted string; this lint only analyzes template literals (fail closed)',
      });
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
    '${escapeHtml(pathname) + pathname.slice()} is written',
    '${escapeHtml(pathname) || String(url.search)} is written',
    'HTML in a quoted string',
    'joined or rewritten after it is built',
    'spells < as an escape',
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
  console.log(
    `check-catch-all-escape: OK — lint passed for ${files.length} catch-all handlers: each 404 ` +
      'template interpolation is one escapeHtml() call and each helper is the canonical copy. ' +
      'This is a lint for one shape, not a proof of safety; the behavioral check is ' +
      'packages/create-litro/src/catch-all-handler.test.ts.',
  );
  process.exit(0);
}
console.error(`check-catch-all-escape: ${problems.length} problem(s)\n`);
for (const p of problems) console.error(`  ${p.file}:${p.line}  ${p.text}`);
console.error(
  '\nA catch-all handler writes the request path into its 404 page. Build that page\n' +
    'as one template literal, put every interpolation through one escapeHtml() call,\n' +
    'and copy escapeHtml() exactly from scripts/check-catch-all-escape.mjs (issue 295).',
);
process.exit(1);
