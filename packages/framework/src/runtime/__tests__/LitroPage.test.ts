/**
 * Unit tests for LitroPageMixin / LitroPage (LitroPage.ts).
 *
 * Tests cover the two onBeforeEnter() data-loading paths:
 *   1. SSR load — server-injected <script id="__litro_data__"> is present;
 *      getServerData() returns the parsed value and fetchData() is NOT called.
 *   2. Client navigation — the script tag is absent (consumed on first load);
 *      getServerData() returns null and fetchData() IS called.
 *
 * @vitest-environment jsdom
 *
 * jsdom is required because:
 *   - LitElement (the base class) uses customElements.define() and HTMLElement
 *   - LitroPageMixin.onBeforeEnter() calls getServerData() which reads
 *     document.getElementById('__litro_data__')
 *
 * LitElement subclasses must be registered with customElements.define() before
 * instantiation in jsdom (jsdom enforces the custom element constructor check).
 *
 * Run with: pnpm --filter litro test
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { LitroPage, LitroPageMixin } from '../LitroPage.js';
import { LitElement } from 'lit';
import type { LitroLocation } from '@beatzball/litro-router';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal LitroLocation used throughout these tests. */
const makeLocation = (
  pathname = '/',
  params: Record<string, string | undefined> = {},
): LitroLocation => ({
  pathname,
  params,
  search: '',
  hash: '',
});

/** Injects a <script id="__litro_data__"> element with the given JSON content. */
function injectDataScript(data: unknown): void {
  const el = document.createElement('script');
  el.type = 'application/json';
  el.id = '__litro_data__';
  el.textContent = JSON.stringify(data);
  document.head.appendChild(el);
}

/** Counter used to generate unique custom element tag names per test. */
let tagCounter = 0;
function uniqueTag(prefix: string): string {
  return `${prefix}-${++tagCounter}`;
}

// ---------------------------------------------------------------------------
// Cleanup: remove any leftover data script tags between tests
// ---------------------------------------------------------------------------

afterEach(() => {
  const el = document.getElementById('__litro_data__');
  if (el) el.remove();
});

// ---------------------------------------------------------------------------
// LitroPageMixin — SSR data path
//
// When the server-injected script tag is present, onBeforeEnter() should read
// from it and store the result in `serverData`. fetchData() must NOT be called.
// ---------------------------------------------------------------------------

