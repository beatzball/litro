/**
 * Pinned behavior: what `--for-repo` without `--with-blog` produces.
 *
 * WHY THIS FILE EXISTS
 *
 * Blog removal used to live inside for-repo.ts as a private helper. Moving it
 * into a shared module (src/blog.ts) so the `blog` recipe option can call it
 * too is a refactor, and a refactor of generated output is exactly the kind
 * that passes its own tests while quietly changing a byte. So this file pins
 * the output FIRST, literally, and must keep passing unchanged afterwards.
 *
 * Every expectation here is the text as it was before the move. Do not relax
 * one to make a change pass: if `--for-repo` output must change, that is a
 * deliberate decision and this file changes with it.
 */
import { describe, it, expect } from 'vitest';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scaffold } from './scaffold.js';
import { applyForRepo } from './for-repo.js';

const RECIPES_ROOT = fileURLToPath(new URL('../recipes', import.meta.url));

/** The call-to-action row on the landing page, sliced out for an exact match. */
function ctaBlock(source: string): string {
  const start = source.indexOf('            <div style="display:flex;gap:1rem;');
  expect(start, 'landing page has no call-to-action row').toBeGreaterThan(-1);
  const end = source.indexOf('</div>', start) + '</div>'.length;
  return source.slice(start, end);
}

/** The feature-card data list, sliced out for an exact match. */
function featuresBlock(source: string): string {
  const start = source.indexOf('    features: [');
  expect(start, 'landing page has no features list').toBeGreaterThan(-1);
  const end = source.indexOf('\n    ],', start) + '\n    ],'.length;
  return source.slice(start, end);
}

interface Fixture {
  /** The scaffolded and shaped site. */
  siteDir: string;
  /** A second, plain scaffold of the same recipe, for before/after comparison. */
  plainDir: string;
}

/**
 * Scaffold starlight twice: once shaped by `--for-repo`, once left alone.
 *
 * `remote` controls the branch under test. With a remote, the Blog button is
 * repointed at the repository; without one there is nothing to point at, so
 * the button is deleted instead.
 */
