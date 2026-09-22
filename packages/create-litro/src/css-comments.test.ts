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
 * It walks the source character by character rather than matching the whole
 * literal, and it has to: the bug ENDS the literal early, so anything that
 * looked for the closing backtick first would cut the comment in half and
 * never see it. Instead the walk steps over comments as units, and a backtick
 * found inside one is the finding; a backtick found outside one is the end of
 * the template.
 */
function backtickedComments(source: string): string[] {
  const found: string[] = [];
  // Only css`` and html`` matter: those are the two that carry comments.
  const opener = /\b(css|html)`/g;
  let match: RegExpExecArray | null;

  while ((match = opener.exec(source))) {
    let i = match.index + match[0].length;

    while (i < source.length) {
      const two = source.slice(i, i + 2);
      const four = source.slice(i, i + 4);

      if (two === '/*' || four === '<!--') {
        const close = two === '/*' ? '*/' : '-->';
        const at = source.indexOf(close, i + 2);
        const block = source.slice(i, at === -1 ? source.length : at + close.length);
        if (block.includes('`')) found.push(block.replace(/\s+/g, ' ').slice(0, 90));
        if (at === -1) break;
        i = at + close.length;
        continue;
      }

      if (source[i] === '\\') {
        i += 2;
        continue;
      }

      // A backtick outside a comment closes the template.
      if (source[i] === '`') break;

      i += 1;
    }

    opener.lastIndex = i + 1;
  }

  return found;
}

describe('no backtick inside a comment inside a template literal', () => {
  it('finds one when there is one', () => {
    const broken = "class X { static styles = css`\n  /* a `gap` here */\n  p { color: red; }\n`; }";
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