describe('LitroPageMixin — SSR data path', () => {
  it('populates serverData from the server-injected script tag', async () => {
    const serverPayload = { message: 'hello from server', count: 42 };
    injectDataScript(serverPayload);

    class TestPage extends LitroPageMixin(LitElement) {}
    customElements.define(uniqueTag('lp-ssr-1'), TestPage);
    const page = new TestPage();
    await page.onBeforeEnter(makeLocation());

    expect(page.serverData).toMatchObject(serverPayload);
  });

  it('does NOT call fetchData() when server data is present', async () => {
    injectDataScript({ x: 1 });

    const fetchDataSpy = vi.fn().mockResolvedValue({ x: 999 });
    class TestPage extends LitroPageMixin(LitElement) {
      override fetchData = fetchDataSpy;
    }
    customElements.define(uniqueTag('lp-ssr-2'), TestPage);
    const page = new TestPage();
    await page.onBeforeEnter(makeLocation());

    expect(fetchDataSpy).not.toHaveBeenCalled();
    expect(page.serverData).toMatchObject({ x: 1 }); // from script tag, not spy
  });

  it('loading remains false when SSR data is consumed synchronously', async () => {
    injectDataScript({ ready: true });

    class TestPage extends LitroPageMixin(LitElement) {}
    customElements.define(uniqueTag('lp-ssr-3'), TestPage);
    const page = new TestPage();
    await page.onBeforeEnter(makeLocation());

    expect(page.loading).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// LitroPageMixin — client navigation path
//
// When no script tag is present (consumed on first load), onBeforeEnter()
// should call fetchData() and store its return value in serverData.
// ---------------------------------------------------------------------------

describe('LitroPageMixin — client navigation path', () => {
  it('calls fetchData() when no server data is available', async () => {
    const fetchResult = { posts: ['a', 'b'] };
    const fetchDataSpy = vi.fn().mockResolvedValue(fetchResult);

    class TestPage extends LitroPageMixin(LitElement) {
      override fetchData = fetchDataSpy;
    }
    customElements.define(uniqueTag('lp-client-1'), TestPage);
    const page = new TestPage();
    await page.onBeforeEnter(makeLocation('/blog'));

    expect(fetchDataSpy).toHaveBeenCalledOnce();
    expect(page.serverData).toEqual(fetchResult);
  });

  it('passes the LitroLocation to fetchData()', async () => {
    let capturedLocation: LitroLocation | undefined;
    class TestPage extends LitroPageMixin(LitElement) {
      override async fetchData(loc: LitroLocation) {
        capturedLocation = loc;
        return null;
      }
    }
    customElements.define(uniqueTag('lp-client-2'), TestPage);
    const loc = makeLocation('/blog/hello', { slug: 'hello' });
    const page = new TestPage();
    await page.onBeforeEnter(loc);

    expect(capturedLocation).toBeDefined();
    expect(capturedLocation?.pathname).toBe('/blog/hello');
    expect(capturedLocation?.params.slug).toBe('hello');
  });

  it('sets loading=true during fetchData() execution and false after', async () => {
    const loadingStates: boolean[] = [];
    class TestPage extends LitroPageMixin(LitElement) {
      override async fetchData(_loc: LitroLocation) {
        loadingStates.push(this.loading);
        return { done: true };
      }
    }
    customElements.define(uniqueTag('lp-client-3'), TestPage);
    const page = new TestPage();
    await page.onBeforeEnter(makeLocation());

    expect(loadingStates).toEqual([true]); // was true during fetchData
    expect(page.loading).toBe(false);       // false after completion
  });

  it('sets loading=false even when fetchData() rejects', async () => {
    class TestPage extends LitroPageMixin(LitElement) {
      override async fetchData(_loc: LitroLocation): Promise<unknown> {
        throw new Error('fetch failed');
      }
    }
    customElements.define(uniqueTag('lp-client-4'), TestPage);
    const page = new TestPage();
    await expect(page.onBeforeEnter(makeLocation())).rejects.toThrow('fetch failed');
    expect(page.loading).toBe(false);
  });

  it('default fetchData() returns null (no-op)', async () => {
    class TestPage extends LitroPageMixin(LitElement) {}
    customElements.define(uniqueTag('lp-client-5'), TestPage);
    const page = new TestPage();
    await page.onBeforeEnter(makeLocation());

    expect(page.serverData).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// LitroPage — convenience base class
//
// LitroPage is `LitroPageMixin(LitElement)`. Confirm it exposes the same API
// surface and initial property values.
// ---------------------------------------------------------------------------

describe('LitroPage convenience base class', () => {
  it('is an instance of LitElement', () => {
    customElements.define(uniqueTag('lp-base-1'), class extends LitroPage {});
    // LitroPage itself is not registered — only subclasses can be instantiated.
    // Verify the prototype chain by checking the class.
    expect(LitroPage.prototype).toBeInstanceOf(LitElement);
  });

  it('subclass has serverData and loading after define', () => {
    class MyPage extends LitroPage {}
    customElements.define(uniqueTag('lp-base-2'), MyPage);
    const page = new MyPage();
    expect(page.serverData).toBeNull();
    expect(page.loading).toBe(false);
  });

  it('onBeforeEnter() is a function on the prototype', () => {
    expect(typeof LitroPage.prototype.onBeforeEnter).toBe('function');
  });

  it('fetchData() is a function that returns null by default', async () => {
    class MyPage extends LitroPage {}
    customElements.define(uniqueTag('lp-base-3'), MyPage);
    const page = new MyPage();
    const result = await page.fetchData(makeLocation());
    expect(result).toBeNull();
  });
});
