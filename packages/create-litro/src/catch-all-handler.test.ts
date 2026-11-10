/**
 * Every catch-all page handler in the repo canonicalizes its path and sets a
 * 404 status.
 *
 * Issue 203 was one bug written eighteen times. The handler in
 * `server/routes/[...].ts` is copied — into each recipe template, into each
 * playground, into the docs sites, into the benchmark apps — and scaffolding
 * copies it again into every app a user creates. When PR 197 added
 * `setResponseStatus(event, 404)` to the benchmark apps, nobody carried it
 * back, so fifteen other copies kept answering a miss with 200 OK.
 *
 * The trailing-slash half was worse, because the two ends disagreed. The
 * client router and this handler are separate implementations of the same
 * matching rule, and neither accepted `/docs/a/`. On a static host the page
 * still arrived 200 with every asset — an SSG build writes
 * `docs/a/index.html` — so only the client missed, the component was never
 * defined, and the recipe's `:not(:defined)` rule hid a complete document.
 *
 * A per-file test is the only thing that scales here: a new recipe or a new
 * playground gets the same two assertions for free the moment its handler
 * lands.
 *
 * Issue 295 added a third: the 404 page writes the request path into HTML, so
 * the path has to be escaped. That one is checked by RUNNING each handler, not
 * by reading its text. The handler's imports (h3, the page manifest, the page
 * handler) are replaced with stubs, so the test needs no Nitro build and works
 * on a recipe template that has no node_modules of its own.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import ts from 'typescript';
import { normalizePathname, DEFAULT_SKIP_LINKS } from '@beatzball/litro';

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));

// `.claude` and `.airig` hold agent worktrees and review scratch: other
// checkouts of this repository, often at older commits. Walking into them
// tests their handlers, not this checkout's, and a pre-fix copy there turns a
// local run red while CI (which has none) stays green.
const SKIP = new Set([
  'node_modules',
  'dist',
  '.nitro',
  '.litro',
  '.output',
  '.git',
  '.claude',
  '.airig',
]);

/** Every `server/routes/[...].ts` under the repository root. */
async function catchAllHandlers(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await catchAllHandlers(full)));
    } else if (entry.name === '[...].ts' && full.includes(`${sep}server${sep}routes${sep}`)) {
      out.push(full);
    }
  }
  return out;
}

const handlers = await catchAllHandlers(repoRoot);

interface FakeEvent {
  url: { pathname: string };
  status?: number;
  headers: Record<string, string>;
  context: Record<string, unknown>;
}

type Handler = (event: FakeEvent) => Promise<unknown>;

/**
 * Loads one handler with its imports swapped for stubs.
 *
 * The file is transpiled, then each `import { a, b } from 'x'` becomes a
 * destructure from a stub table. Every handler in the repo imports only the
 * named-import form, so anything else left over is an error, not a silent skip.
 */
async function loadHandler(file: string): Promise<Handler> {
  const src = await readFile(file, 'utf8');
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const body = js
    .replace(
      /^import\s*\{([^}]*)\}\s*from\s*'([^']+)';$/gm,
      (_, names: string, mod: string) =>
        `const {${names.replace(/\s+as\s+/g, ': ')}} = __imports[${JSON.stringify(mod)}];`,
    )
    .replace(/^export default /m, '__exports.default = ');
  if (/^\s*(import|export)\b/m.test(body)) {
    throw new Error(`${file}: an import or export form the stub loader does not handle`);
  }
  const imports = {
    h3: {
      defineEventHandler: (fn: Handler) => fn,
      getRequestURL: (event: FakeEvent) => event.url,
      setResponseStatus: (event: FakeEvent, status: number) => {
        event.status = status;
      },
      setResponseHeader: (event: FakeEvent, name: string, value: string) => {
        event.headers[name] = value;
      },
    },
    '@beatzball/litro': { normalizePathname, DEFAULT_SKIP_LINKS },
    '@beatzball/litro/runtime/create-page-handler.js': {
      createPageHandler: () => () => {
        throw new Error('a miss must not reach the page handler');
      },
    },
    // No routes at all, so every path is a miss and the 404 page renders.
    '#litro/page-manifest': { routes: [], pageModules: {} },
  };
  const exports: { default?: Handler } = {};
  new Function('__imports', '__exports', body)(imports, exports);
  if (!exports.default) throw new Error(`${file}: no default export`);
  return exports.default;
}

