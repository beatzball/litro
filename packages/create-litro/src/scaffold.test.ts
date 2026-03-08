import { describe, it, expect, afterEach } from 'vitest';
import { scaffold } from './scaffold.js';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

async function withTmpDir(fn: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), 'litro-scaffold-test-'));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

describe('scaffold', () => {
  it('fullstack recipe writes package.json with projectName interpolated', async () => {
    await withTmpDir(async (dir) => {
      const targetDir = join(dir, 'my-app');
      await scaffold('fullstack', { projectName: 'my-app', mode: 'ssr' }, targetDir);

      const pkg = JSON.parse(await readFile(join(targetDir, 'package.json'), 'utf-8')) as Record<string, unknown>;
      expect(pkg.name).toBe('my-app');
    });
  });

  it('fullstack recipe writes all expected files', async () => {
    await withTmpDir(async (dir) => {
      const targetDir = join(dir, 'test-app');
      await scaffold('fullstack', { projectName: 'test-app', mode: 'ssr' }, targetDir);

      const { existsSync } = await import('node:fs');
      expect(existsSync(join(targetDir, 'package.json'))).toBe(true);
      expect(existsSync(join(targetDir, 'tsconfig.json'))).toBe(true);
      expect(existsSync(join(targetDir, 'nitro.config.ts'))).toBe(true);
      expect(existsSync(join(targetDir, 'vite.config.ts'))).toBe(true);
      expect(existsSync(join(targetDir, 'app.ts'))).toBe(true);
      expect(existsSync(join(targetDir, 'pages/index.ts'))).toBe(true);
      expect(existsSync(join(targetDir, 'pages/blog/index.ts'))).toBe(true);
      expect(existsSync(join(targetDir, 'pages/blog/[slug].ts'))).toBe(true);
      expect(existsSync(join(targetDir, 'server/api/hello.ts'))).toBe(true);
      expect(existsSync(join(targetDir, 'server/routes/[...].ts'))).toBe(true);
      expect(existsSync(join(targetDir, 'server/stubs/page-manifest.ts'))).toBe(true);
      expect(existsSync(join(targetDir, '.gitignore'))).toBe(true);
    });
  });

  it('interpolates {{projectName}} in multiple files', async () => {
    await withTmpDir(async (dir) => {
      const targetDir = join(dir, 'cool-blog');
      await scaffold('fullstack', { projectName: 'cool-blog', mode: 'ssr' }, targetDir);

      const pkg = await readFile(join(targetDir, 'package.json'), 'utf-8');
      expect(pkg).toContain('cool-blog');

      const hello = await readFile(join(targetDir, 'server/api/hello.ts'), 'utf-8');
      expect(hello).toContain('cool-blog');

      const index = await readFile(join(targetDir, 'pages/index.ts'), 'utf-8');
      expect(index).toContain('cool-blog');
    });
  });

  it('no un-interpolated {{ }} remain in any output file', async () => {
    await withTmpDir(async (dir) => {
      const targetDir = join(dir, 'my-project');
      await scaffold('fullstack', { projectName: 'my-project', mode: 'ssr' }, targetDir);

      const binaryExts = new Set(['.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.svg',
        '.woff', '.woff2', '.ttf', '.eot', '.otf', '.pdf', '.zip', '.gz', '.tar', '.gitkeep']);

      async function collectFiles(d: string): Promise<string[]> {
        const { readdir: rd } = await import('node:fs/promises');
        const entries = await rd(d, { withFileTypes: true });
        const results: string[] = [];
        for (const e of entries) {
          const p = join(d, e.name);
          if (e.isDirectory()) {
            results.push(...(await collectFiles(p)));
          } else {
            results.push(p);
          }
        }
        return results;
      }

      const files = await collectFiles(targetDir);

      for (const file of files) {
        const extPart = file.includes('.') ? `.${file.split('.').pop()}` : '';
        if (binaryExts.has(extPart.toLowerCase())) continue;
        const content = await readFile(file, 'utf-8');
        const matches = content.match(/\{\{[^}]+\}\}/g);
        if (matches) {
          throw new Error(`Un-interpolated placeholder in ${file}: ${matches.join(', ')}`);
        }
      }
    });
  });

  it('11ty-blog recipe with mode=ssg writes litro.recipe.json', async () => {
    await withTmpDir(async (dir) => {
      const targetDir = join(dir, 'my-blog');
      await scaffold('11ty-blog', { projectName: 'my-blog', mode: 'ssg' }, targetDir);

      const { existsSync } = await import('node:fs');
      expect(existsSync(join(targetDir, 'litro.recipe.json'))).toBe(true);

      const manifest = JSON.parse(await readFile(join(targetDir, 'litro.recipe.json'), 'utf-8')) as Record<string, unknown>;
      expect(manifest.recipe).toBe('11ty-blog');
      expect(manifest.mode).toBe('ssg');
      expect(manifest.contentDir).toBe('content/blog');
    });
  });

  it('11ty-blog recipe writes content directory structure', async () => {
    await withTmpDir(async (dir) => {
      const targetDir = join(dir, 'my-blog');
      await scaffold('11ty-blog', { projectName: 'my-blog', mode: 'ssr' }, targetDir);

      const { existsSync } = await import('node:fs');
      expect(existsSync(join(targetDir, 'content/blog/hello-world.md'))).toBe(true);
      expect(existsSync(join(targetDir, 'content/blog/blog.11tydata.json'))).toBe(true);
      expect(existsSync(join(targetDir, 'content/_data/metadata.js'))).toBe(true);
    });
  });

  it('11ty-blog recipe interpolates {{projectName}} in metadata.js', async () => {
    await withTmpDir(async (dir) => {
      const targetDir = join(dir, 'awesome-blog');
      await scaffold('11ty-blog', { projectName: 'awesome-blog', mode: 'ssr' }, targetDir);

      const metadata = await readFile(join(targetDir, 'content/_data/metadata.js'), 'utf-8');
      expect(metadata).toContain('awesome-blog');
      expect(metadata).not.toContain('{{projectName}}');
    });
  });

  it('11ty-blog recipe writes all expected files', async () => {
    await withTmpDir(async (dir) => {
      const targetDir = join(dir, 'my-blog');
      await scaffold('11ty-blog', { projectName: 'my-blog', mode: 'ssg' }, targetDir);

      const { existsSync } = await import('node:fs');
      // Core config
      expect(existsSync(join(targetDir, 'package.json'))).toBe(true);
      expect(existsSync(join(targetDir, 'tsconfig.json'))).toBe(true);
      expect(existsSync(join(targetDir, 'nitro.config.ts'))).toBe(true);
      expect(existsSync(join(targetDir, 'vite.config.ts'))).toBe(true);
      expect(existsSync(join(targetDir, 'app.ts'))).toBe(true);
      expect(existsSync(join(targetDir, '.gitignore'))).toBe(true);
      expect(existsSync(join(targetDir, 'litro.recipe.json'))).toBe(true);
      // Pages — including tags page
      expect(existsSync(join(targetDir, 'pages/index.ts'))).toBe(true);
      expect(existsSync(join(targetDir, 'pages/blog/index.ts'))).toBe(true);
      expect(existsSync(join(targetDir, 'pages/blog/[slug].ts'))).toBe(true);
      expect(existsSync(join(targetDir, 'pages/tags/[tag].ts'))).toBe(true);
      // Server
      expect(existsSync(join(targetDir, 'server/routes/[...].ts'))).toBe(true);
      expect(existsSync(join(targetDir, 'server/middleware/vite-dev.ts'))).toBe(true);
      expect(existsSync(join(targetDir, 'server/api/posts.ts'))).toBe(true);
      expect(existsSync(join(targetDir, 'server/stubs/page-manifest.ts'))).toBe(true);
    });
  });

  it('11ty-blog recipe has no un-interpolated {{ }} in any output file', async () => {
    await withTmpDir(async (dir) => {
      const targetDir = join(dir, 'my-blog');
      await scaffold('11ty-blog', { projectName: 'my-blog', mode: 'ssg' }, targetDir);

      const binaryExts = new Set(['.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.svg',
        '.woff', '.woff2', '.ttf', '.eot', '.otf', '.pdf', '.zip', '.gz', '.tar', '.gitkeep']);

      async function collectFiles(d: string): Promise<string[]> {
        const { readdir: rd } = await import('node:fs/promises');
        const entries = await rd(d, { withFileTypes: true });
        const results: string[] = [];
        for (const e of entries) {
          const p = join(d, e.name);
          if (e.isDirectory()) results.push(...(await collectFiles(p)));
          else results.push(p);
        }
        return results;
      }

      const files = await collectFiles(targetDir);
      for (const file of files) {
        const extPart = file.includes('.') ? `.${file.split('.').pop()}` : '';
        if (binaryExts.has(extPart.toLowerCase())) continue;
        const content = await readFile(file, 'utf-8');
        const matches = content.match(/\{\{[^}]+\}\}/g);
        if (matches) {
          throw new Error(`Un-interpolated placeholder in ${file}: ${matches.join(', ')}`);
        }
      }
    });
  });

  it('11ty-blog page files use plain <a> tags, not <litro-link>', async () => {
    // SSG pages must use <a> for full-page-reload navigation so each pre-rendered
    // page loads its own __litro_data__. <litro-link> triggers SPA navigation which
    // leaves serverData=null on the navigated page (no __litro_data__ in DOM).
    await withTmpDir(async (dir) => {
      const targetDir = join(dir, 'my-blog');
      await scaffold('11ty-blog', { projectName: 'my-blog', mode: 'ssg' }, targetDir);

      const pageFiles = [
        join(targetDir, 'pages/index.ts'),
        join(targetDir, 'pages/blog/index.ts'),
        join(targetDir, 'pages/blog/[slug].ts'),
        join(targetDir, 'pages/tags/[tag].ts'),
      ];

      for (const file of pageFiles) {
        const content = await readFile(file, 'utf-8');
        expect(content, `${file} should not contain <litro-link>`).not.toContain('litro-link');
      }
    });
  });

  it('throws for unknown recipe', async () => {
    await withTmpDir(async (dir) => {
      const targetDir = join(dir, 'unknown');
      await expect(scaffold('does-not-exist', { projectName: 'test', mode: 'ssr' }, targetDir))
        .rejects.toThrow();
    });
  });
});
