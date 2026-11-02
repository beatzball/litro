/**
 * The page shell's scripts under `inlineScripts: false` (issue 290).
 *
 * THE GUARD. A page served with `script-src 'self'` and no `'unsafe-inline'`
 * runs only scripts that have a `src`. These tests fail when the shell gains
 * a script that `inlineScripts: false` does not turn into a file: one test
 * renders `buildShell()` across its options, and one reads `shell.ts` itself,
 * so a script behind an option the first test does not set is still caught.
 * The fix for either failure is to put the script in `SHELL_SCRIPTS`
 * (runtime/shell-scripts.ts) and write it through `scriptTag()`.
 */

import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildShell, DEFAULT_SKIP_LINKS } from '../shell.js';
import type { ShellOptions } from '../shell.js';
import {
  SHELL_SCRIPTS,
  DSD_POLYFILL,
  SKIP_LINK_SCRIPT,
  DEV_CONTENT_RELOAD_SCRIPT,
  scriptTag,
} from '../shell-scripts.js';

/** Data blocks. CSP does not apply to them. */
const DATA_TYPES = new Set(['application/json', 'application/ld+json']);

/** Every opening `<script ...>` tag in `html` that would run as inline code. */
function inlineScripts(html: string): string[] {
  const tags = html.match(/<script\b[^>]*>/gi) ?? [];
  return tags.filter(tag => {
    if (/\ssrc\s*=/i.test(tag)) return false;
    const type = tag.match(/\stype\s*=\s*["']?([^"'\s>]+)/i)?.[1]?.toLowerCase();
    return !(type && DATA_TYPES.has(type));
  });
}

/** Every combination of the options that decide which scripts the shell writes. */
function optionMatrix(): ShellOptions[] {
  const out: ShellOptions[] = [];
  for (const contentDevPolling of [false, true]) {
    for (const includeDSDPolyfill of [true, false]) {
      for (const skipLinks of [DEFAULT_SKIP_LINKS, []]) {
        out.push({
          title: 'T',
          serverDataJson: '{"a":1}',
          appScriptUrl: '/_litro/app.js?v=1',
          contentDevPolling,
          includeDSDPolyfill,
          skipLinks,
        });
      }
    }
  }
  return out;
}

const sha8 = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 8);

describe('inlineScripts: false — the guard', () => {
  it('writes no inline script for any combination of options', () => {
    for (const options of optionMatrix()) {
      const { head, foot } = buildShell('page-x', '', { ...options, inlineScripts: false });
      expect(inlineScripts(head + foot), JSON.stringify(options)).toEqual([]);
    }
  });

  it('shell.ts writes every classic script through scriptTag()', () => {
    // Reads the source, so a script behind an option the matrix above does
    // not set is still caught. Allowed: the data block and the module entry.
    const src = readFileSync(fileURLToPath(new URL('../shell.ts', import.meta.url)), 'utf-8');
    const code = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    const literals = code.match(/<script\b[^>]*>/gi) ?? [];
    const offenders = literals.filter(
      tag =>
        !/type="application\/json"/.test(tag) &&
        !/type="module" src=/.test(tag),
    );
    expect(offenders, 'write the script through scriptTag() from shell-scripts.ts').toEqual([]);
  });

  it('the guard itself sees an inline script', () => {
    expect(inlineScripts('<script>x()</script><script src="/a.js"></script>')).toEqual(['<script>']);
    expect(inlineScripts('<script type="application/ld+json">{}</script>')).toEqual([]);
    expect(inlineScripts('<script type="module">x()</script>')).toEqual(['<script type="module">']);
  });
});

describe('inlineScripts: false — what the shell writes', () => {
  const html = (o: ShellOptions = {}) => {
    const { head, foot } = buildShell('page-x', '', { inlineScripts: false, ...o });
    return head + foot;
  };

  it('loads the DSD polyfill as a synchronous classic script, before the body', () => {
    const out = html();
    const tag = `<script src="/_litro/assets/${DSD_POLYFILL.fileName}"></script>`;
    expect(out).toContain(tag);
    expect(out.indexOf(tag)).toBeLessThan(out.indexOf('<body'));
  });

  it('loads the skip-link script with defer', () => {
    expect(html()).toContain(`<script src="/_litro/assets/${SKIP_LINK_SCRIPT.fileName}" defer></script>`);
  });

  it('loads the dev content reload as a file when it is on', () => {
    expect(html({ contentDevPolling: true })).toContain(
      `<script src="/_litro/assets/${DEV_CONTENT_RELOAD_SCRIPT.fileName}"></script>`,
    );
  });

  it('uses scriptFilesUrl when given', () => {
    expect(html({ scriptFilesUrl: '/base/_litro/assets' })).toContain(
      `src="/base/_litro/assets/${DSD_POLYFILL.fileName}"`,
    );
  });

  it('leaves the app-owned head and bodyScript as given', () => {
    const out = html({ head: '<script>app()</script>', bodyScript: '<script>body()</script>' });
    expect(out).toContain('<script>app()</script>');
    expect(out).toContain('<script>body()</script>');
  });

  it('writes no source of any framework script into the page', () => {
    const out = html({ contentDevPolling: true });
    for (const s of SHELL_SCRIPTS) expect(out).not.toContain(s.source);
  });
});

describe('SHELL_SCRIPTS', () => {
  // The files are served immutable, so a name must change when its source
  // does. If this fails after editing a script, rename the file to the hash
  // the failure prints.
  it.each(SHELL_SCRIPTS.map(s => [s.fileName, s] as const))(
    '%s carries the hash of its source',
    (_name, script) => {
      expect(script.fileName).toMatch(/^litro-[a-z-]+-[0-9a-f]{8}\.js$/);
      expect(script.fileName.slice(-11, -3)).toBe(sha8(script.source));
    },
  );

  it('has unique file names', () => {
    const names = SHELL_SCRIPTS.map(s => s.fileName);
    expect(new Set(names).size).toBe(names.length);
  });

  it('scriptTag() writes the inline form by default', () => {
    expect(scriptTag(DSD_POLYFILL)).toBe(`<script>${DSD_POLYFILL.source}</script>`);
  });
});
