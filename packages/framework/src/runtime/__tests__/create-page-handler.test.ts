/**
 * Unit tests for createPageHandler() — specifically the seoHead / seoTitle
 * extraction from pageData and injection into the HTML shell.
 *
 * Heavy dependencies (@lit-labs/ssr, H3 streams, Lit) are mocked so the test
 * runs in a plain Node environment without a browser or Nitro server.
 *
 * Run with: pnpm --filter @beatzball/litro test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — must be declared before any imports of the modules under test.
// Vitest hoists vi.mock() calls to the top of the file automatically.
// ---------------------------------------------------------------------------

vi.mock('../shell.js', () => ({
  buildShell: vi.fn().mockReturnValue({ head: '', foot: '' }),
}));

vi.mock('../ssr.js', () => ({
  renderToStream: vi.fn().mockReturnValue(
    (async function* () {
      // empty stream
    })(),
  ),
}));

vi.mock('@lit-labs/ssr/lib/render-result-readable.js', async () => {
  const { PassThrough } = await import('node:stream');
  return {
    RenderResultReadable: class MockRenderResultReadable extends PassThrough {
      constructor(_iterable: AsyncIterable<string>) {
        super();
        // End the stream after the current tick so pipe() can be set up first.
        process.nextTick(() => this.end());
      }
    },
  };
});

vi.mock('h3', () => ({
  defineEventHandler: (fn: Function) => fn,
  setResponseHeader: vi.fn(),
  sendStream: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('lit/static-html.js', () => ({
  html: vi.fn().mockReturnValue({}),
  unsafeStatic: vi.fn().mockReturnValue('mock-tag'),
}));

// ---------------------------------------------------------------------------
// Imports — resolved after mocks are registered
// ---------------------------------------------------------------------------

import { buildShell } from '../shell.js';
import { createPageHandler } from '../create-page-handler.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRoute(tag = 'page-test') {
  return {
    filePath: '/fake/page.ts',
    componentTag: tag,
    path: '/',
    isDynamic: false,
    isCatchAll: false,
  };
}

function makePageData(fetcher: (event: unknown) => Promise<unknown>) {
  return { __litroPageData: true as const, fetcher };
}

// Call the handler with a minimal fake H3 event.
async function callHandler(handler: unknown): Promise<void> {
  await (handler as (event: unknown) => Promise<void>)({});
}

// Return the options object passed to buildShell in the last call.
function lastBuildShellOpts(): Parameters<typeof buildShell>[2] {
  const calls = vi.mocked(buildShell).mock.calls;
  return calls[calls.length - 1]?.[2];
}

// ---------------------------------------------------------------------------
// seoHead injection
// ---------------------------------------------------------------------------

describe('createPageHandler — seoHead from pageData', () => {
  beforeEach(() => {
    vi.mocked(buildShell).mockClear();
  });

  it('passes seoHead string to buildShell as head option', async () => {
    const seoHead = '<meta name="description" content="Test page" />';
    const handler = createPageHandler({
      route: makeRoute(),
      pageModule: { pageData: makePageData(async () => ({ seoHead })) },
    });

    await callHandler(handler);

    expect(vi.mocked(buildShell)).toHaveBeenCalledOnce();
    expect(lastBuildShellOpts()?.head).toBe(seoHead);
  });

  it('ignores non-string seoHead values (number, object, null)', async () => {
    for (const badValue of [42, {}, null, true]) {
      vi.mocked(buildShell).mockClear();
      const handler = createPageHandler({
        route: makeRoute(),
        pageModule: { pageData: makePageData(async () => ({ seoHead: badValue })) },
      });
      await callHandler(handler);
      // head should be undefined (empty staticHead + empty dynamicHead → falsy → undefined)
      expect(lastBuildShellOpts()?.head).toBeUndefined();
    }
  });

  it('uses only seoHead when routeMeta.head is absent', async () => {
    const seoHead = '<meta property="og:title" content="My Post" />';
    const handler = createPageHandler({
      route: makeRoute(),
      pageModule: { pageData: makePageData(async () => ({ seoHead })) },
    });

    await callHandler(handler);

    expect(lastBuildShellOpts()?.head).toBe(seoHead);
  });

  it('omits head option when neither routeMeta.head nor seoHead are present', async () => {
    const handler = createPageHandler({
      route: makeRoute(),
      pageModule: { pageData: makePageData(async () => ({ message: 'hello' })) },
    });

    await callHandler(handler);

    // '' + '' = '' which is falsy → '' || undefined = undefined
    expect(lastBuildShellOpts()?.head).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// routeMeta.head + seoHead concatenation
// ---------------------------------------------------------------------------

describe('createPageHandler — routeMeta.head + seoHead concatenation', () => {
  beforeEach(() => {
    vi.mocked(buildShell).mockClear();
  });

  it('concatenates routeMeta.head and seoHead in that order', async () => {
    const staticHead = '<link rel="stylesheet" href="/styles.css" />';
    const seoHead = '<meta name="description" content="SEO desc" />';
    const handler = createPageHandler({
      route: makeRoute(),
      routeMeta: { head: staticHead },
      pageModule: { pageData: makePageData(async () => ({ seoHead })) },
    });

    await callHandler(handler);

    expect(lastBuildShellOpts()?.head).toBe(staticHead + seoHead);
  });

  it('uses only routeMeta.head when pageData returns no seoHead', async () => {
    const staticHead = '<link rel="preload" href="/font.woff2" as="font" />';
    const handler = createPageHandler({
      route: makeRoute(),
      routeMeta: { head: staticHead },
      pageModule: { pageData: makePageData(async () => ({ message: 'data' })) },
    });

    await callHandler(handler);

    expect(lastBuildShellOpts()?.head).toBe(staticHead);
  });
});

// ---------------------------------------------------------------------------
// seoTitle injection
// ---------------------------------------------------------------------------

describe('createPageHandler — seoTitle from pageData', () => {
  beforeEach(() => {
    vi.mocked(buildShell).mockClear();
  });

  it('passes seoTitle from pageData as title option', async () => {
    const handler = createPageHandler({
      route: makeRoute(),
      pageModule: { pageData: makePageData(async () => ({ seoTitle: 'Dynamic Title' })) },
    });

    await callHandler(handler);

    expect(lastBuildShellOpts()?.title).toBe('Dynamic Title');
  });

  it('seoTitle overrides routeMeta.title', async () => {
    const handler = createPageHandler({
      route: makeRoute(),
      routeMeta: { title: 'Static Title' },
      pageModule: { pageData: makePageData(async () => ({ seoTitle: 'Dynamic Title' })) },
    });

    await callHandler(handler);

    expect(lastBuildShellOpts()?.title).toBe('Dynamic Title');
  });

  it('falls back to routeMeta.title when seoTitle is absent', async () => {
    const handler = createPageHandler({
      route: makeRoute(),
      routeMeta: { title: 'Static Title' },
      pageModule: { pageData: makePageData(async () => ({ message: 'data' })) },
    });

    await callHandler(handler);

    expect(lastBuildShellOpts()?.title).toBe('Static Title');
  });

  it('title is undefined when neither seoTitle nor routeMeta.title are present', async () => {
    const handler = createPageHandler({
      route: makeRoute(),
      pageModule: { pageData: makePageData(async () => ({ message: 'data' })) },
    });

    await callHandler(handler);

    expect(lastBuildShellOpts()?.title).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// pageData fetch failure
// ---------------------------------------------------------------------------

describe('createPageHandler — pageData.fetcher failure', () => {
  beforeEach(() => {
    vi.mocked(buildShell).mockClear();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('still calls buildShell with routeMeta values when fetcher throws', async () => {
    const handler = createPageHandler({
      route: makeRoute(),
      routeMeta: { title: 'Static Title', head: '<link rel="stylesheet" />' },
      pageModule: {
        pageData: makePageData(async () => {
          throw new Error('Data fetch failed');
        }),
      },
    });

    await callHandler(handler);

    expect(vi.mocked(buildShell)).toHaveBeenCalledOnce();
    const opts = lastBuildShellOpts();
    expect(opts?.title).toBe('Static Title');
    expect(opts?.head).toBe('<link rel="stylesheet" />');
  });

  it('emits a console.warn with the component tag and error when fetcher throws', async () => {
    const warnSpy = vi.mocked(console.warn as (...args: unknown[]) => void);
    const handler = createPageHandler({
      route: makeRoute('page-blog-slug'),
      pageModule: {
        pageData: makePageData(async () => {
          throw new Error('Network error');
        }),
      },
    });

    await callHandler(handler);

    expect(warnSpy).toHaveBeenCalledWith(
      '[litro] pageData.fetcher failed for',
      'page-blog-slug',
      expect.any(Error),
    );
  });

  it('head is undefined (not the error) when fetcher throws and no routeMeta.head', async () => {
    const handler = createPageHandler({
      route: makeRoute(),
      pageModule: {
        pageData: makePageData(async () => {
          throw new Error('fail');
        }),
      },
    });

    await callHandler(handler);

    expect(lastBuildShellOpts()?.head).toBeUndefined();
  });
});
