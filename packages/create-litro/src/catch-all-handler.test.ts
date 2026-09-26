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
 */
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));

const SKIP = new Set(['node_modules', 'dist', '.nitro', '.litro', '.output', '.git']);

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
    });
  }
});