/**
 * Renders the 404 page for one path.
 *
 * `decoded: true` hands the handler the path exactly as written, the way a
 * proxy or runtime that decodes the path would. Without it the path goes
 * through `new URL`, which is what h3's getRequestURL does today and which
 * percent-encodes `<`, `>` and `"` but leaves `&` and `'` alone.
 */
async function render404(
  handler: Handler,
  path: string,
  { decoded = false }: { decoded?: boolean } = {},
): Promise<{ status?: number; body: string }> {
  const event: FakeEvent = {
    url: decoded ? { pathname: path } : new URL(path, 'http://localhost'),
    headers: {},
    context: {},
  };
  const body = await handler(event);
  expect(typeof body).toBe('string');
  return { status: event.status, body: body as string };
}

/** The text of the page's one `<code>` element: where the path is written. */
function codeText(body: string): string {
  const m = body.match(/<code>([\s\S]*?)<\/code>/);
  expect(m, 'the 404 page shows the path in a <code> element').not.toBeNull();
  return m![1];
}

describe('catch-all page handlers', () => {
  it('finds every handler the repo ships', () => {
    // A guard on the guard: if the glob stops matching, the assertions below
    // would pass vacuously.
    expect(handlers.length).toBeGreaterThanOrEqual(17);
  });

  for (const file of handlers) {
    const name = relative(repoRoot, file);

    describe(name, () => {
      it('canonicalizes the pathname before matching', async () => {
        const src = await readFile(file, 'utf8');
        // The shared helper, not a local re-implementation — the client
        // router uses the same one, which is the whole point.
        expect(src).toContain('normalizePathname');
        expect(src).toMatch(/const pathname = normalizePathname\(/);
      });

      it('answers a miss with a 404 status, not 200', async () => {
        const src = await readFile(file, 'utf8');
        expect(src).toContain('setResponseStatus(event, 404)');
      });

      describe('escapes the request path on the 404 page (issue 295)', () => {
        const SCRIPT = '<script>alert(1)</script>';

        it('escapes a raw <script> in the path', async () => {
          const handler = await loadHandler(file);
          const { status, body } = await render404(handler, `/x${SCRIPT}`, { decoded: true });
          expect(status).toBe(404);
          expect(codeText(body)).toBe('/x&lt;script&gt;alert(1)&lt;/script&gt;');
          // The 404 page has no script of its own, so any `<script` at all is
          // one the request put there.
          expect(body).not.toMatch(/<script/i);
        });

        it('escapes a percent-encoded <script>, decoded or not', async () => {
          const handler = await loadHandler(file);
          const encoded = `/x${encodeURIComponent(SCRIPT)}`;

          const asSent = await render404(handler, encoded);
          expect(asSent.body).not.toMatch(/<script/i);

          const decoded = await render404(handler, decodeURIComponent(encoded), {
            decoded: true,
          });
          expect(codeText(decoded.body)).toBe('/x&lt;script&gt;alert(1)&lt;/script&gt;');
          expect(decoded.body).not.toMatch(/<script/i);
        });

        it('escapes a double quote and a single quote', async () => {
          const handler = await loadHandler(file);
          const { body } = await render404(handler, `/a"b'c`, { decoded: true });
          expect(codeText(body)).toBe('/a&quot;b&#39;c');

          // Through new URL the double quote is percent-encoded and the
          // single quote is not, so the single quote still needs escaping.
          const viaUrl = await render404(handler, `/a'b`);
          expect(codeText(viaUrl.body)).toBe('/a&#39;b');
        });

        it('escapes a bare & exactly once', async () => {
          const handler = await loadHandler(file);
          // `&` survives new URL unchanged, so this is reachable today.
          const { body } = await render404(handler, '/a&b');
          expect(codeText(body)).toBe('/a&amp;b');
          expect(body).not.toContain('&amp;amp;');

          // An entity in the path is shown as typed, not interpreted.
          const entity = await render404(handler, '/a&lt;b&gt;');
          expect(codeText(entity.body)).toBe('/a&amp;lt;b&amp;gt;');
        });

        it('shows an invalid percent-escape as typed, with a 404', async () => {
          // Pins the handler against a future decodeURIComponent() of the
          // path, which throws URIError on `%ZZ` and would answer 500.
          const handler = await loadHandler(file);
          const { status, body } = await render404(handler, '/bad%ZZ%2');
          expect(status).toBe(404);
          expect(codeText(body)).toBe('/bad%ZZ%2');
        });
      });
    });
  }
});
