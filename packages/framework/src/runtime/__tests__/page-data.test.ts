/**
 * Unit tests for getServerData() in page-data.ts.
 *
 * @vitest-environment jsdom
 *
 * The jsdom environment is required because getServerData() reads from
 * document.getElementById() and calls el.remove(). The `@vitest-environment jsdom`
 * docblock annotation tells Vitest to run this file in jsdom regardless of the
 * global `environment: 'node'` setting in vitest.config.ts.
 *
 * Run with: pnpm --filter litro test
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getServerData } from '../page-data.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Injects a <script id="__litro_data__"> element with the given text content. */
function injectDataScript(content: string): HTMLScriptElement {
  const el = document.createElement('script');
  el.type = 'application/json';
  el.id = '__litro_data__';
  el.textContent = content;
  document.head.appendChild(el);
  return el;
}

/** Returns true if the data script tag is still in the document. */
function dataScriptExists(): boolean {
  return document.getElementById('__litro_data__') !== null;
}

// ---------------------------------------------------------------------------
// Cleanup: remove any leftover script tags between tests
// ---------------------------------------------------------------------------

afterEach(() => {
  const el = document.getElementById('__litro_data__');
  if (el) el.remove();
});

// ---------------------------------------------------------------------------
// Server-side guard (no `document` global)
// ---------------------------------------------------------------------------

describe('getServerData — server-side guard', () => {
  it('returns null when document is not defined', () => {
    // Simulate a server-side environment by temporarily hiding the global
    // document. We store and restore it so other tests are not affected.
    const originalDocument = global.document;
    // @ts-expect-error — intentionally deleting global for test
    delete global.document;

    try {
      const result = getServerData();
      expect(result).toBeNull();
    } finally {
      global.document = originalDocument;
    }
  });
});

// ---------------------------------------------------------------------------
// Missing element
// ---------------------------------------------------------------------------

describe('getServerData — missing element', () => {
  it('returns null when #__litro_data__ element is absent', () => {
    // No script tag has been injected — the document is clean (afterEach
    // ensures this between tests).
    const result = getServerData();
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Valid JSON
// ---------------------------------------------------------------------------

describe('getServerData — valid JSON', () => {
  it('parses and returns the data object when element contains valid JSON', () => {
    injectDataScript(JSON.stringify({ message: 'Hello from the server', timestamp: 1234567890 }));

    const result = getServerData<{ message: string; timestamp: number }>();

    expect(result).not.toBeNull();
    expect(result?.message).toBe('Hello from the server');
    expect(result?.timestamp).toBe(1234567890);
  });

  it('works with nested objects and arrays', () => {
    injectDataScript(
      JSON.stringify({ items: [{ id: 1, name: 'Alpha' }, { id: 2, name: 'Beta' }], count: 2 }),
    );

    const result = getServerData<{ items: Array<{ id: number; name: string }>; count: number }>();

    expect(result).not.toBeNull();
    expect(result?.count).toBe(2);
    expect(result?.items).toHaveLength(2);
    expect(result?.items[0].name).toBe('Alpha');
  });

  it('works with primitive JSON values (string)', () => {
    injectDataScript('"hello"');

    const result = getServerData<string>();

    expect(result).toBe('hello');
  });

  it('works with a JSON null value', () => {
    injectDataScript('null');

    // JSON.parse('null') returns null, which getServerData returns directly.
    // This is a valid JSON value, not a parse error.
    const result = getServerData();

    // null is a valid parsed value — returned as-is
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Invalid JSON
// ---------------------------------------------------------------------------

describe('getServerData — invalid JSON', () => {
  it('returns null when element contains invalid JSON without throwing', () => {
    injectDataScript('this is not valid json {{{');

    // Must not throw — invalid JSON is treated as missing data
    expect(() => getServerData()).not.toThrow();
    const result = getServerData();
    expect(result).toBeNull();
  });

  it('returns null when element is empty', () => {
    injectDataScript('');

    const result = getServerData();
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Element removal after reading
// ---------------------------------------------------------------------------

describe('getServerData — element removal after reading', () => {
  it('removes the #__litro_data__ element after a successful read', () => {
    injectDataScript(JSON.stringify({ key: 'value' }));
    expect(dataScriptExists()).toBe(true);

    getServerData();

    expect(dataScriptExists()).toBe(false);
  });

  it('subsequent calls return null after the element has been removed', () => {
    injectDataScript(JSON.stringify({ key: 'value' }));

    const firstRead = getServerData<{ key: string }>();
    expect(firstRead?.key).toBe('value');

    // Second call — element was removed by the first call
    const secondRead = getServerData();
    expect(secondRead).toBeNull();
  });

  it('prevents stale data from being read on subsequent client navigations', () => {
    // Simulate the initial SSR page load by injecting the data script
    injectDataScript(JSON.stringify({ page: 'home', user: 'alice' }));

    // First read (simulates the page component's onBeforeEnter on initial load)
    const data = getServerData<{ page: string; user: string }>();
    expect(data?.page).toBe('home');

    // Simulate a client-side navigation: the script tag should be gone
    // so the next read returns null rather than the stale SSR data
    const staleRead = getServerData();
    expect(staleRead).toBeNull();
    expect(dataScriptExists()).toBe(false);
  });
});
