/**
 * recipe-options.ts — asking a recipe's own questions, and acting on the answers.
 *
 * A recipe may declare options in its config. They are asked at scaffold time,
 * recorded in the scaffolded app's litro.recipe.json, and some of them change
 * what is on disk afterwards.
 *
 * The prompts are injected rather than imported so the whole path — flag
 * handling, defaults, and the effect an answer has on the scaffolded files —
 * is testable without a terminal.
 */
import type { LitroRecipe } from './types.js';
import { removeBlog } from './blog.js';

/** The prompt surface a caller supplies. The CLI passes its readline helpers. */
export interface OptionPrompts {
  text(question: string, defaultVal: string): Promise<string>;
  select(question: string, choices: string[], defaultVal?: string): Promise<string>;
}

/**
 * Answers given on the command line, keyed by option. A key present here is
 * not asked for.
 */
export type RecipeOptionFlags = Record<string, unknown>;

/**
 * How each flag is spelled, for error messages. A user who typed `--no-blog`
 * should read `--no-blog` back, not `blog`.
 */
const FLAG_SPELLING: Record<string, string> = {
  blog: '--blog / --no-blog',
};

/** True when the recipe declares an option with this key. */
export function declaresOption(recipe: LitroRecipe, key: string): boolean {
  return (recipe.options ?? []).some((opt) => opt.key === key);
}

/**
 * Refuse a flag the chosen recipe has no question for.
 *
 * Ignoring it silently is worse than failing: a CI job that passes `--no-blog`
 * to a recipe without a blog option would publish a site with the blog still
 * in it and no sign that anything went wrong.
 */
export function assertFlagsApply(recipe: LitroRecipe, flags: RecipeOptionFlags): void {
  for (const key of Object.keys(flags)) {
    if (declaresOption(recipe, key)) continue;
    const spelling = FLAG_SPELLING[key] ?? `--${key}`;
    throw new Error(
      `${spelling} answers the '${key}' option, which the '${recipe.name}' recipe ` +
        `does not have. Drop the flag, or pick a recipe that asks for '${key}'.`,
    );
  }
}

/**
 * Resolve every option the recipe declares, asking only what no flag answered.
 */
export async function resolveRecipeOptions(
  recipe: LitroRecipe,
  flags: RecipeOptionFlags,
  prompts: OptionPrompts,
): Promise<Record<string, unknown>> {
  const resolved: Record<string, unknown> = {};

  for (const opt of recipe.options ?? []) {
    if (Object.prototype.hasOwnProperty.call(flags, opt.key)) {
      resolved[opt.key] = flags[opt.key];
      continue;
    }

    if (opt.type === 'select' && opt.choices) {
      resolved[opt.key] = await prompts.select(
        opt.prompt,
        opt.choices,
        opt.default as string | undefined,
      );
    } else if (opt.type === 'confirm') {
      const answer = await prompts.text(`${opt.prompt} (y/n)`, opt.default ? 'y' : 'n');
      resolved[opt.key] = answer.toLowerCase().startsWith('y');
    } else {
      resolved[opt.key] = await prompts.text(opt.prompt, String(opt.default ?? ''));
    }
  }

  return resolved;
}

/**
 * Act on the answers, once the templates are on disk.
 *
 * @param skip  Option keys another step owns. `--for-repo` takes 'blog',
 *              because it removes the blog itself and has a repository URL to
 *              repoint the Blog button at.
 */
export async function applyRecipeOptions(
  recipe: LitroRecipe,
  resolved: Record<string, unknown>,
  projectDir: string,
  skip: string[] = [],
): Promise<void> {
  if (
    declaresOption(recipe, 'blog') &&
    !skip.includes('blog') &&
    resolved.blog === false
  ) {
    await removeBlog(projectDir);
  }
}
