/**
 * Which adapters a recipe declares, and what happens when a user asks for one
 * it does not.
 *
 * `--recipe supernova --adapter fast` used to exit 0 with a mixed app: the
 * starlight FAST overlay in supernova's lineage set `LITRO_ADAPTER = 'fast'`
 * and swapped the docs pages over, then supernova's own template put its Lit
 * landing page back on top. Support is therefore DECLARED by each recipe, not
 * read off the `template-<adapter>/` directories the lineage happens to carry.
 *
 * The fixture recipes are built at run time, the way `extends.test.ts` builds
 * its own, so nothing here can reach a real user through `--list-recipes`.
 */
import { describe, it, expect } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ADAPTERS,
  adapterChoices,
  adapterFromChoice,
  assertAdapterSupported,
  supportedAdapters,
  supportsAdapter,
} from './adapters.js';
import { scaffold } from './scaffold.js';
import type { LitroAdapter, LitroRecipe } from './types.js';

import elevenTyBlog from '../recipes/11ty-blog/recipe.config.js';
import fullstack from '../recipes/fullstack/recipe.config.js';
import starlight from '../recipes/starlight/recipe.config.js';
import supernova from '../recipes/supernova/recipe.config.js';

/**
 * What each shipped recipe can really produce today.
 *
 * Checked against the `template-<adapter>/` directories that exist, and
 * against the VARIANTS list in scripts/verify-scaffolded-apps.mjs, which is
 * the record of which combinations are actually built in CI.
 */
const EXPECTED: Record<string, LitroAdapter[]> = {
  '11ty-blog': ['lit'],
  fullstack: ['lit', 'elena'],
  starlight: ['lit', 'fast', 'elena'],
  supernova: ['lit'],
};

const SHIPPED: LitroRecipe[] = [elevenTyBlog, fullstack, starlight, supernova];

function recipe(name: string, adapters: LitroAdapter[], rest: Partial<LitroRecipe> = {}): LitroRecipe {
  return {
    name,
    displayName: name,
    description: `Fixture recipe ${name}`,
    mode: 'ssg',
    adapters,
    ...rest,
  };
}

describe('what each shipped recipe declares', () => {
  for (const r of SHIPPED) {
    it(`'${r.name}' declares ${EXPECTED[r.name].join(', ')}`, () => {
      expect(supportedAdapters(r)).toEqual(EXPECTED[r.name]);
    });
  }

  it('agrees with the VARIANTS list that is actually built', async () => {
    // scripts/verify-scaffolded-apps.mjs runs its whole flow on import, so the
    // list is read as text rather than imported. If that file's shape changes,
    // this test fails loudly instead of quietly passing on an empty match.
    const script = fileURLToPath(new URL('../../../scripts/verify-scaffolded-apps.mjs', import.meta.url));
    const body = await readFile(script, 'utf-8');
    const block = /const VARIANTS = \[([\s\S]*?)\n\];/.exec(body);
    expect(block, 'VARIANTS list not found in verify-scaffolded-apps.mjs').not.toBeNull();

    const built: Record<string, Set<string>> = {};
    const entry = /recipe: '([^']+)',\s*adapter: '([^']+)'/g;
    let match: RegExpExecArray | null;
    while ((match = entry.exec(block![1])) !== null) {
      (built[match[1]] ??= new Set()).add(match[2]);
    }
    expect(Object.keys(built).sort()).toEqual(Object.keys(EXPECTED).sort());

    for (const r of SHIPPED) {
      expect([...built[r.name]].sort(), `VARIANTS for '${r.name}'`)
        .toEqual([...supportedAdapters(r)].sort());
    }
  });
});

describe('support is declared, never inferred from the overlays on disk', () => {
  it('refuses an adapter the recipe inherits an overlay for but cannot produce', async () => {
    // The supernova shape exactly: a base with a FAST overlay, and a child
    // that declares Lit only and overwrites the page the overlay swapped.
    await withRecipes(async ({ root, target }) => {
      await writeRecipe(root, recipe('base', ['lit', 'fast']), {
        'pages/index.ts': 'base lit page',
      }, { 'pages/index.ts': 'base fast page' });

      await writeRecipe(root, recipe('child', ['lit'], { extends: 'base' }), {
        'pages/index.ts': 'child lit page',
      });

      const out = target();
      await expect(
        scaffold('child', { projectName: 'app', mode: 'ssg', adapter: 'fast', recipesRoot: root }, out),
      ).rejects.toThrow(
        "The 'child' recipe supports the 'lit' adapter today. " +
          "Re-run without --adapter, or pick a recipe that supports 'fast'.",
      );
    });
  });

  it('writes nothing at all when it refuses', async () => {
    await withRecipes(async ({ root, target }) => {
      await writeRecipe(root, recipe('child', ['lit']), { 'pages/index.ts': 'lit page' });
      const out = target();
      await expect(
        scaffold('child', { projectName: 'app', mode: 'ssg', adapter: 'elena', recipesRoot: root }, out),
      ).rejects.toThrow();
      expect(existsSync(out)).toBe(false);
    });
  });

  it('still scaffolds every adapter the recipe does declare', async () => {
    await withRecipes(async ({ root, target }) => {
      await writeRecipe(root, recipe('multi', ['lit', 'fast']), {
        'pages/index.ts': 'lit page',
      }, { 'pages/index.ts': 'fast page' });

      const lit = target('lit-app');
      await scaffold('multi', { projectName: 'app', mode: 'ssg', adapter: 'lit', recipesRoot: root }, lit);
      expect(await readFile(join(lit, 'pages/index.ts'), 'utf-8')).toBe('lit page');

      const fast = target('fast-app');
      await scaffold('multi', { projectName: 'app', mode: 'ssg', adapter: 'fast', recipesRoot: root }, fast);
      expect(await readFile(join(fast, 'pages/index.ts'), 'utf-8')).toBe('fast page');
    });
  });

  it('leaves a recipe directory with no readable config alone', async () => {
    // Templates alone have always been enough to scaffold from.
    await withRecipes(async ({ root, target }) => {
      const dir = join(root, 'bare');
      await mkdir(join(dir, 'template'), { recursive: true });
      await writeFile(join(dir, 'template', 'a.txt'), 'bare', 'utf-8');

      const out = target();
      await scaffold('bare', { projectName: 'app', mode: 'ssg', adapter: 'fast', recipesRoot: root }, out);
      expect(await readFile(join(out, 'a.txt'), 'utf-8')).toBe('bare');
    });
  });
});

