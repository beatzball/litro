import { describe, it, expect } from 'vitest';
import {
  normalizeRemote,
  renderMetadata,
  renderStarlightConfig,
  renderAgentsMd,
  renderNginxConf,
  type RepoInfo,
} from './for-repo.js';

const repo: RepoInfo = {
  name: 'roost',
  description: 'An on-demand tmux agent view.',
  repoUrl: 'https://github.com/beatzball/roost',
  defaultBranch: 'main',
};

describe('normalizeRemote', () => {
  it('converts an scp-style ssh remote to https', () => {
    expect(normalizeRemote('git@github.com:owner/repo.git')).toBe('https://github.com/owner/repo');
  });

  it('resolves an ssh host alias back to the real host', () => {
    // Multi-account setups use aliases like github.com-work in ~/.ssh/config;
    // the alias must not leak into a public "Edit this page" link.
    expect(normalizeRemote('git@github.com-work:owner/repo.git')).toBe(
      'https://github.com/owner/repo',
    );
  });

  it('strips credentials and the .git suffix from an https remote', () => {
    expect(normalizeRemote('https://token@github.com/owner/repo.git')).toBe(
      'https://github.com/owner/repo',
    );
  });

  it('returns empty for something that is not a remote', () => {
    expect(normalizeRemote('')).toBe('');
    expect(normalizeRemote('not a url')).toBe('');
  });
});

describe('rendered files', () => {
  it('escapes a quote in the description rather than breaking the literal', () => {
    const out = renderMetadata({ ...repo, description: "it's fine" }, 'https://x.dev');
    expect(out).toContain("\\'");
    // The emitted module must still be one valid object literal.
    expect(out.split('{').length).toBe(out.split('}').length);
  });

  it('points edit links at the repo, branch and site subdirectory', () => {
    const out = renderStarlightConfig(repo, 'site');
    expect(out).toContain("editUrlBase: 'https://github.com/beatzball/roost/edit/main/site/content/docs'");
  });

  it('omits the GitHub nav entry and edit links when there is no remote', () => {
    const out = renderStarlightConfig({ ...repo, repoUrl: '' }, 'site');
    expect(out).toContain('editUrlBase: null');
    expect(out).not.toContain("label: 'GitHub'");
  });

  it('seeds a sidebar that matches the starter page it writes', () => {
    // A sidebar naming a slug that does not exist would 404 on first build.
    expect(renderStarlightConfig(repo, 'site')).toContain("slug: 'getting-started'");
  });

  it('tells agents not to hand-edit the sidebar', () => {
    const out = renderAgentsMd(repo, 'https://roosting.dev', 'site');
    expect(out).toContain('litro docs sync');
    expect(out).toContain('Do **not** hand-edit the `sidebar` array');
  });

  it('ships the nginx config that does not drop the port', () => {
    const conf = renderNginxConf();
    expect(conf).toContain('absolute_redirect off;');
    expect(conf).toContain('try_files $uri $uri.html $uri/index.html =404;');
    expect(conf).not.toContain('$uri/ ');
  });
});

// ---------------------------------------------------------------------------
// Integration: scaffold a real site, then shape it.
// These cover bugs that only appear once the pieces are combined -- unit tests
// on the renderers cannot see a dangling link left behind in another file.
// ---------------------------------------------------------------------------
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scaffold } from './scaffold.js';
import { applyForRepo } from './for-repo.js';

async function withSite(fn: (siteDir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), 'for-repo-'));
  const siteDir = join(dir, 'site');
  try {
    await scaffold('starlight', { projectName: 'site', mode: 'ssg' }, siteDir);
    await applyForRepo({
      repoDir: dir,
      siteDir,
      siteUrl: 'https://example.dev',
      siteRelPath: 'site',
      deploy: 'docker',
      withBlog: false,
    });
    await fn(siteDir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

describe('applyForRepo (integration)', () => {
  it('leaves no dangling link to the blog it removed', async () => {
    await withSite(async (siteDir) => {
      // Deleting pages/blog is not enough: the landing page linked to /blog,
      // which would 404 on a brand-new site.
      const index = await readFile(join(siteDir, 'pages/index.ts'), 'utf-8');
      expect(index).not.toContain('/blog');
      expect(index).not.toContain("title: 'Blog'");
      expect(existsSync(join(siteDir, 'pages/blog'))).toBe(false);
      expect(existsSync(join(siteDir, 'content/blog'))).toBe(false);
    });
  });

  it('rewrites the generated e2e spec to routes that exist', async () => {
    await withSite(async (siteDir) => {
      const spec = await readFile(join(siteDir, 'e2e/index.spec.ts'), 'utf-8');
      expect(spec).not.toContain('/blog');
      expect(spec).toContain("'/docs/getting-started'");
    });
  });

  it('pins packageManager so the Docker build uses the right pnpm', async () => {
    await withSite(async (siteDir) => {
      // Without this, corepack in the image resolves the newest pnpm, which
      // can reject a lockfile written by an older one.
      const pkg = JSON.parse(await readFile(join(siteDir, 'package.json'), 'utf-8'));
      expect(pkg.packageManager ?? '').toMatch(/^pnpm@\d+\.\d+\.\d+/);
      expect(pkg.name).toMatch(/-docs$/);
    });
  });

  it('writes a starter page whose slug the seeded sidebar actually links', async () => {
    await withSite(async (siteDir) => {
      expect(existsSync(join(siteDir, 'content/docs/getting-started.md'))).toBe(true);
      const config = await readFile(join(siteDir, 'server/starlight.config.js'), 'utf-8');
      expect(config).toContain("slug: 'getting-started'");
      // and the recipe's Litro-specific sample pages are gone
      expect(existsSync(join(siteDir, 'content/docs/guides-deploying.md'))).toBe(false);
    });
  });

  it('emits the deploy files and agent instructions', async () => {
    await withSite(async (siteDir) => {
      for (const f of ['Dockerfile', 'nginx.conf', '.dockerignore', 'AGENTS.md']) {
        expect(existsSync(join(siteDir, f)), `${f} missing`).toBe(true);
      }
    });
  });
});
