/**
 * Where "edit this page" sends a reader.
 *
 * THE BUG THIS PINS. `editUrlBase` said
 * `https://github.com/beatzball/litro/edit/main/docs`, and the docs page
 * appends `/content/docs/<slug>.md` to it. That built
 *
 *   .../edit/main/docs/content/docs/adapters/lit.md
 *
 * which is a path that has never existed in this repository: the content lives
 * in `packages/docs-content/content/`, not in `docs/`. GitHub answers a URL
 * like that with its 404 page, so the link looked fine and went nowhere.
 *
 * A test that compared the URL against another string would only pin the same
 * guess twice. These RESOLVE the path on disk instead: whatever the base and
 * the page agree on has to name a file that is really there.
 */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { siteConfig } from '../../server/starlight.config.js';

/** The repository root, four levels up from `docs/src/__tests__/`. */
const REPO = fileURLToPath(new URL('../../../', import.meta.url));

/** The prefix GitHub needs in front of a repo-relative path. */
const EDIT_PREFIX = 'https://github.com/beatzball/litro/edit/main/';

/**
 * The URL the docs page builds. It is written out here rather than imported,
 * because importing the page would pull in the whole Markdown toolchain — and
 * because a second copy of this one line is what the tests below are for: if
 * the page changes its shape, the assertions stop matching the files on disk.
 */
function editUrl(slug: string): string {
  return `${siteConfig.editUrlBase}/content/docs/${slug}.md`;
}

/**
 * Slugs from three different depths of the sidebar.
 *
 * `packages/*` is deliberately NOT here: those are a different route,
 * `/docs/packages/[pkg]`, whose link points at a package's CHANGELOG rather
 * than at a content file. It has its own URL and its own reason.
 */
const SLUGS = ['introduction', 'adapters/lit', 'core-concepts/ssr', 'recipes/supernova'];

describe('the edit link points at a file that exists', () => {
  it('builds a URL under the repository, not under an invented folder', () => {
    expect(siteConfig.editUrlBase).toMatch(/^https:\/\/github\.com\/[^/]+\/[^/]+\/edit\/main\//);
    // The old value. It named `docs/`, where no content has ever lived.
    expect(siteConfig.editUrlBase).not.toMatch(/\/edit\/main\/docs$/);
  });

  for (const slug of SLUGS) {
    it(`${slug} resolves to a real Markdown file`, () => {
      const url = editUrl(slug);
      expect(url.startsWith(EDIT_PREFIX), `${url} is a GitHub edit URL`).toBe(true);

      const repoPath = url.slice(EDIT_PREFIX.length);
      expect(
        existsSync(new URL(repoPath, `file://${REPO}`)),
        `${repoPath} exists in the repository`,
      ).toBe(true);
    });
  }

  it('names the content package, so the path is the one the content is in', () => {
    expect(editUrl('introduction')).toContain('packages/docs-content/content/docs/');
  });
});
