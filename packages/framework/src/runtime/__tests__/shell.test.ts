/**
 * Unit tests for buildShell() in shell.ts.
 *
 * buildShell() is a pure function (string in, string out) so no mocking is
 * required — it runs in the default Node environment.
 *
 * Run with: pnpm --filter litro test
 */

import { describe, it, expect } from 'vitest';
import { buildShell } from '../shell.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Call buildShell with minimal required arguments. */
function buildDefault(
  componentTag = 'page-home',
  options?: Parameters<typeof buildShell>[2],
) {
  return buildShell(componentTag, '', options);
}

// ---------------------------------------------------------------------------
// Return shape
// ---------------------------------------------------------------------------

describe('buildShell — return shape', () => {
  it('returns an object with head and foot string properties', () => {
    const shell = buildDefault();
    expect(shell).toHaveProperty('head');
    expect(shell).toHaveProperty('foot');
    expect(typeof shell.head).toBe('string');
    expect(typeof shell.foot).toBe('string');
  });

  it('head is non-empty', () => {
    const { head } = buildDefault();
    expect(head.length).toBeGreaterThan(0);
  });

  it('foot is non-empty', () => {
    const { foot } = buildDefault();
    expect(foot.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// head — DSD polyfill
// ---------------------------------------------------------------------------

describe('buildShell — head: DSD polyfill', () => {
  it('contains an inline <script> tag with the DSD polyfill', () => {
    const { head } = buildDefault();
    // The polyfill checks for shadowRootMode on HTMLTemplateElement
    expect(head).toContain('HTMLTemplateElement.prototype.hasOwnProperty');
  });

  it('polyfill is a plain (non-module) <script> tag', () => {
    const { head } = buildDefault();
    // Must be a synchronous inline script, NOT type="module" — deferred
    // scripts arrive after the parser processes DSD templates.
    // Locate the polyfill script (contains MutationObserver or shadowRootMode)
    const polyfillScriptMatch = head.match(/<script>([^<]*MutationObserver[^<]*)<\/script>/);
    expect(polyfillScriptMatch).not.toBeNull();
    // Confirm there is no type="module" on this specific script tag
    expect(head).not.toMatch(/<script[^>]*type="module"[^>]*>[^<]*MutationObserver/);
  });

  it('polyfill uses a MutationObserver', () => {
    const { head } = buildDefault();
    expect(head).toContain('MutationObserver');
  });
});

// ---------------------------------------------------------------------------
// head — hydration support script ordering
// ---------------------------------------------------------------------------

describe('buildShell — head: hydration support script', () => {
  it('contains the lit-element-hydrate-support.js module script', () => {
    const { head } = buildDefault();
    expect(head).toContain('lit-element-hydrate-support.js');
  });

  it('hydration support script is type="module"', () => {
    const { head } = buildDefault();
    expect(head).toContain(
      '<script type="module" src="/_litro/lit-element-hydrate-support.js">',
    );
  });

  it('hydration support script appears BEFORE the closing </head> tag', () => {
    const { head } = buildDefault();
    const hydrationIdx = head.indexOf('lit-element-hydrate-support.js');
    const headCloseIdx = head.indexOf('</head>');
    expect(hydrationIdx).toBeGreaterThan(-1);
    expect(hydrationIdx).toBeLessThan(headCloseIdx);
  });

  it('DSD polyfill appears before the hydration support script in head', () => {
    const { head } = buildDefault();
    // The polyfill must run before any module script — modules are deferred so
    // the polyfill always arrives first, but we verify the source order too.
    const polyfillIdx = head.indexOf('MutationObserver');
    const hydrationIdx = head.indexOf('lit-element-hydrate-support.js');
    expect(polyfillIdx).toBeLessThan(hydrationIdx);
  });
});

// ---------------------------------------------------------------------------
// head — <title>
// ---------------------------------------------------------------------------

describe('buildShell — head: <title>', () => {
  it('defaults to <title>Litro</title> when no title option is provided', () => {
    const { head } = buildDefault();
    expect(head).toContain('<title>Litro</title>');
  });

  it('uses the provided title option', () => {
    const { head } = buildDefault('page-blog', { title: 'My Blog' });
    expect(head).toContain('<title>My Blog</title>');
  });

  it('does not contain the default title when a custom title is given', () => {
    const { head } = buildDefault('page-about', { title: 'About Us' });
    expect(head).not.toContain('<title>Litro</title>');
    expect(head).toContain('<title>About Us</title>');
  });
});

// ---------------------------------------------------------------------------
// head — serverDataJson injection
// ---------------------------------------------------------------------------

describe('buildShell — head: serverDataJson', () => {
  it('omits the __litro_data__ script when serverDataJson is not provided', () => {
    const { head } = buildDefault();
    expect(head).not.toContain('__litro_data__');
  });

  it('includes <script id="__litro_data__"> when serverDataJson is provided', () => {
    const json = JSON.stringify({ message: 'Hello from the server', timestamp: 42 });
    const { head } = buildDefault('page-home', { serverDataJson: json });
    expect(head).toContain('id="__litro_data__"');
  });

  it('embeds the JSON content inside the script tag', () => {
    const data = { message: 'Hello from the server', count: 7 };
    const json = JSON.stringify(data);
    const { head } = buildDefault('page-home', { serverDataJson: json });
    expect(head).toContain(json);
  });

  it('uses type="application/json" for the data script tag', () => {
    const { head } = buildDefault('page-home', { serverDataJson: '{"key":"val"}' });
    expect(head).toContain('type="application/json"');
  });

  it('the data script appears inside <head> (before </head>)', () => {
    const { head } = buildDefault('page-home', { serverDataJson: '{"x":1}' });
    const dataIdx = head.indexOf('__litro_data__');
    const headCloseIdx = head.indexOf('</head>');
    expect(dataIdx).toBeGreaterThan(-1);
    expect(dataIdx).toBeLessThan(headCloseIdx);
  });
});

// ---------------------------------------------------------------------------
// head — extra head HTML injection
// ---------------------------------------------------------------------------

describe('buildShell — head: extra head HTML', () => {
  it('injects the head option string into <head>', () => {
    const { head } = buildDefault('page-home', {
      head: '<meta name="description" content="Test page" />',
    });
    expect(head).toContain('<meta name="description" content="Test page" />');
  });
});

// ---------------------------------------------------------------------------
// foot — app bundle script
// ---------------------------------------------------------------------------

describe('buildShell — foot: app bundle', () => {
  it('contains the app.js script tag', () => {
    const { foot } = buildDefault();
    expect(foot).toContain('src="/_litro/app.js"');
  });

  it('app.js script is type="module"', () => {
    const { foot } = buildDefault();
    expect(foot).toContain('<script type="module" src="/_litro/app.js">');
  });
});

// ---------------------------------------------------------------------------
// foot — document closing
// ---------------------------------------------------------------------------

describe('buildShell — foot: document closing', () => {
  it('contains </body></html> (or equivalent with whitespace)', () => {
    const { foot } = buildDefault();
    // Allow whitespace between closing tags
    expect(foot).toMatch(/<\/body>[\s\S]*<\/html>/);
  });

  it('contains </body>', () => {
    const { foot } = buildDefault();
    expect(foot).toContain('</body>');
  });

  it('contains </html>', () => {
    const { foot } = buildDefault();
    expect(foot).toContain('</html>');
  });

  it('includes the componentTag in a closing comment', () => {
    const { foot } = buildDefault('page-about');
    // shell.ts adds `<!-- /page-about -->` at the very end
    expect(foot).toContain('<!-- /page-about -->');
  });
});

// ---------------------------------------------------------------------------
// head — structural validity
// ---------------------------------------------------------------------------

describe('buildShell — structural validity', () => {
  it('head starts with <!DOCTYPE html>', () => {
    const { head } = buildDefault();
    expect(head.trimStart().startsWith('<!DOCTYPE html>')).toBe(true);
  });

  it('head contains <html lang="en">', () => {
    const { head } = buildDefault();
    expect(head).toContain('<html lang="en">');
  });

  it('head contains charset meta tag', () => {
    const { head } = buildDefault();
    expect(head).toContain('<meta charset="UTF-8"');
  });

  it('head contains viewport meta tag', () => {
    const { head } = buildDefault();
    expect(head).toContain('name="viewport"');
  });

  it('head opens <body>', () => {
    const { head } = buildDefault();
    expect(head).toContain('<body');
  });

  it('bodyAttrs option adds attributes to the <body> tag', () => {
    const { head } = buildDefault('page-home', { bodyAttrs: 'class="dark-mode"' });
    expect(head).toContain('<body class="dark-mode">');
  });
});

// ---------------------------------------------------------------------------
// Concatenation sanity check
// ---------------------------------------------------------------------------

describe('buildShell — head + foot concatenation', () => {
  it('concatenating head, content, and foot forms a complete HTML document', () => {
    const { head, foot } = buildDefault('page-home', { title: 'Concat Test' });
    const fakeContent = '<page-home></page-home>';
    const html = head + fakeContent + foot;

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<title>Concat Test</title>');
    expect(html).toContain('<page-home></page-home>');
    expect(html).toContain('</html>');
  });
});
