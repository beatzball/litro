/**
 * blog.ts — the one way to take the blog out of a scaffolded site.
 *
 * WHY THIS EXISTS
 *
 * Two callers need it and they must not drift apart:
 *
 *   - `--for-repo` builds a project's docs site, where the recipe's sample
 *     blog is somebody else's writing. It has a repository URL to point the
 *     old Blog button at, so the button becomes a GitHub link.
 *   - the `blog` recipe option lets a user say no at scaffold time. There is
 *     no repository to point at, so the button goes away instead.
 *
 * That is the ONLY difference between them, and it is this module's one
 * parameter. Everything else — which files go, which references are unpicked —
 * is shared, because a site that keeps half a blog is the bug worth guarding
 * against here.
 *
 * Every edit asserts its target exists. If a recipe template is reshaped and
 * one of these no longer matches, scaffolding fails loudly rather than
 * emitting a site with a dead link nobody notices until a reader clicks it.
 */
import { readFile, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/** What the landing page's Blog button becomes instead of being deleted. */
export interface BlogLinkReplacement {
  /** Where the button points, e.g. the repository URL. */
  href: string;
  /** The button's new text, e.g. "GitHub". */
  label: string;
}

/**
 * Remove the blog from a scaffolded site.
 *
 * Deletes `content/blog/` and `pages/blog/`, then unpicks what the rest of the
 * site assumes about them: the landing page's Blog button and Blog feature
 * card, and the blog routes in the generated e2e spec.
 *
 * @param siteDir      The scaffolded site's root directory.
 * @param replacement  Optional. Given, the Blog button is repointed at this
 *                     link. Omitted, the button is deleted.
 */
export async function removeBlog(
  siteDir: string,
  replacement?: BlogLinkReplacement,
): Promise<void> {
  await rm(join(siteDir, 'content/blog'), { recursive: true, force: true });
  await rm(join(siteDir, 'pages/blog'), { recursive: true, force: true });

  await unlinkLandingPage(siteDir, replacement);
  await dropBlogRoutesFromSpec(siteDir);
}

/** Rewrite the landing page so nothing on it points at the blog. */
async function unlinkLandingPage(
  siteDir: string,
  replacement?: BlogLinkReplacement,
): Promise<void> {
  const indexPath = join(siteDir, 'pages/index.ts');
  let index = await readFile(indexPath, 'utf-8');

  const blogCta = '<a href="/blog"';
  if (!index.includes(blogCta)) {
    throw new Error(
      `[create-litro] Expected a /blog link in pages/index.ts to rewrite. The ` +
        `recipe template changed shape; update removeBlog() in src/blog.ts.`,
    );
  }

  if (replacement) {
    index = index
      .replace(blogCta, `<a href="${replacement.href}"`)
      .replace('">Blog</a>', `">${replacement.label}</a>`);
  } else {
    // Nothing to point at, so drop the second call to action entirely rather
    // than leaving a button that goes nowhere.
    index = index.replace(/\s*<a href="\/blog"[\s\S]*?">Blog<\/a>/, '');
  }

  // The "Blog" feature card advertises a section that no longer exists.
  index = index.replace(
    /\s*\{\s*icon: '[^']*',\s*title: 'Blog',[\s\S]*?\},/,
    '',
  );

  await writeFile(indexPath, index, 'utf-8');
}

/**
 * Take the blog routes out of the generated e2e spec.
 *
 * Only the blog entries go. The spec's other routes are the recipe's business:
 * a caller that also deleted pages of its own (`--for-repo` replaces the
 * sample docs with one starter page) rewrites the list itself afterwards.
 */
async function dropBlogRoutesFromSpec(siteDir: string): Promise<void> {
  const specPath = join(siteDir, 'e2e/index.spec.ts');
  if (!existsSync(specPath)) return;

  const spec = await readFile(specPath, 'utf-8');
  const match = /const PRERENDERED_ROUTES = \[([\s\S]*?)\];/.exec(spec);
  if (!match) {
    throw new Error(
      `[create-litro] Expected PRERENDERED_ROUTES in e2e/index.spec.ts to rewrite.`,
    );
  }

  const kept = match[1]
    .split('\n')
    .filter((line) => !/'\/blog(\/|')/.test(line));

  await writeFile(
    specPath,
    spec.replace(match[0], `const PRERENDERED_ROUTES = [${kept.join('\n')}];`),
    'utf-8',
  );
}
