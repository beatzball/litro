/**
 * `extends`, and the recipe options that ride on it.
 *
 * WHY THE FIXTURES ARE BUILT AT RUN TIME
 *
 * None of the three shipped recipes extends another or declares an option, and
 * adding one just to be tested would put it in front of real users in
 * `--list-recipes`. So each test writes the recipes it needs into a temporary
 * directory and points the scaffolder at it with `recipesRoot`. Nothing here
 * exists on disk in the package, so nothing here can be published by accident.
 *
 * Where a test needs the real starlight recipe — the blog lives there — it is
 * copied in, not symlinked: `readdir(..., { withFileTypes: true })` reports a
 * symlink as a symlink, not a directory, and the copier would then try to read
 * a directory as a file.
 */
import { describe, it, expect } from 'vitest';
import { mkdtemp, mkdir, rm, readFile, writeFile, cp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  listRecipes,
  resolveRecipeLineage,
  scaffold,
  type ScaffoldOptions,
} from './scaffold.js';
import {
  applyRecipeOptions,
  assertFlagsApply,
  declaresOption,
  resolveRecipeOptions,
  type OptionPrompts,
} from './recipe-options.js';
import { parseArgs } from './args.js';
import type { LitroRecipe } from './types.js';

const REAL_RECIPES = fileURLToPath(new URL('../recipes', import.meta.url));

interface FixtureRecipe {
  /** Everything but `name`, which comes from the map key. */
  config?: Partial<LitroRecipe>;
  /** Files under `template/`, keyed by relative path. */
  template?: Record<string, string>;
  /** Files under `template-fast/`, keyed by relative path. */
  fast?: Record<string, string>;
}

interface Fixtures {
  /** The recipes root to pass as `recipesRoot`. */
  root: string;
  /** A fresh, non-existent target directory for a scaffold. */
  target(name?: string): string;
}

async function writeFiles(dir: string, files: Record<string, string>): Promise<void> {
  for (const [rel, body] of Object.entries(files)) {
    const dest = join(dir, rel);
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, body, 'utf-8');
  }
}

/**
 * Build a temporary recipes root and run a test against it.
 *
 * @param recipes  Fixture recipes to write, keyed by recipe name.
 * @param copyReal Names of shipped recipes to copy in alongside them.
 */
