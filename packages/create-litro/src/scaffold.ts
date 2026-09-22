/**
 * scaffold.ts — Recipe-driven project scaffolding for create-litro.
 *
 * At runtime the compiled bin is dist/src/index.js and recipes live at
 * dist/recipes/<name>/. This module resolves recipe directories relative to
 * import.meta.url so it works regardless of CWD.
 *
 * No external dependencies — uses Node.js built-ins only.
 */

import { readdir, readFile, writeFile, mkdir, copyFile, stat } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertAdapterSupported } from './adapters.js';
import type { LitroRecipe } from './types.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ScaffoldOptions {
  projectName: string;
  mode: 'ssg' | 'ssr';
  adapter?: 'lit' | 'fast' | 'elena';
  recipeOptions?: Record<string, unknown>;
  recipeVersion?: string;
  /**
   * Directory the recipes are read from. Defaults to the package's own
   * `dist/recipes/`. Tests point it at a fixture tree so the mechanics of
   * `extends` and of recipe options can be exercised without adding a recipe
   * that real users would then see in `--list-recipes`.
   */
  recipesRoot?: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Returns the absolute path to the dist/recipes/ directory.
 *
 * At runtime the compiled layout is:
 *   dist/
 *     src/scaffold.js    ← this file
 *     recipes/<name>/    ← recipe configs + templates
 *
 * So we go one level up from the src/ output dir to find recipes/.
 */
function recipesDir(): string {
  // import.meta.url points to the current compiled file (dist/src/scaffold.js).
  const thisFile = fileURLToPath(import.meta.url);
  return join(dirname(thisFile), '..', 'recipes');
}

/** File extensions treated as binary — copied byte-for-byte, no interpolation. */
const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp',
  '.svg', '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.pdf', '.zip', '.gz', '.tar',
]);

function isBinary(filePath: string): boolean {
  return BINARY_EXTENSIONS.has(extname(filePath).toLowerCase());
}

/**
 * Replace `{{key}}` placeholders in `text` with values from `vars`.
 * Unknown keys are left unchanged (the `{{key}}` literal remains).
 */
function interpolate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    return Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : `{{${key}}}`;
  });
}

/**
 * Build the interpolation variable map from ScaffoldOptions.
 *
 * `recipe` is the name of the recipe the USER chose, not the layer being
 * copied. With `extends` those differ: the base recipe's files are copied in
 * too, and a file such as litro.recipe.json or the <litro-footer> credit line
 * must still name the recipe that was asked for, not the one it came from.
 */
function buildVars(options: ScaffoldOptions, recipeName: string): Record<string, string> {
  const vars: Record<string, string> = {
    projectName: options.projectName,
    mode: options.mode,
    adapter: options.adapter ?? 'lit',
    recipe: recipeName,
    recipeVersion: options.recipeVersion ?? '0.0.0',
  };

  if (options.recipeOptions) {
    for (const [k, v] of Object.entries(options.recipeOptions)) {
      vars[k] = String(v);
    }
  }

  // The whole answer set, as JSON, for the `options` field of
  // litro.recipe.json. Set last so a recipe option keyed `recipeOptions`
  // cannot overwrite the manifest with its own stringified value.
  //
  // Re-indented by one level, because the placeholder sits two spaces in and
  // the file is read by people. An empty answer set is `{}` on one line, which
  // is what the templates said before they were interpolated.
  vars.recipeOptions = JSON.stringify(options.recipeOptions ?? {}, null, 2)
    .split('\n')
    .join('\n  ');

  return vars;
}

/**
 * Template filenames that must be renamed on the way out.
 *
 * npm strips `.gitignore` from every published tarball — it is on npm's own
 * exclusion list, and there is no opting out via `files`. A template that
 * stores the file as `.gitignore` therefore ships it fine from a local build
 * and silently loses it once installed from the registry, so a scaffolded app
 * arrives with NO ignore rules at all and its first `git add` sweeps in
 * `node_modules/`, `dist/` and `.env`.
 *
 * So the template keeps it as `gitignore` (which npm ships happily) and it is
 * renamed here. `.gitkeep` and `.11tydata.json` are NOT affected — npm's list
 * is specific, not "all dotfiles" — so they stay as they are.
 */
const RENAME_ON_COPY: Record<string, string> = {
  gitignore: '.gitignore',
};

/**
 * Recursively copy all files from `srcDir` to `destDir`, applying
 * `{{placeholder}}` interpolation to text files.
 */
async function copyTemplate(
  srcDir: string,
  destDir: string,
  vars: Record<string, string>,
): Promise<void> {
  const entries = await readdir(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = join(srcDir, entry.name);
    const destPath = join(destDir, RENAME_ON_COPY[entry.name] ?? entry.name);

    if (entry.isDirectory()) {
      await mkdir(destPath, { recursive: true });
      await copyTemplate(srcPath, destPath, vars);
    } else {
      if (isBinary(entry.name)) {
        await copyFile(srcPath, destPath);
      } else {
        const raw = await readFile(srcPath, 'utf8');
        const interpolated = interpolate(raw, vars);
        await writeFile(destPath, interpolated, 'utf8');
      }
    }
  }
}

/** True when `path` exists and is a directory. Any other error propagates. */
async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw err;
  }
}