async function withFixture(
  opts: { remote?: string; withBlog: boolean },
  fn: (f: Fixture) => Promise<void>,
): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), 'for-repo-blog-pin-'));
  const siteDir = join(root, 'site');
  const plainDir = join(root, 'plain');
  try {
    // A package.json with a description keeps detectRepo offline: without one
    // it falls through to `gh repo view`, which is slow and not always logged in.
    await writeFile(
      join(root, 'package.json'),
      JSON.stringify({ name: 'widget', description: 'A widget.' }, null, 2) + '\n',
      'utf-8',
    );
    if (opts.remote) {
      const git = (...args: string[]) =>
        execFileSync('git', args, { cwd: root, stdio: ['ignore', 'ignore', 'ignore'] });
      git('init', '--initial-branch=main');
      git('remote', 'add', 'origin', opts.remote);
    }

    await scaffold('starlight', { projectName: 'site', mode: 'ssg' }, siteDir);
    await scaffold('starlight', { projectName: 'site', mode: 'ssg' }, plainDir);
    await applyForRepo({
      repoDir: root,
      siteDir,
      siteUrl: 'https://example.dev',
      siteRelPath: 'site',
      deploy: 'docker',
      withBlog: opts.withBlog,
    });

    await fn({ siteDir, plainDir });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

describe('--for-repo without --with-blog (pinned)', () => {
  it('deletes the blog content and pages', async () => {
    await withFixture({ remote: 'https://github.com/acme/widget.git', withBlog: false }, async ({ siteDir }) => {
      expect(existsSync(join(siteDir, 'content/blog'))).toBe(false);
      expect(existsSync(join(siteDir, 'pages/blog'))).toBe(false);
    });
  });

  it('repoints the Blog button at the repository, byte for byte', async () => {
    await withFixture({ remote: 'https://github.com/acme/widget.git', withBlog: false }, async ({ siteDir }) => {
      const index = await readFile(join(siteDir, 'pages/index.ts'), 'utf-8');
      expect(ctaBlock(index)).toBe(
        `            <div style="display:flex;gap:1rem;justify-content:center;flex-wrap:wrap;">
              <a href="/docs/getting-started" style="
                display:inline-block;
                padding:0.6rem 1.5rem;
                background:var(--sl-color-accent);
                color:var(--sl-color-text-invert,#fff);
                border-radius:var(--sl-border-radius);
                font-weight:600;
                text-decoration:none;
                font-size:var(--sl-text-base);
              ">Get Started</a>
              <a href="https://github.com/acme/widget" style="
                display:inline-block;
                padding:0.6rem 1.5rem;
                border:1px solid var(--sl-color-border);
                color:var(--sl-color-text);
                border-radius:var(--sl-border-radius);
                font-weight:600;
                text-decoration:none;
                font-size:var(--sl-text-base);
              ">GitHub</a>
            </div>`,
      );
    });
  });

  it('deletes the Blog button outright when there is no remote', async () => {
    await withFixture({ withBlog: false }, async ({ siteDir }) => {
      const index = await readFile(join(siteDir, 'pages/index.ts'), 'utf-8');
      expect(ctaBlock(index)).toBe(
        `            <div style="display:flex;gap:1rem;justify-content:center;flex-wrap:wrap;">
              <a href="/docs/getting-started" style="
                display:inline-block;
                padding:0.6rem 1.5rem;
                background:var(--sl-color-accent);
                color:var(--sl-color-text-invert,#fff);
                border-radius:var(--sl-border-radius);
                font-weight:600;
                text-decoration:none;
                font-size:var(--sl-text-base);
              ">Get Started</a>
            </div>`,
      );
    });
  });

  it('drops the Blog feature card and leaves the other three in order', async () => {
    await withFixture({ remote: 'https://github.com/acme/widget.git', withBlog: false }, async ({ siteDir }) => {
      const index = await readFile(join(siteDir, 'pages/index.ts'), 'utf-8');
      expect(featuresBlock(index)).toBe(
        `    features: [
      {
        icon: '\u{1F4C4}',
        title: 'Docs',
        description: 'Structured documentation with sidebar, TOC, and prev/next navigation.',
      },
      {
        icon: '\u{1F3A8}',
        title: 'Theming',
        description: 'Light and dark mode via CSS custom properties. Zero JavaScript required.',
      },
      {
        icon: '⚡',
        title: 'Static',
        description: 'Pre-rendered to plain HTML. Deploy to any CDN with no server required.',
      },
    ],`,
      );
    });
  });

  it('leaves no mention of the blog anywhere on the landing page', async () => {
    await withFixture({ remote: 'https://github.com/acme/widget.git', withBlog: false }, async ({ siteDir }) => {
      const index = await readFile(join(siteDir, 'pages/index.ts'), 'utf-8');
      expect(index).not.toContain('/blog');
      expect(index).not.toContain("title: 'Blog'");
      expect(index).not.toContain('>Blog<');
    });
  });

  it('rewrites the e2e route list to exactly the two routes that survive', async () => {
    await withFixture({ remote: 'https://github.com/acme/widget.git', withBlog: false }, async ({ siteDir }) => {
      const spec = await readFile(join(siteDir, 'e2e/index.spec.ts'), 'utf-8');
      const template = await readFile(
        join(RECIPES_ROOT, 'starlight/template/e2e/index.spec.ts'),
        'utf-8',
      );
      // Only the route list changes. Everything else in the spec is untouched.
      const expected = template.replace(
        /const PRERENDERED_ROUTES = \[[\s\S]*?\];/,
        ["const PRERENDERED_ROUTES = [", "  '/',", "  '/docs/getting-started',", "];"].join('\n'),
      );
      expect(spec).toBe(expected);
    });
  });
});

describe('--for-repo with --with-blog (pinned)', () => {
  it('keeps the blog and touches neither the landing page nor the e2e spec', async () => {
    await withFixture({ remote: 'https://github.com/acme/widget.git', withBlog: true }, async ({ siteDir, plainDir }) => {
      expect(existsSync(join(siteDir, 'content/blog'))).toBe(true);
      expect(existsSync(join(siteDir, 'pages/blog'))).toBe(true);

      for (const file of ['pages/index.ts', 'e2e/index.spec.ts']) {
        const shaped = await readFile(join(siteDir, file), 'utf-8');
        const plain = await readFile(join(plainDir, file), 'utf-8');
        expect(shaped, `${file} must be untouched with --with-blog`).toBe(plain);
      }
    });
  });
});
