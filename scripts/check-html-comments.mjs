#!/usr/bin/env node
/**
 * check-html-comments.mjs — keep authored HTML comments out of the wire.
 *
 * Usage:
 *   node scripts/check-html-comments.mjs              # scan tracked sources
 *   node scripts/check-html-comments.mjs --self-test  # prove the scanner fires
 *
 * An HTML comment inside an html`` template is served to every reader of every
 * page that renders it. The docs landing page carried 22 of them, 11,601 bytes,
 * 6.2% of the served HTML — design rationale written for developers and paid
 * for by readers. The longest single one was 1,521 bytes.
 *
 * So the rationale goes in a TypeScript comment BESIDE the template (a
 * `TEMPLATE NOTES` block above `return html`), never inside it. The prose is
 * kept; only the delivery changes.
 *
 * WHY NOT STRIP AT BUILD TIME. Lit's `<!--lit-part-->`, `<!--/lit-part-->` and
 * `<!--lit-node n-->` are hydration markers, not comments: they tell the client
 * runtime where a binding lives in the server-rendered DOM. A transform over
 * emitted HTML has to tell those apart from prose byte for byte, forever, and a
 * mistake breaks hydration silently. Nothing that is never written cannot be
 * stripped wrongly.
 *
 * The scanner walks tagged templates the way scripts are parsed, not with one
 * regex, because a Lit template nests: `${items.map((i) => html`…`)}` puts a
 * whole second template inside an interpolation of the first. It is the same
 * walk as `packages/create-litro/src/css-comments.test.ts`, which catches a
 * different mistake in the same place.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SELF = 'scripts/check-html-comments.mjs';
const FIXTURE = 'scripts/__fixtures__/html-comment-bad.ts';

/* ── What we scan ─────────────────────────────────────────────────────── */

const SOURCE_EXTS = /\.(ts|tsx|js|mjs|cjs)$/;
const SKIP = [
  /(^|\/)node_modules\//,
  /(^|\/)dist\//,
  /(^|\/)fixtures\//,
  /^scripts\/__fixtures__\//,
  // The e2e specs and unit tests assert ON comment markup, in ordinary string
  // literals. They render nothing to a reader.
  /\.(test|spec)\.ts$/,
  /^e2e\//,
];

function trackedFiles() {
  const out = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' });
  return out
    .split('\n')
    .filter(f => f && f !== SELF && SOURCE_EXTS.test(f) && !SKIP.some(re => re.test(f)));
}

/* ── The scanner ──────────────────────────────────────────────────────── */

/**
 * Every HTML comment that sits inside an html`` template in one source file.
 *
 * Returns `{ line, text }` per comment, where `line` is 1-based.
 */
export function htmlCommentsInTemplates(source) {
  const found = [];

  const lineOf = index => source.slice(0, index).split('\n').length;

  /** Walk one template body from `start`; return the index after its close. */
  function walkTemplate(start) {
    let i = start;
    while (i < source.length) {
      if (source.startsWith('<!--', i)) {
        const at = source.indexOf('-->', i + 4);
        const end = at === -1 ? source.length : at + 3;
        found.push({
          line: lineOf(i),
          text: source.slice(i, end).replace(/\s+/g, ' ').slice(0, 70),
        });
        if (at === -1) return source.length;
        i = end;
        continue;
      }

      // A CSS comment inside a nested css`` block is somebody else's problem.
      if (source.startsWith('/*', i)) {
        const at = source.indexOf('*/', i + 2);
        if (at === -1) return source.length;
        i = at + 2;
        continue;
      }

      if (source[i] === '\\') {
        i += 2;
        continue;
      }

      // An interpolation. Anything inside it is JavaScript, including whole
      // nested templates, so it is walked by the expression scanner.
      if (source.startsWith('${', i)) {
        i = walkExpression(i + 2);
        continue;
      }

      // Outside a comment and outside an interpolation, a backtick is the end.
      if (source[i] === '`') return i + 1;

      i += 1;
    }
    return i;
  }

  /** Walk one `${ … }` body from `start`; return the index after its close. */
  function walkExpression(start) {
    let i = start;
    let depth = 1;
    while (i < source.length && depth > 0) {
      const c = source[i];
      if (c === '{') depth += 1;
      else if (c === '}') depth -= 1;
      else if (c === '`') {
        i = walkTemplate(i + 1);
        continue;
      }
      i += 1;
    }
    return i;
  }

  // Only html`` matters. A FAST template is html<Type>`…`, so the type
  // argument is optional in the opener.
  const opener = /\bhtml(<[^`<>]*>)?`/g;
  let match;
  while ((match = opener.exec(source))) {
    opener.lastIndex = walkTemplate(match.index + match[0].length);
  }

  return found;
}

function scan(files) {
  const problems = [];
  for (const file of files) {
    const full = join(ROOT, file);
    if (!existsSync(full)) continue;
    for (const c of htmlCommentsInTemplates(readFileSync(full, 'utf8'))) {
      problems.push({ file, ...c });
    }
  }
  return problems;
}

/* ── Self-test ────────────────────────────────────────────────────────── */

// A checker nobody tests is a checker that silently stops working. The fixture
// holds one comment per shape the walk has to handle, plus the cases that must
// NOT be flagged: a TypeScript comment beside a template, a comment in a plain
// string, and lit's own hydration markers written as data.
if (process.argv.includes('--self-test')) {
  if (!existsSync(join(ROOT, FIXTURE))) {
    console.error(`self-test: fixture missing at ${FIXTURE}`);
    process.exit(1);
  }
  const found = scan([FIXTURE]);
  const mustFind = ['FLAG-PLAIN', 'FLAG-AFTER-NESTED', 'FLAG-FAST', 'FLAG-MULTILINE'];
  const mustNotFind = ['KEEP-TS-COMMENT', 'KEEP-STRING', 'KEEP-LIT-MARKER', 'KEEP-CSS'];
  const blob = found.map(f => f.text).join(' ');
  const missed = mustFind.filter(w => !blob.includes(w));
  const wrong = mustNotFind.filter(w => blob.includes(w));
  if (missed.length || wrong.length) {
    if (missed.length) console.error(`self-test FAILED — no longer caught: ${missed.join(', ')}`);
    if (wrong.length) console.error(`self-test FAILED — wrongly flagged: ${wrong.join(', ')}`);
    process.exit(1);
  }
  console.log(
    `self-test OK — ${mustFind.length} shapes caught, ${mustNotFind.length} left alone.`,
  );
  process.exit(0);
}

const problems = scan(trackedFiles());
if (problems.length === 0) {
  console.log('check-html-comments: OK — no HTML comment inside an html`` template.');
  process.exit(0);
}
console.error(`check-html-comments: ${problems.length} HTML comment(s) inside a template\n`);
for (const p of problems) console.error(`  ${p.file}:${p.line}  ${p.text}`);
console.error(
  '\nAn HTML comment in a template is served to every reader. Move the prose to a\n' +
    'TypeScript comment beside the template — a `TEMPLATE NOTES` block above\n' +
    '`return html` is the shape this repo uses. Keep the reasoning; do not delete it.',
);
process.exit(1);
