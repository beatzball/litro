import { describe, it, expect, afterEach } from 'vitest';
import { loadRecipe, resolveRecipeLineage, scaffold } from './scaffold.js';
import { applyRecipeOptions } from './recipe-options.js';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

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

  it('fullstack template wires server actions', async () => {
    await withTmpDir(async (targetDir) => {
      await scaffold('fullstack', { projectName: 'cool-blog', mode: 'ssr' }, targetDir);

      const nitroConfig = await readFile(join(targetDir, 'nitro.config.ts'), 'utf-8');
      expect(nitroConfig).toContain("import actionsPlugin from '@beatzball/litro/plugins/actions';");
      expect(nitroConfig).toContain("route: '/__litro/action/:id'");
      expect(nitroConfig).toContain('await actionsPlugin(nitro);');
      expect(nitroConfig).toContain("'/__litro/action/**'");

      const viteConfig = await readFile(join(targetDir, 'vite.config.ts'), 'utf-8');
      expect(viteConfig).toContain("import { litroActionsPlugin } from '@beatzball/litro/vite';");
      expect(viteConfig).toContain('litroActionsPlugin()');

      const pkg = JSON.parse(await readFile(join(targetDir, 'package.json'), 'utf-8'));
      expect(pkg.imports['#litro/action-manifest']).toBe('./server/stubs/action-manifest.ts');

      const gitignore = await readFile(join(targetDir, '.gitignore'), 'utf-8');
      // The whole stubs directory is ignored rather than individually named
      // files. The scanners also emit litro-content.js and agent-*.ts, and
      // several stubs embed absolute paths from the machine that built them,
      // so naming files let a newly added scanner silently start leaking one.
      expect(gitignore).toMatch(/^server\/stubs\/$/m);
      // ...but the committed runtime plugin lives OUTSIDE stubs and must stay
      // tracked, so the directory rule must not have swallowed it.
      expect(gitignore).not.toContain('server/plugins');
      // npm strips `.gitignore` from published tarballs, so the template must
      // store it under an npm-safe name and the scaffolder renames it on copy.
      // If this ever flips back to a dotfile, the file ships from a local build
      // and silently vanishes for anyone installing from the registry.
      expect(gitignore).toContain('node_modules/');

      expect(existsSync(join(targetDir, 'actions/demo.server.ts'))).toBe(true);

      const appTs = await readFile(join(targetDir, 'app.ts'), 'utf-8');
      expect(appTs).toContain('enhanceForms');

      // Amendment: server/plugins/litro-actions.ts is a committed template
      // file (not gitignored) so actionUrl() works on the very first
      // `litro dev` run, before build:before has a chance to generate it.
      expect(existsSync(join(targetDir, 'server/plugins/litro-actions.ts'))).toBe(true);
      const runtimePlugin = await readFile(join(targetDir, 'server/plugins/litro-actions.ts'), 'utf-8');
      expect(runtimePlugin).toContain('stampActionIds');
    });
  });

  it('{{recipe}} resolves to the recipe being scaffolded, in every recipe', async () => {
    // The credit line in <litro-footer> is the same source file in all three
    // recipes, so it cannot name its own recipe — the scaffolder has to supply
    // it. A wrong or empty value here would ship a site crediting the wrong
    // recipe, which nothing else in the suite would notice.
    for (const recipe of ['fullstack', '11ty-blog', 'starlight', 'supernova'] as const) {
      await withTmpDir(async (dir) => {
        const targetDir = join(dir, 'app');
        await scaffold(recipe, { projectName: 'app', mode: 'ssg' }, targetDir);
        const footer = await readFile(
          join(targetDir, 'src/components/litro-footer.ts'),
          'utf-8',
        );
        expect(footer).toContain('https://litro.dev');

        // The value lands at the USAGE site, not in the component.
        // Exact, not just "the word appears somewhere": a recipe name can
        // occur incidentally in a page, which would make this pass vacuously.
        const home = await readFile(join(targetDir, 'pages/index.ts'), 'utf-8');
        expect(home).toContain(`<litro-footer recipe="${recipe}">`);
        expect(home).not.toContain('{{recipe}}');
      });
    }
  });

  it('templates store the ignore file under an npm-safe name', async () => {
    // npm removes `.gitignore` from every tarball it publishes, with no way to
    // opt out. A template that stores the dotfile directly works from a local
    // build and silently ships nothing to a real user, leaving the scaffolded
    // app with no ignore rules at all.
    const { existsSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const recipesRoot = fileURLToPath(new URL('../recipes', import.meta.url));
    for (const recipe of ['fullstack', '11ty-blog', 'starlight', 'supernova']) {
      // A recipe that extends another inherits the base's ignore file and must
      // not commit a second copy, so only the base of the lineage is required
      // to carry one. What every recipe must never do is store the dotfile.
      const lineage = await resolveRecipeLineage(recipe, recipesRoot);
      const carriers = lineage.filter((name) =>
        existsSync(join(recipesRoot, name, 'template', 'gitignore')),
      );
      expect(carriers.length, `${recipe} lineage has no gitignore`).toBeGreaterThan(0);
      for (const name of lineage) {
        const templateDir = join(recipesRoot, name, 'template');
        expect(existsSync(join(templateDir, '.gitignore'))).toBe(false);
      }
    }
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

  // ---------------------------------------------------------------------------
  // starlight recipe
  // ---------------------------------------------------------------------------

  it('starlight recipe writes litro.recipe.json with ssg mode', async () => {
    await withTmpDir(async (dir) => {
      const targetDir = join(dir, 'my-docs');
      await scaffold('starlight', { projectName: 'my-docs', mode: 'ssg' }, targetDir);

      const { existsSync } = await import('node:fs');
      expect(existsSync(join(targetDir, 'litro.recipe.json'))).toBe(true);

      const manifest = JSON.parse(await readFile(join(targetDir, 'litro.recipe.json'), 'utf-8')) as Record<string, unknown>;
      expect(manifest.recipe).toBe('starlight');
      expect(manifest.mode).toBe('ssg');
      expect(manifest.contentDir).toBe('content');
    });
  });

  it('starlight recipe writes all expected files', async () => {
    await withTmpDir(async (dir) => {
      const targetDir = join(dir, 'my-docs');
      await scaffold('starlight', { projectName: 'my-docs', mode: 'ssg' }, targetDir);

      const { existsSync } = await import('node:fs');
      // Core config
      expect(existsSync(join(targetDir, 'package.json'))).toBe(true);
      expect(existsSync(join(targetDir, 'tsconfig.json'))).toBe(true);
      expect(existsSync(join(targetDir, 'nitro.config.ts'))).toBe(true);
      expect(existsSync(join(targetDir, 'vite.config.ts'))).toBe(true);
      expect(existsSync(join(targetDir, 'app.ts'))).toBe(true);
      expect(existsSync(join(targetDir, '.gitignore'))).toBe(true);
      expect(existsSync(join(targetDir, 'litro.recipe.json'))).toBe(true);
      // Server
      expect(existsSync(join(targetDir, 'server/starlight.config.js'))).toBe(true);
      expect(existsSync(join(targetDir, 'server/routes/[...].ts'))).toBe(true);
      expect(existsSync(join(targetDir, 'server/middleware/vite-dev.ts'))).toBe(true);
      expect(existsSync(join(targetDir, 'server/stubs/page-manifest.ts'))).toBe(true);
      // Pages
      expect(existsSync(join(targetDir, 'pages/index.ts'))).toBe(true);
      expect(existsSync(join(targetDir, 'pages/docs/[slug].ts'))).toBe(true);
      expect(existsSync(join(targetDir, 'pages/blog/index.ts'))).toBe(true);
      expect(existsSync(join(targetDir, 'pages/blog/[slug].ts'))).toBe(true);
      expect(existsSync(join(targetDir, 'pages/blog/tags/[tag].ts'))).toBe(true);
      // Utilities
      expect(existsSync(join(targetDir, 'src/extract-headings.ts'))).toBe(true);
      expect(existsSync(join(targetDir, 'src/date-utils.ts'))).toBe(true);
      expect(existsSync(join(targetDir, 'src/route-meta.ts'))).toBe(true);
      // Components
      expect(existsSync(join(targetDir, 'src/components/starlight-page.ts'))).toBe(true);
      expect(existsSync(join(targetDir, 'src/components/starlight-header.ts'))).toBe(true);
      expect(existsSync(join(targetDir, 'src/components/starlight-sidebar.ts'))).toBe(true);
      expect(existsSync(join(targetDir, 'src/components/starlight-toc.ts'))).toBe(true);
      expect(existsSync(join(targetDir, 'src/components/litro-card.ts'))).toBe(true);
      expect(existsSync(join(targetDir, 'src/components/litro-card-grid.ts'))).toBe(true);
      expect(existsSync(join(targetDir, 'src/components/litro-badge.ts'))).toBe(true);
      expect(existsSync(join(targetDir, 'src/components/litro-aside.ts'))).toBe(true);
      expect(existsSync(join(targetDir, 'src/components/litro-tabs.ts'))).toBe(true);
      expect(existsSync(join(targetDir, 'src/components/litro-tab-item.ts'))).toBe(true);
      // Content
      expect(existsSync(join(targetDir, 'content/docs/.11tydata.json'))).toBe(true);
      expect(existsSync(join(targetDir, 'content/docs/getting-started.md'))).toBe(true);
      expect(existsSync(join(targetDir, 'content/blog/.11tydata.json'))).toBe(true);
      expect(existsSync(join(targetDir, 'content/blog/welcome.md'))).toBe(true);
      // Public
      expect(existsSync(join(targetDir, 'public/styles/starlight.css'))).toBe(true);
      // Data
      expect(existsSync(join(targetDir, '_data/metadata.js'))).toBe(true);
    });
  });

  it('starlight recipe interpolates {{projectName}} in package.json', async () => {
    await withTmpDir(async (dir) => {
      const targetDir = join(dir, 'awesome-docs');
      await scaffold('starlight', { projectName: 'awesome-docs', mode: 'ssg' }, targetDir);

      const pkg = JSON.parse(await readFile(join(targetDir, 'package.json'), 'utf-8')) as Record<string, unknown>;
      expect(pkg.name).toBe('awesome-docs');
    });
  });

  it('starlight recipe interpolates {{projectName}} in server/starlight.config.js', async () => {
    await withTmpDir(async (dir) => {
      const targetDir = join(dir, 'my-docs-site');
      await scaffold('starlight', { projectName: 'my-docs-site', mode: 'ssg' }, targetDir);

      const config = await readFile(join(targetDir, 'server/starlight.config.js'), 'utf-8');
      expect(config).toContain('my-docs-site');
      expect(config).not.toContain('{{projectName}}');
    });
  });

  it('starlight recipe has no un-interpolated {{ }} in any output file', async () => {
    await withTmpDir(async (dir) => {
      const targetDir = join(dir, 'my-docs');
      await scaffold('starlight', { projectName: 'my-docs', mode: 'ssg' }, targetDir);

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

  it('starlight recipe page files use plain <a> tags, not <litro-link>', async () => {
    // SSG pages must use <a> for full-page-reload navigation so each pre-rendered
    // page loads its own __litro_data__. <litro-link> triggers SPA navigation which
    // leaves serverData=null on the navigated page (no __litro_data__ in DOM).
    await withTmpDir(async (dir) => {
      const targetDir = join(dir, 'my-docs');
      await scaffold('starlight', { projectName: 'my-docs', mode: 'ssg' }, targetDir);

      const pageFiles = [
        join(targetDir, 'pages/index.ts'),
        join(targetDir, 'pages/docs/[slug].ts'),
        join(targetDir, 'pages/blog/index.ts'),
        join(targetDir, 'pages/blog/[slug].ts'),
        join(targetDir, 'pages/blog/tags/[tag].ts'),
      ];

      for (const file of pageFiles) {
        const content = await readFile(file, 'utf-8');
        expect(content, `${file} should not contain <litro-link>`).not.toContain('litro-link');
      }
    });
  });
});

// ---------------------------------------------------------------------------
// supernova recipe — starlight, with a landing page on top
//
// supernova is the first recipe to use `extends`. Its own template holds one
// file. Everything else a scaffolded site has comes from starlight, copied in
// first, so these tests are about the SEAM: that the base layer really lands,
// that the one file supernova owns really wins, and that the site still names
// supernova as the recipe it was built from.
// ---------------------------------------------------------------------------

describe('supernova recipe', () => {
  async function scaffoldSupernova(
    dir: string,
    recipeOptions?: Record<string, unknown>,
  ): Promise<string> {
    const targetDir = join(dir, 'my-product');
    await scaffold(
      'supernova',
      { projectName: 'my-product', mode: 'ssg', recipeOptions },
      targetDir,
    );
    return targetDir;
  }

  it('scaffolds starlight’s docs half, not a second copy of it', async () => {
    await withTmpDir(async (dir) => {
      const targetDir = await scaffoldSupernova(dir);

      // Pages and content that only starlight's template provides.
      expect(existsSync(join(targetDir, 'pages/docs/[slug].ts'))).toBe(true);
      expect(existsSync(join(targetDir, 'content/docs/getting-started.md'))).toBe(true);
      expect(existsSync(join(targetDir, 'content/docs/installation.md'))).toBe(true);
      expect(existsSync(join(targetDir, 'server/starlight.config.js'))).toBe(true);
      expect(existsSync(join(targetDir, 'src/components/starlight-header.ts'))).toBe(true);
      expect(existsSync(join(targetDir, 'src/components/litro-card.ts'))).toBe(true);
      expect(existsSync(join(targetDir, 'public/styles/starlight.css'))).toBe(true);
      // The ignore file is inherited, and npm strips it unless it is renamed
      // on the way out — which the base layer's copy must still go through.
      expect(existsSync(join(targetDir, '.gitignore'))).toBe(true);

      // ...and none of it is committed in supernova's own template. The one
      // directory the two layers share is src/components/: supernova adds the
      // landing page's own components there, on top of starlight's, so this
      // names the starlight files rather than the directory.
      const ownTemplate = fileURLToPath(
        new URL('../recipes/supernova/template', import.meta.url),
      );
      expect(existsSync(join(ownTemplate, 'pages/docs'))).toBe(false);
      expect(existsSync(join(ownTemplate, 'content'))).toBe(false);
      expect(existsSync(join(ownTemplate, 'src/components/starlight-header.ts'))).toBe(false);
      expect(existsSync(join(ownTemplate, 'src/components/litro-card.ts'))).toBe(false);
    });
  });

  it('overwrites starlight’s home page with its own', async () => {
    await withTmpDir(async (dir) => {
      const targetDir = await scaffoldSupernova(dir);

      const home = await readFile(join(targetDir, 'pages/index.ts'), 'utf-8');
      expect(home).toContain('Say what your product does, in one line.');
      expect(home).toContain('SupernovaPage');
      // The landing page is built from supernova's own components, and they
      // are copied in alongside starlight's.
      expect(home).toContain('<litro-hero-nova>');
      expect(existsSync(join(targetDir, 'src/components/litro-hero-nova.ts'))).toBe(true);
      expect(existsSync(join(targetDir, 'src/components/litro-install-command.ts'))).toBe(true);
      expect(existsSync(join(targetDir, 'src/components/litro-feature-row.ts'))).toBe(true);
      expect(existsSync(join(targetDir, 'src/components/litro-steps.ts'))).toBe(true);
      expect(existsSync(join(targetDir, 'src/components/litro-key-hints.ts'))).toBe(true);
      // starlight's home page exports SplashData. If the copy order ever
      // reversed, the file would still be a valid home page — this is the
      // assertion that notices.
      expect(home).not.toContain('SplashData');
      // The footer credit names the recipe the user asked for, not the base.
      expect(home).toContain('<litro-footer recipe="supernova">');
    });
  });

  it('records supernova in litro.recipe.json, inherited from starlight', async () => {
    await withTmpDir(async (dir) => {
      const targetDir = await scaffoldSupernova(dir, { blog: true });

      const manifest = JSON.parse(
        await readFile(join(targetDir, 'litro.recipe.json'), 'utf-8'),
      ) as Record<string, unknown>;
      expect(manifest.recipe).toBe('supernova');
      expect(manifest.mode).toBe('ssg');
      expect(manifest.contentDir).toBe('content');
      expect(manifest.options).toEqual({ blog: true });
    });
  });

  it('has no un-interpolated {{ }} in any output file', async () => {
    await withTmpDir(async (dir) => {
      const targetDir = await scaffoldSupernova(dir, { blog: true });

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

      for (const file of await collectFiles(targetDir)) {
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

  it('page files use plain <a> tags, not <litro-link>', async () => {
    await withTmpDir(async (dir) => {
      const targetDir = await scaffoldSupernova(dir);
      const home = await readFile(join(targetDir, 'pages/index.ts'), 'utf-8');
      expect(home).not.toContain('litro-link');
    });
  });

  it('keeps the blog by default', async () => {
    await withTmpDir(async (dir) => {
      const targetDir = await scaffoldSupernova(dir, { blog: true });
      const recipe = await loadRecipe('supernova');
      await applyRecipeOptions(recipe!, { blog: true }, targetDir);

      expect(existsSync(join(targetDir, 'pages/blog/index.ts'))).toBe(true);
      expect(existsSync(join(targetDir, 'content/blog/welcome.md'))).toBe(true);
      const home = await readFile(join(targetDir, 'pages/index.ts'), 'utf-8');
      expect(home).toContain('<a href="/blog"');
    });
  });

  describe('--no-blog', () => {
    it('leaves no trace of a blog anywhere in the site', async () => {
      await withTmpDir(async (dir) => {
        const targetDir = await scaffoldSupernova(dir, { blog: false });
        const recipe = await loadRecipe('supernova');
        await applyRecipeOptions(recipe!, { blog: false }, targetDir);

        expect(existsSync(join(targetDir, 'pages/blog'))).toBe(false);
        expect(existsSync(join(targetDir, 'content/blog'))).toBe(false);

        const home = await readFile(join(targetDir, 'pages/index.ts'), 'utf-8');
        expect(home).not.toContain('/blog');
        expect(home).not.toContain("title: 'Blog'");
        expect(home).not.toContain('>Blog<');

        // The header renders siteConfig.nav on EVERY page, so a Blog entry
        // left there is a dead link across the whole site, not just the
        // landing page.
        const config = await readFile(join(targetDir, 'server/starlight.config.js'), 'utf-8');
        expect(config).not.toContain("'/blog'");
        expect(config).toContain("'/docs'");
      });
    });

    it('drops only the blog routes from the e2e spec', async () => {
      await withTmpDir(async (dir) => {
        const targetDir = await scaffoldSupernova(dir, { blog: false });
        const recipe = await loadRecipe('supernova');
        await applyRecipeOptions(recipe!, { blog: false }, targetDir);

        const spec = await readFile(join(targetDir, 'e2e/index.spec.ts'), 'utf-8');
        expect(spec).not.toContain("'/blog'");
        expect(spec).not.toContain("'/blog/welcome'");
        // Every docs route survives. `--for-repo` replaces the route list
        // wholesale for its own reasons; the blog option must not.
        for (const route of [
          '/docs/getting-started',
          '/docs/installation',
          '/docs/configuration',
          '/docs/guides-first-page',
          '/docs/guides-deploying',
        ]) {
          expect(spec).toContain(`'${route}'`);
        }
      });
    });

    it('leaves the landing page valid TypeScript with the button gone', async () => {
      await withTmpDir(async (dir) => {
        const targetDir = await scaffoldSupernova(dir, { blog: false });
        const recipe = await loadRecipe('supernova');
        await applyRecipeOptions(recipe!, { blog: false }, targetDir);

        const home = await readFile(join(targetDir, 'pages/index.ts'), 'utf-8');
        // The button is held in its own binding so that deleting the anchor
        // leaves an empty template rather than a syntax error, and the three
        // remaining feature cards keep their order.
        expect(home).toContain('const blogButton = html``;');
        expect(home).toContain("title: 'Docs'");
        expect(home).toContain("title: 'Theming'");
        expect(home).toContain("title: 'Static'");
      });
    });
  });
});
