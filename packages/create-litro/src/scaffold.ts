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
 * `recipe` is the recipe directory name. Templates use it for the credit line
 * in <litro-footer>, which is the same file in every recipe and so cannot
 * hardcode which recipe it came from.
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

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Return `LitroRecipe` objects for all recipe directories found under
 * dist/recipes/. Each recipe must have a `recipe.config.js` file that
 * exports a default `LitroRecipe`.
 */
export async function listRecipes(): Promise<LitroRecipe[]> {
  const dir = recipesDir();
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
export async function loadRecipe(name: string): Promise<LitroRecipe | null> {
  const configPath = join(recipesDir(), name, 'recipe.config.js');
  try {
    const mod = await import(configPath) as { default: LitroRecipe };
    return mod.default;
  } catch {
    return null;
  }
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
  const templateDir = join(recipesDir(), recipeName, 'template');

  // Verify the template directory exists.
  try {
    const s = await stat(templateDir);
    if (!s.isDirectory()) {
      throw new Error(`Recipe template path is not a directory: ${templateDir}`);
    }
  } catch (err: unknown) {
    const nodeErr = err as NodeJS.ErrnoException;
    if (nodeErr.code === 'ENOENT') {
      throw new Error(`Recipe "${recipeName}" not found (looked for ${templateDir})`);
    }
    throw err;
  }

  // Create the target directory.
  await mkdir(targetDir, { recursive: true });

  // Build interpolation variables and copy all files.
  const vars = buildVars(options, recipeName);
  await copyTemplate(templateDir, targetDir, vars);

  // Per-adapter overlay: if a template-<adapter>/ directory exists alongside
  // the base template/, copy its files on top — overwriting matching paths.
  // This allows recipes to provide adapter-specific variants of files that
  // differ structurally (page components, app.ts, config files) while sharing
  // framework-agnostic files (content, CSS, utilities) from the base template.
  const adapter = options.adapter ?? 'lit';
  if (adapter !== 'lit') {
    const overlayDir = join(recipesDir(), recipeName, `template-${adapter}`);
    try {
      const s = await stat(overlayDir);
      if (s.isDirectory()) {
        await copyTemplate(overlayDir, targetDir, vars);
      }
    } catch {
      // No overlay directory for this adapter — that's fine, base template is used as-is.
    }
  }
}