async function withRecipes(
  recipes: Record<string, FixtureRecipe>,
  copyReal: string[],
  fn: (f: Fixtures) => Promise<void>,
): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), 'litro-extends-'));
  const root = join(dir, 'recipes');
  await mkdir(root, { recursive: true });

  try {
    for (const name of copyReal) {
      await cp(join(REAL_RECIPES, name), join(root, name), { recursive: true });
    }

    for (const [name, fixture] of Object.entries(recipes)) {
      const recipeDir = join(root, name);
      await mkdir(recipeDir, { recursive: true });
      const config: Record<string, unknown> = {
        name,
        displayName: name,
        description: `Fixture recipe ${name}`,
        mode: 'ssg',
        ...fixture.config,
      };
      await writeFile(
        join(recipeDir, 'recipe.config.js'),
        `export default ${JSON.stringify(config, null, 2)};\n`,
        'utf-8',
      );
      // A recipe always has a template/, even when the fixture adds no files.
      await mkdir(join(recipeDir, 'template'), { recursive: true });
      await writeFiles(join(recipeDir, 'template'), fixture.template ?? {});
      if (fixture.fast) await writeFiles(join(recipeDir, 'template-fast'), fixture.fast);
    }

    let n = 0;
    await fn({ root, target: (name = `app-${++n}`) => join(dir, 'out', name) });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** The four-layer fixture: a base and a child, each with a FAST overlay. */
const LAYERED: Record<string, FixtureRecipe> = {
  base: {
    template: {
      'only-base.txt': 'base template',
      'all-four.txt': 'base template',
      'base-and-child.txt': 'base template',
    },
    fast: {
      'only-base-fast.txt': 'base overlay',
      'all-four.txt': 'base overlay',
    },
  },
  child: {
    config: { extends: 'base' },
    template: {
      'only-child.txt': 'child template',
      'all-four.txt': 'child template',
      'base-and-child.txt': 'child template',
    },
    fast: {
      'all-four.txt': 'child overlay',
    },
  },
};

async function read(dir: string, rel: string): Promise<string> {
  return readFile(join(dir, rel), 'utf-8');
}

describe('extends — copy order', () => {
  const opts = (root: string, adapter?: ScaffoldOptions['adapter']): ScaffoldOptions => ({
    projectName: 'app',
    mode: 'ssg',
    adapter,
    recipesRoot: root,
  });

  it('copies the base template in, then lets the recipe overwrite it', async () => {
    await withRecipes(LAYERED, [], async ({ root, target }) => {
      const out = target();
      await scaffold('child', opts(root), out);

      expect(await read(out, 'only-base.txt')).toBe('base template');
      expect(await read(out, 'only-child.txt')).toBe('child template');
      expect(await read(out, 'base-and-child.txt')).toBe('child template');
    });
  });

  it('gives the recipe its own adapter overlay the last word', async () => {
    // All four layers provide this file. If the base's FAST overlay were
    // copied after the recipe's, a supernova overlay would be silently undone
    // by the starlight one it sits under — the bug this order exists to stop.
    await withRecipes(LAYERED, [], async ({ root, target }) => {
      const out = target();
      await scaffold('child', opts(root, 'fast'), out);
      expect(await read(out, 'all-four.txt')).toBe('child overlay');
    });
  });

  it("copies the base's adapter overlay before the recipe's own template", async () => {
    await withRecipes(LAYERED, [], async ({ root, target }) => {
      const out = target();
      await scaffold('child', opts(root, 'fast'), out);
      // Only the base's FAST overlay has this file, so it must arrive...
      expect(await read(out, 'only-base-fast.txt')).toBe('base overlay');
      // ...and the recipe's own template still wins where both have a file.
      expect(await read(out, 'base-and-child.txt')).toBe('child template');
    });
  });

  it('ignores an adapter overlay that does not exist', async () => {
    await withRecipes(LAYERED, [], async ({ root, target }) => {
      const out = target();
      await scaffold('child', opts(root, 'elena'), out);
      expect(await read(out, 'all-four.txt')).toBe('child template');
    });
  });

  it('leaves a recipe that extends nothing exactly as it was', async () => {
    await withRecipes(LAYERED, [], async ({ root, target }) => {
      const out = target();
      await scaffold('base', opts(root), out);
      expect(existsSync(join(out, 'only-child.txt'))).toBe(false);
      expect(await read(out, 'all-four.txt')).toBe('base template');
    });
  });
});

describe('extends — refusals', () => {
  it('refuses a chain deeper than one level, naming both recipes', async () => {
    await withRecipes(
      { ...LAYERED, grandchild: { config: { extends: 'child' } } },
      [],
      async ({ root, target }) => {
        await expect(
          scaffold('grandchild', { projectName: 'app', mode: 'ssg', recipesRoot: root }, target()),
        ).rejects.toThrow(
          /"grandchild" extends "child", which itself extends "base"\. A recipe may extend one level only/,
        );
      },
    );
  });

  it('refuses an unknown base, naming both recipes', async () => {
    await withRecipes(
      { orphan: { config: { extends: 'no-such-recipe' } } },
      [],
      async ({ root, target }) => {
        await expect(
          scaffold('orphan', { projectName: 'app', mode: 'ssg', recipesRoot: root }, target()),
        ).rejects.toThrow(/"orphan" extends "no-such-recipe", which does not exist/);
      },
    );
  });

  it('refuses a recipe that extends itself', async () => {
    await withRecipes({ loop: { config: { extends: 'loop' } } }, [], async ({ root, target }) => {
      await expect(
        scaffold('loop', { projectName: 'app', mode: 'ssg', recipesRoot: root }, target()),
      ).rejects.toThrow(/"loop" extends itself/);
    });
  });

  it('refuses a base whose template directory is missing, naming the base', async () => {
    await withRecipes(LAYERED, [], async ({ root, target }) => {
      await rm(join(root, 'base', 'template'), { recursive: true, force: true });
      await expect(
        scaffold('child', { projectName: 'app', mode: 'ssg', recipesRoot: root }, target()),
      ).rejects.toThrow(/Recipe "base" not found/);
    });
  });
});

describe('the shipped recipes are untouched by extends', () => {
  it('each resolves to itself alone', async () => {
    for (const name of ['fullstack', '11ty-blog', 'starlight']) {
      expect(await resolveRecipeLineage(name)).toEqual([name]);
    }
  });

  it('--list-recipes still lists all three', async () => {
    const names = (await listRecipes()).map((r) => r.name).sort();
    expect(names).toEqual(['11ty-blog', 'fullstack', 'starlight']);
  });
});

describe('litro.recipe.json', () => {
  const SUPERNOVA: Record<string, FixtureRecipe> = {
    'supernova-fixture': {
      config: { extends: 'starlight', mode: 'ssg', contentLayer: 'content' },
      template: { 'pages/landing.ts': '// the recipe’s own page\n' },
    },
  };

  it('names the recipe the user chose, not the base it came from', async () => {
    await withRecipes(SUPERNOVA, ['starlight'], async ({ root, target }) => {
      const out = target();
      await scaffold(
        'supernova-fixture',
        { projectName: 'app', mode: 'ssg', recipesRoot: root },
        out,
      );

      // The file itself comes from starlight's template. Left hard-coded, it
      // would tell every tool downstream that this app is a starlight app.
      const manifest = JSON.parse(await read(out, 'litro.recipe.json'));
      expect(manifest.recipe).toBe('supernova-fixture');
      expect(existsSync(join(out, 'pages/landing.ts'))).toBe(true);
      expect(existsSync(join(out, 'pages/docs/[slug].ts'))).toBe(true);
    });
  });

  it('records the resolved recipe options', async () => {
    await withRecipes(SUPERNOVA, ['starlight'], async ({ root, target }) => {
      const out = target();
      await scaffold(
        'supernova-fixture',
        { projectName: 'app', mode: 'ssg', recipeOptions: { blog: false }, recipesRoot: root },
        out,
      );
      const manifest = JSON.parse(await read(out, 'litro.recipe.json'));
      expect(manifest.options).toEqual({ blog: false });
    });
  });

  it('is still valid JSON with an empty options object when nothing was asked', async () => {
    await withRecipes({}, ['starlight'], async ({ root, target }) => {
      const out = target();
      await scaffold('starlight', { projectName: 'app', mode: 'ssg', recipesRoot: root }, out);
      const manifest = JSON.parse(await read(out, 'litro.recipe.json'));
      expect(manifest.options).toEqual({});
      expect(manifest.recipe).toBe('starlight');
    });
  });
});

// ---------------------------------------------------------------------------
// The `blog` recipe option
// ---------------------------------------------------------------------------

const BLOG_RECIPE: Record<string, FixtureRecipe> = {
  'blog-option-fixture': {
    config: {
      extends: 'starlight',
      mode: 'ssg',
      options: [
        { key: 'blog', prompt: 'Include a blog?', type: 'confirm', default: true },
      ],
    },
  },
};

/** Prompts that record what they were asked and answer from a script. */
function scriptedPrompts(answers: string[]): OptionPrompts & { asked: string[] } {
  const asked: string[] = [];
  let i = 0;
  return {
    asked,
    async text(question: string, defaultVal: string) {
      asked.push(question);
      return answers[i++] ?? defaultVal;
    },
    async select(question: string, choices: string[], defaultVal?: string) {
      asked.push(question);
      return answers[i++] ?? defaultVal ?? choices[0];
    },
  };
}

describe('the blog recipe option', () => {
  const recipe: LitroRecipe = {
    name: 'blog-option-fixture',
    displayName: 'Fixture',
    description: 'Fixture',
    mode: 'ssg',
    extends: 'starlight',
    options: [{ key: 'blog', prompt: 'Include a blog?', type: 'confirm', default: true }],
  };

  it('takes the answer from --no-blog without asking', async () => {
    const prompts = scriptedPrompts([]);
    const resolved = await resolveRecipeOptions(recipe, { blog: false }, prompts);
    expect(resolved).toEqual({ blog: false });
    expect(prompts.asked).toEqual([]);
  });

  it('takes the answer from --blog without asking', async () => {
    const prompts = scriptedPrompts([]);
    expect(await resolveRecipeOptions(recipe, { blog: true }, prompts)).toEqual({ blog: true });
    expect(prompts.asked).toEqual([]);
  });

  it('asks when no flag answered it, and reads y/n', async () => {
    const yes = scriptedPrompts(['y']);
    expect(await resolveRecipeOptions(recipe, {}, yes)).toEqual({ blog: true });
    expect(yes.asked).toEqual(['Include a blog? (y/n)']);

    const no = scriptedPrompts(['n']);
    expect(await resolveRecipeOptions(recipe, {}, no)).toEqual({ blog: false });
  });

  it('falls back to the declared default when the answer is empty', async () => {
    // A non-TTY run returns the default unchanged, so the default must be the
    // one the recipe declared — here, yes.
    const prompts: OptionPrompts = {
      async text(_q, defaultVal) { return defaultVal; },
      async select(_q, choices, defaultVal) { return defaultVal ?? choices[0]; },
    };
    expect(await resolveRecipeOptions(recipe, {}, prompts)).toEqual({ blog: true });
  });

  it('refuses --no-blog on a recipe that has no blog question', () => {
    const starlight: LitroRecipe = {
      name: 'starlight',
      displayName: 'Starlight',
      description: 'Docs',
      mode: 'ssg',
    };
    expect(() => assertFlagsApply(starlight, { blog: false })).toThrow(
      /--blog \/ --no-blog answers the 'blog' option, which the 'starlight' recipe does not have/,
    );
    expect(() => assertFlagsApply(recipe, { blog: false })).not.toThrow();
  });

  it('knows which recipes declare the option', () => {
    expect(declaresOption(recipe, 'blog')).toBe(true);
    expect(declaresOption({ ...recipe, options: undefined }, 'blog')).toBe(false);
  });
});

describe('answering no to the blog, end to end', () => {
  async function scaffoldWithBlogAnswer(
    blog: boolean,
    fn: (out: string) => Promise<void>,
  ): Promise<void> {
    await withRecipes(BLOG_RECIPE, ['starlight'], async ({ root, target }) => {
      const out = target();
      const loaded = JSON.parse(
        await readFile(join(root, 'blog-option-fixture/recipe.config.js'), 'utf-8')
          .then((s) => s.replace(/^export default /, '').replace(/;\n$/, '')),
      ) as LitroRecipe;

      const resolved = await resolveRecipeOptions(loaded, { blog }, scriptedPrompts([]));
      await scaffold(
        'blog-option-fixture',
        { projectName: 'app', mode: 'ssg', recipeOptions: resolved, recipesRoot: root },
        out,
      );
      await applyRecipeOptions(loaded, resolved, out);
      await fn(out);
    });
  }

  it('leaves no blog pages, no blog content and no blog link', async () => {
    await scaffoldWithBlogAnswer(false, async (out) => {
      expect(existsSync(join(out, 'pages/blog'))).toBe(false);
      expect(existsSync(join(out, 'content/blog'))).toBe(false);

      const index = await read(out, 'pages/index.ts');
      expect(index).not.toContain('/blog');
      expect(index).not.toContain("title: 'Blog'");
      expect(index).not.toContain('>Blog<');
    });
  });

  it('drops the blog routes from the e2e spec and keeps every other one', async () => {
    await scaffoldWithBlogAnswer(false, async (out) => {
      const spec = await read(out, 'e2e/index.spec.ts');
      expect(spec).not.toContain("'/blog");
      // The docs routes are not the blog's business and must survive.
      for (const route of [
        "'/'",
        "'/docs/getting-started'",
        "'/docs/installation'",
        "'/docs/guides-deploying'",
      ]) {
        expect(spec, `${route} missing from the route list`).toContain(route);
      }
    });
  });

  it('records the answer in litro.recipe.json', async () => {
    await scaffoldWithBlogAnswer(false, async (out) => {
      const manifest = JSON.parse(await read(out, 'litro.recipe.json'));
      expect(manifest.options).toEqual({ blog: false });
      expect(manifest.recipe).toBe('blog-option-fixture');
    });
  });

  it('keeps everything when the answer is yes', async () => {
    await scaffoldWithBlogAnswer(true, async (out) => {
      expect(existsSync(join(out, 'pages/blog/index.ts'))).toBe(true);
      expect(existsSync(join(out, 'content/blog/welcome.md'))).toBe(true);
      expect(await read(out, 'pages/index.ts')).toContain('/blog');
      expect(await read(out, 'e2e/index.spec.ts')).toContain("'/blog'");
      const manifest = JSON.parse(await read(out, 'litro.recipe.json'));
      expect(manifest.options).toEqual({ blog: true });
    });
  });
});

// ---------------------------------------------------------------------------
// Flags and --for-repo
// ---------------------------------------------------------------------------

describe('parseArgs', () => {
  it('reads --blog and --no-blog as an answer to the blog option', () => {
    expect(parseArgs(['--no-blog']).recipeOptionFlags).toEqual({ blog: false });
    expect(parseArgs(['--blog']).recipeOptionFlags).toEqual({ blog: true });
  });

  it('leaves the option unanswered when neither flag is given, so it is asked', () => {
    expect(parseArgs(['my-app']).recipeOptionFlags).toEqual({});
  });

  it('keeps --with-blog separate: it is --for-repo’s flag, not a recipe option', () => {
    const args = parseArgs(['site', '--for-repo', '.', '--with-blog']);
    expect(args.withBlog).toBe(true);
    expect(args.recipeOptionFlags).toEqual({});
  });

  it('does not mistake a flag for the project name', () => {
    expect(parseArgs(['--no-blog', 'my-app']).projectName).toBe('my-app');
  });
});

describe('--for-repo accepts a recipe built on starlight', () => {
  it('resolves a recipe that extends starlight to a lineage containing it', async () => {
    await withRecipes(
      { 'supernova-fixture': { config: { extends: 'starlight' } } },
      ['starlight'],
      async ({ root }) => {
        const lineage = await resolveRecipeLineage('supernova-fixture', root);
        expect(lineage).toEqual(['starlight', 'supernova-fixture']);
        expect(lineage.includes('starlight')).toBe(true);
      },
    );
  });

  it('does not put starlight in the lineage of an unrelated recipe', async () => {
    expect((await resolveRecipeLineage('fullstack')).includes('starlight')).toBe(false);
    expect((await resolveRecipeLineage('11ty-blog')).includes('starlight')).toBe(false);
    expect((await resolveRecipeLineage('starlight')).includes('starlight')).toBe(true);
  });
});
