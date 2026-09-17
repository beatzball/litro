#!/usr/bin/env node
/**
 * check-spelling.mjs — keep the repo in American English.
 *
 * Usage:
 *   node scripts/check-spelling.mjs              # scan tracked text files
 *   node scripts/check-spelling.mjs --self-test  # prove every rule still fires
 *
 * The repo is written in American English: docs, code comments, test names,
 * error messages. British forms crept in because agents copy the spelling of
 * whatever they read last, including their own briefs. This check fails the
 * build on the common ones, so the drift stops at review instead of on `main`.
 *
 * It is a word list, not a dictionary. It only knows the forms below, and it
 * matches whole words, so `aria-labelledby` (an HTML attribute) and words like
 * `promise` or `analysis` are never flagged.
 *
 * Quoting third-party text that uses British spelling? Keep the quote exact and
 * put `spelling-ignore` anywhere on that line.
 *
 * Not scanned: CHANGELOG.md files (release history, generated from changesets),
 * lockfiles, recorded fixtures, and this script.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SELF = 'scripts/check-spelling.mjs';
const FIXTURE = 'scripts/__fixtures__/spelling-bad.md';

/* ── What we scan ─────────────────────────────────────────────────────── */

const TEXT_EXTS = /\.(md|mdx|ts|tsx|js|mjs|cjs|css|html|yml|yaml|txt)$/;
const SKIP = [
  /(^|\/)CHANGELOG\.md$/,
  /(^|\/)(pnpm-lock\.yaml|package-lock\.json)$/,
  /(^|\/)node_modules\//,
  /(^|\/)fixtures\//,
  /^scripts\/__fixtures__\//,
];

function trackedFiles() {
  const out = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' });
  return out
    .split('\n')
    .filter(f => f && f !== SELF && TEXT_EXTS.test(f) && !SKIP.some(re => re.test(f)));
}

/* ── The word list ────────────────────────────────────────────────────── */

// Each rule is a British stem and the American stem that replaces it. Endings
// are listed per rule, so a stem only matches as that word: `realis` + `e`
// matches "realise" but never "realistic".
const IZE = ['e', 'es', 'ed', 'ing', 'er', 'ers', 'ation', 'ations'];
const RULES = [
  // -ise → -ize
  ...[
    'initialis', 'normalis', 'serialis', 'deserialis', 'recognis', 'organis',
    'summaris', 'optimis', 'minimis', 'maximis', 'customis', 'prioritis',
    'authoris', 'finalis', 'standardis', 'utilis', 'visualis', 'categoris',
    'apologis', 'sanitis', 'synchronis', 'memois', 'tokenis', 'localis',
    'capitalis', 'specialis', 'stabilis', 'generalis', 'materialis', 'realis',
    'emphasis', 'criticis', 'parameteris', 'randomis', 'modularis',
  ].map(stem => ({ stem, to: stem.slice(0, -1) + 'z', endings: IZE })),
  // -yse → -yze
  ...['analys', 'paralys', 'catalys'].map(stem => ({
    stem, to: stem.slice(0, -1) + 'z', endings: ['e', 'es', 'ed', 'ing', 'er', 'ers'],
  })),
  // -our → -or
  ...[
    'colour', 'behaviour', 'favour', 'honour', 'flavour', 'neighbour', 'labour',
    'humour', 'rumour', 'harbour', 'armour', 'savour', 'endeavour', 'vapour',
  ].map(stem => ({
    stem, to: stem.replace(/our$/, 'or'),
    endings: ['', 's', 'ed', 'ing', 'ite', 'ites', 'able', 'ful', 'less', 'hood', 'hoods', 'ly'],
  })),
  // doubled consonant before -ed / -ing
  ...['model', 'label', 'cancel', 'travel', 'signal', 'fuel', 'level', 'tunnel', 'channel'].map(base => ({
    stem: base + 'l', to: base, endings: ['ed', 'ing', 'er', 'ers'],
  })),
  // single words
  { stem: 'centre', to: 'center', endings: ['', 's', 'd'] },
  { stem: 'licence', to: 'license', endings: ['', 's'] },
  { stem: 'defence', to: 'defense', endings: ['', 's'] },
  { stem: 'offence', to: 'offense', endings: ['', 's'] },
  { stem: 'catalogue', to: 'catalog', endings: ['', 's', 'd'] },
  { stem: 'judgement', to: 'judgment', endings: ['', 's'] },
  { stem: 'acknowledgement', to: 'acknowledgment', endings: ['', 's'] },
  { stem: 'artefact', to: 'artifact', endings: ['', 's'] },
  { stem: 'programme', to: 'program', endings: ['', 's'] },
  { stem: 'grey', to: 'gray', endings: [''] },
  { stem: 'whilst', to: 'while', endings: [''] },
  { stem: 'amongst', to: 'among', endings: [''] },
  { stem: 'fulfil', to: 'fulfill', endings: [''] },
  { stem: 'enrol', to: 'enroll', endings: [''] },
];

