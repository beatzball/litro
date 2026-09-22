/**
 * A backtick inside a CSS comment ends the template literal it is in.
 *
 * Lit styles are written as css`…` and Lit templates as html`…`. A comment
 * inside one of those is still inside a JavaScript template literal, so a
 * backtick in it — the natural way to quote a property name in prose — closes
 * the literal early. What follows is parsed as code, and the build fails with
 * something like "Expected `;` but found Identifier" pointing at a line of
 * English.
 *
 * It is a cheap mistake to make and an expensive one to read, because the
 * error names a token in the middle of a sentence and says nothing about
 * quoting. It has been made five times in this recipe's components alone.
 *
 * So: no backticks inside a comment that lives inside a tagged template. Write
 * the property name plainly, or move the note to the JSDoc block above the
 * class, which is ordinary JavaScript and may quote whatever it likes.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

/** Everything this package ships as a template, plus its own playground. */
const ROOTS = [
  '../recipes',
  '../../docs-ui/src',
  '../../../playground-supernova/src',
  '../../../playground-supernova/pages',
  '../../../docs/pages',
  '../../../docs-ssr/pages',
];

async function typeScriptFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await typeScriptFiles(full)));
    else if (entry.name.endsWith('.ts')) out.push(full);
  }
  return out;
}

/**
 * The offending comments in one file.
 *
 * It walks the source rather than matching a whole literal, and it has to for
 * two reasons. The bug ENDS the literal early, so anything that looked for the
 * closing backtick first would cut the comment in half and never see it. And a
 * Lit template nests: `${items.map((i) => html`…`)}` puts a whole second
 * template inside an interpolation of the first, so a scan that stopped at the
 * next backtick would give up at the first nested template and miss everything
 * after it — which is exactly what an earlier version of this did, while the
 * build failed on a comment further down the same file.
 *
 * So the walk steps over comments as units, tracks `${ … }` depth, and
 * recurses into a nested template when it meets one.
 */
function backtickedComments(source: string): string[] {
  const found: string[] = [];

  /** Walk one template body from `start`; return the index after its close. */
  function walkTemplate(start: number): number {
    let i = start;
    while (i < source.length) {
      const two = source.slice(i, i + 2);

      if (two === '/*' || source.startsWith('<!--', i)) {
        const close = two === '/*' ? '*/' : '-->';
        const at = source.indexOf(close, i + 2);
        const block = source.slice(i, at === -1 ? source.length : at + close.length);
        if (block.includes('`')) found.push(block.replace(/\s+/g, ' ').slice(0, 90));
        if (at === -1) return source.length;
        i = at + close.length;
        continue;
      }

      if (source[i] === '\\') {
        i += 2;
        continue;
      }

      // An interpolation. Anything inside it is JavaScript, including whole
      // nested templates, so it is walked by the expression scanner.
      if (two === '${') {
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
  function walkExpression(start: number): number {
    let i = start;
    let depth = 1;
    while (i < source.length && depth > 0) {
      const c = source[i];
      if (c === '{') depth += 1;
      else if (c === '}') depth -= 1;
      // A nested template. Its own comments are scanned by the same walk.
      else if (c === '`') {
        i = walkTemplate(i + 1);
        continue;
      }
      i += 1;
    }
    return i;
  }

  // Only css`` and html`` matter: those are the two that carry comments.
  const opener = /\b(css|html)`/g;
  let match: RegExpExecArray | null;
  while ((match = opener.exec(source))) {
    opener.lastIndex = walkTemplate(match.index + match[0].length);
  }

  return found;
}

describe('no backtick inside a comment inside a template literal', () => {
  it('finds one when there is one', () => {
    const broken = "class X { static styles = css`\n  /* a `gap` here */\n  p { color: red; }\n`; }";
    expect(backtickedComments(broken)).toHaveLength(1);
  });

  /**
   * The case the first version of this scanner got wrong: it stopped at the
   * nested template's opening backtick and never reached the comment below.
   */
  it('finds one below a nested template', () => {
    const broken = [
      'render() { return html`',
      '  <ul>${items.map((i) => html`<li>${i}</li>`)}</ul>',
      '  <!-- a `span` here -->',
      '`; }',
    ].join('\n');
    expect(backtickedComments(broken)).toHaveLength(1);
  });

  it('leaves an ordinary comment alone', () => {
    const fine = "class X { static styles = css`\n  /* a gap here */\n  p { color: red; }\n`; }";
    expect(backtickedComments(fine)).toEqual([]);
  });

  for (const root of ROOTS) {
    it(`${root} has none`, async () => {
      const dir = fileURLToPath(new URL(root, import.meta.url));
      const offenders: string[] = [];
      for (const file of await typeScriptFiles(dir)) {
        for (const block of backtickedComments(await readFile(file, 'utf-8'))) {
          offenders.push(`${file.slice(dir.length + 1)}: ${block}`);
        }
      }
      expect(offenders).toEqual([]);
    });
  }
});
