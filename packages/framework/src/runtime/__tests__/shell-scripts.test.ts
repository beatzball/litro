/**
 * The page shell's scripts under `inlineScripts: false` (issue 290).
 *
 * THE GUARD. A page served with `script-src 'self'` and no `'unsafe-inline'`
 * runs only scripts that have a `src`. It also blocks inline event handlers
 * (`onclick="..."`) and `javascript:` URLs, which no hash can allow. The
 * tests below fail when framework-written HTML gains any of these:
 *
 * - the rendered shell, across every combination of its script options, with
 *   `inlineScripts: false`;
 * - each adapter's `getHeadScripts()`, which the page handler adds to the
 *   shell's `head` (dev and production);
 * - the `shell.ts` source itself, so a script behind an option the matrix
 *   does not set is still caught.
 *
 * They also fail on a `style="..."` attribute in the shell, which CSP's
 * `style-src-attr` governs and no element hash can allow.
 *
 * What they do NOT see: HTML the app passes in (`head`, `bodyScript`,
 * `seoHead`), HTML a page component renders, and a future framework module
 * that writes into the page outside `buildShell()` and `getHeadScripts()`.
 *
 * The fix for a failure is to put the script in `SHELL_SCRIPTS`
 * (runtime/shell-scripts.ts) and write it through `scriptTag()`.
 */

import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildShell, DEFAULT_SKIP_LINKS } from '../shell.js';
import type { ShellOptions } from '../shell.js';
import { litAdapter } from '../../adapter/lit/index.js';
import { fastAdapter } from '../../adapter/fast/index.js';
import { elenaAdapter } from '../../adapter/elena/index.js';
import {
  SHELL_SCRIPTS,
  DSD_POLYFILL,
  SKIP_LINK_SCRIPT,
  DEV_CONTENT_RELOAD_SCRIPT,
  scriptTag,
} from '../shell-scripts.js';

/** Data blocks. CSP does not apply to them. */
const DATA_TYPES = new Set(['application/json', 'application/ld+json']);

/**
 * Everything in `html` that a strict policy (`script-src 'self'`, no
 * `'unsafe-inline'`, no `'unsafe-hashes'`) would block: inline `<script>`
 * elements, inline event handler attributes, `javascript:` URLs, and
 * `style` attributes.
 */
function inlineCode(html: string): string[] {
  const offenders: string[] = [];
  for (const tag of html.match(/<script\b[^>]*>/gi) ?? []) {
    if (/\ssrc\s*=/i.test(tag)) continue;
    const type = tag.match(/\stype\s*=\s*["']?([^"'\s>]+)/i)?.[1]?.toLowerCase();
    if (type && DATA_TYPES.has(type)) continue;
    offenders.push(tag);
  }
  // Attributes only: look inside tags, not in script or style bodies.
  const withoutBodies = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '<script>')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '<style>');
  for (const tag of withoutBodies.match(/<[a-z][^>]*>/gi) ?? []) {
    for (const m of tag.matchAll(/\s(on[a-z]+|style)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi)) {
      offenders.push(`${m[1]}=${m[2]}`);
    }
    for (const m of tag.matchAll(/\s[a-z-]+\s*=\s*["']?\s*javascript:[^"'\s>]*/gi)) {
      offenders.push(m[0].trim());
    }
  }
  return offenders;
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
      expect(inlineCode(head + foot), JSON.stringify(options)).toEqual([]);
    }
  });

  it.each([
    ['lit', litAdapter],
    ['fast', fastAdapter],
    ['elena', elenaAdapter],
  ] as const)('the %s adapter adds no inline code to the head', (_name, adapter) => {
    for (const isDev of [false, true]) {
      for (const basePath of ['', '/base']) {
        const head = adapter.getHeadScripts({ isDev, basePath });
        const shell = buildShell('page-x', '', {
          head: head || undefined,
          inlineScripts: false,
          includeDSDPolyfill: adapter.needsDSDPolyfill,
        });
        expect(inlineCode(shell.head + shell.foot), JSON.stringify({ isDev, basePath })).toEqual([]);
      }
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
    // No inline handler, javascript: URL or style attribute in a template.
    expect(code.match(/\son[a-z]+=["'{$]|javascript:|\sstyle=["'$]/gi) ?? []).toEqual([]);
  });

  it('the guard itself sees each kind of inline code', () => {
    expect(inlineCode('<script>x()</script><script src="/a.js"></script>')).toEqual(['<script>']);
    expect(inlineCode('<script type="application/ld+json">{}</script>')).toEqual([]);
    expect(inlineCode('<script type="module">x()</script>')).toEqual(['<script type="module">']);
    expect(inlineCode('<a href="#" onclick="x()">a</a>')).toEqual(['onclick="x()"']);
    expect(inlineCode('<a href="javascript:x()">a</a>')).toEqual(['href="javascript:x()']);
    expect(inlineCode('<div style="outline:none"></div>')).toEqual(['style="outline:none"']);
    // Text inside a script or style body is not an attribute.
    expect(inlineCode('<style>a[onclick=x]{}</style><script src="/a.js"></script>')).toEqual([]);
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