const MATCHERS = RULES.map(({ stem, to, endings }) => ({
  // Whole word, case-insensitive. The lookarounds stop a match inside a longer
  // word, e.g. `labelledby`.
  re: new RegExp(`(?<![A-Za-z])${stem}(${endings.join('|')})(?![A-Za-z])`, 'gi'),
  suggest: (word, ending) => {
    const fixed = to + ending;
    return word[0] === word[0].toUpperCase() ? fixed[0].toUpperCase() + fixed.slice(1) : fixed;
  },
}));

/* ── Scan ─────────────────────────────────────────────────────────────── */

function scan(files) {
  const problems = [];
  for (const file of files) {
    const lines = readFileSync(join(ROOT, file), 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (line.includes('spelling-ignore')) return;
      for (const { re, suggest } of MATCHERS) {
        re.lastIndex = 0;
        for (const m of line.matchAll(re)) {
          problems.push({ file, line: i + 1, word: m[0], suggestion: suggest(m[0], m[1]) });
        }
      }
    });
  }
  return problems;
}

/* ── Self-test ────────────────────────────────────────────────────────── */

// A checker nobody tests is a checker that silently stops working. The fixture
// holds one British form per rule family, plus lines that must NOT be flagged.
if (process.argv.includes('--self-test')) {
  if (!existsSync(join(ROOT, FIXTURE))) {
    console.error(`self-test: fixture missing at ${FIXTURE}`);
    process.exit(1);
  }
  const mustFind = ['Initialise', 'Behaviour', 'labelled', 'analysed', 'centre', 'judgement', 'whilst'];
  const mustNotFind = ['labelledby', 'realistic', 'promise', 'analysis', 'colours'];
  const found = scan([FIXTURE]).map(p => p.word);
  const missed = mustFind.filter(w => !found.includes(w));
  const wrong = found.filter(w => mustNotFind.some(n => w.toLowerCase().startsWith(n)));
  if (missed.length || wrong.length) {
    if (missed.length) console.error(`self-test FAILED — no longer caught: ${missed.join(', ')}`);
    if (wrong.length) console.error(`self-test FAILED — wrongly flagged: ${wrong.join(', ')}`);
    process.exit(1);
  }
  console.log(`self-test OK — ${mustFind.length} forms caught, ${mustNotFind.length} left alone.`);
  process.exit(0);
}

const problems = scan(trackedFiles());
if (problems.length === 0) {
  console.log('check-spelling: OK — no British spellings found.');
  process.exit(0);
}
console.error(`check-spelling: ${problems.length} British spelling(s)\n`);
for (const p of problems) console.error(`  ${p.file}:${p.line}  ${p.word} → ${p.suggestion}`);
console.error(
  '\nThis repo uses American English. Fix the word, or, when quoting third-party text\n' +
    'exactly, put `spelling-ignore` on that line.',
);
process.exit(1);