describe('the refusal message', () => {
  it('names the recipe, what it supports, and what was asked for', () => {
    expect(() => assertAdapterSupported(supernova, 'fast')).toThrow(
      "The 'supernova' recipe supports the 'lit' adapter today. " +
        "Re-run without --adapter, or pick a recipe that supports 'fast'.",
    );
  });

  it('lists several supported adapters in a readable way', () => {
    expect(() => assertAdapterSupported(fullstack, 'fast')).toThrow(
      "The 'fullstack' recipe supports the 'lit' and 'elena' adapters today. " +
        "Re-run without --adapter, or pick a recipe that supports 'fast'.",
    );
    expect(() => assertAdapterSupported(recipe('all', ['lit', 'fast', 'elena']), 'lit' as LitroAdapter))
      .not.toThrow();
  });

  it('accepts every adapter the recipe declares and refuses the rest', () => {
    for (const r of SHIPPED) {
      for (const adapter of ADAPTERS) {
        if (EXPECTED[r.name].includes(adapter)) {
          expect(() => assertAdapterSupported(r, adapter)).not.toThrow();
          expect(supportsAdapter(r, adapter)).toBe(true);
        } else {
          expect(() => assertAdapterSupported(r, adapter)).toThrow(`The '${r.name}' recipe supports`);
          expect(supportsAdapter(r, adapter)).toBe(false);
        }
      }
    }
  });

  it('falls back to Lit alone for a config with no declaration', () => {
    // Only a hand-written config can get here — the type requires the field.
    const undeclared = { name: 'odd', displayName: 'odd', description: '', mode: 'ssg' } as unknown as LitroRecipe;
    expect(supportedAdapters(undeclared)).toEqual(['lit']);
    expect(() => assertAdapterSupported(undeclared, 'fast')).toThrow("supports the 'lit' adapter");
  });
});

describe('the interactive prompt', () => {
  it('offers only the adapters the chosen recipe supports', () => {
    expect(adapterChoices(supernova)).toEqual(['lit — Lit (default)']);
    expect(adapterChoices(fullstack)).toEqual(['lit — Lit (default)', 'elena — Elena (light DOM)']);
    expect(adapterChoices(starlight)).toEqual([
      'lit — Lit (default)',
      'fast — Microsoft FAST Element',
      'elena — Elena (light DOM)',
    ]);
  });

  it('turns a chosen line back into its adapter name', () => {
    for (const choice of adapterChoices(starlight)) {
      expect(ADAPTERS).toContain(adapterFromChoice(choice));
    }
    expect(adapterFromChoice('elena — Elena (light DOM)')).toBe('elena');
    expect(adapterFromChoice('fast — Microsoft FAST Element')).toBe('fast');
    expect(adapterFromChoice('lit — Lit (default)')).toBe('lit');
  });
});

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

interface Fixtures {
  root: string;
  target(name?: string): string;
}

async function withRecipes(fn: (f: Fixtures) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), 'litro-adapters-'));
  const root = join(dir, 'recipes');
  await mkdir(root, { recursive: true });
  try {
    let n = 0;
    await fn({ root, target: (name = `app-${++n}`) => join(dir, 'out', name) });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function writeRecipe(
  root: string,
  config: LitroRecipe,
  template: Record<string, string>,
  fastOverlay?: Record<string, string>,
): Promise<void> {
  const dir = join(root, config.name);
  await mkdir(dir, { recursive: true });
  await writeFile(
    join(dir, 'recipe.config.js'),
    `export default ${JSON.stringify(config, null, 2)};\n`,
    'utf-8',
  );
  await writeFiles(join(dir, 'template'), template);
  if (fastOverlay) await writeFiles(join(dir, 'template-fast'), fastOverlay);
}

async function writeFiles(dir: string, files: Record<string, string>): Promise<void> {
  await mkdir(dir, { recursive: true });
  for (const [rel, body] of Object.entries(files)) {
    const dest = join(dir, rel);
    await mkdir(join(dest, '..'), { recursive: true });
    await writeFile(dest, body, 'utf-8');
  }
}