/** Resolve a layer's template directory, failing with the recipe's own name. */
async function requireTemplateDir(dir: string, recipeName: string): Promise<string> {
  if (!(await isDirectory(dir))) {
    throw new Error(`Recipe "${recipeName}" not found (looked for ${dir})`);
  }
  return dir;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Return `LitroRecipe` objects for all recipe directories found under
 * dist/recipes/. Each recipe must have a `recipe.config.js` file that
 * exports a default `LitroRecipe`.
 */
export async function listRecipes(recipesRoot?: string): Promise<LitroRecipe[]> {
  const dir = recipesRoot ?? recipesDir();
  let entries: { name: string; isDirectory(): boolean }[];

  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    // No recipes directory — return empty list.
    return [];
  }

  const recipes: LitroRecipe[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const configPath = join(dir, entry.name, 'recipe.config.js');
    try {
      // Dynamic import resolves relative to CWD when given an absolute path.
      const mod = await import(configPath) as { default: LitroRecipe };
      recipes.push(mod.default);
    } catch {
      // Skip invalid/missing recipe configs silently.
    }
  }

  return recipes;
}

/**
 * Load a single recipe by name. Returns null if not found.
 */
export async function loadRecipe(name: string, recipesRoot?: string): Promise<LitroRecipe | null> {
  const configPath = join(recipesRoot ?? recipesDir(), name, 'recipe.config.js');
  try {
    const mod = await import(configPath) as { default: LitroRecipe };
    return mod.default;
  } catch {
    return null;
  }
}

/**
 * Resolve a recipe's `extends` chain into the layer order its templates are
 * copied in: the base recipe first, then the recipe itself.
 *
 * Returns `[recipeName]` for a recipe that extends nothing, and also for a
 * recipe directory with no readable config — a directory of templates alone
 * has always been enough to scaffold from, and that stays true.
 *
 * ONE LEVEL ONLY, and both failure modes throw rather than degrade: an unknown
 * base would otherwise scaffold a half-built app whose missing half is blamed
 * on the template, and a deeper chain would give four or more silent override
 * layers.
 */
export async function resolveRecipeLineage(
  recipeName: string,
  recipesRoot?: string,
): Promise<string[]> {
  const root = recipesRoot ?? recipesDir();
  const recipe = await loadRecipe(recipeName, root);
  const baseName = recipe?.extends;
  if (!baseName) return [recipeName];

  if (baseName === recipeName) {
    throw new Error(
      `Recipe "${recipeName}" extends itself. Remove the \`extends\` field, or ` +
        `point it at a different recipe.`,
    );
  }

  const base = await loadRecipe(baseName, root);
  if (!base) {
    throw new Error(
      `Recipe "${recipeName}" extends "${baseName}", which does not exist. ` +
        `Check the \`extends\` field in recipes/${recipeName}/recipe.config.ts.`,
    );
  }

  if (base.extends) {
    throw new Error(
      `Recipe "${recipeName}" extends "${baseName}", which itself extends ` +
        `"${base.extends}". A recipe may extend one level only. Give ` +
        `"${recipeName}" a base that extends nothing.`,
    );
  }

  return [baseName, recipeName];
}

/**
 * Scaffold a project from a recipe into `targetDir`.
 *
 * @param recipeName  The recipe directory name (e.g. "fullstack").
 * @param options     Scaffold options (projectName, mode, etc.).
 * @param targetDir   Absolute path to the target project directory.
 */
export async function scaffold(
  recipeName: string,
  options: ScaffoldOptions,
  targetDir: string,
): Promise<void> {
  const root = options.recipesRoot ?? recipesDir();
  const lineage = await resolveRecipeLineage(recipeName, root);
  const adapter = options.adapter ?? 'lit';

  // Refuse an adapter the recipe does not declare, BEFORE the target directory
  // is created. A half-written directory is worse than a refusal, and a mixed
  // one — FAST config over a Lit landing page — is worse than either.
  //
  // A recipe directory with no readable config is left alone: templates alone
  // have always been enough to scaffold from, and that stays true.
  const recipe = await loadRecipe(recipeName, root);
  if (recipe) assertAdapterSupported(recipe, adapter);

  // Copy order, for `extends`: the base recipe's template/, the base's
  // template-<adapter>/, this recipe's template/, this recipe's
  // template-<adapter>/. Later layers overwrite earlier ones, so a recipe's
  // own adapter overlay has the last word — which it must, or a supernova
  // overlay would be silently undone by the starlight one it sits under.
  //
  // A per-adapter overlay is optional. A layer's base template/ is not: a
  // recipe named in `extends` with no template/ is a broken recipe, and
  // scaffolding half an app is worse than refusing.
  const layers: string[] = [];
  for (const name of lineage) {
    layers.push(await requireTemplateDir(join(root, name, 'template'), name));
    if (adapter !== 'lit') {
      const overlay = join(root, name, `template-${adapter}`);
      if (await isDirectory(overlay)) layers.push(overlay);
    }
  }

  await mkdir(targetDir, { recursive: true });

  // One variable map for every layer, built from the recipe the USER chose:
  // a base layer's files must name the chosen recipe, not the base.
  const vars = buildVars(options, recipeName);

  for (const layer of layers) {
    await copyTemplate(layer, targetDir, vars);
  }
}
