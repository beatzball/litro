/**
 * args.ts — command-line parsing for create-litro.
 *
 * Separate from index.ts so the parse is testable: index.ts runs the CLI on
 * import, which a test cannot do.
 */
import type { RecipeOptionFlags } from './recipe-options.js';

export interface ParsedArgs {
  projectName: string | undefined;
  recipe: string | undefined;
  mode: 'ssg' | 'ssr' | undefined;
  adapter: 'lit' | 'fast' | 'elena' | undefined;
  listRecipes: boolean;
  /** Repository the docs are for; enables --for-repo post-processing. */
  forRepo: string | undefined;
  siteUrl: string | undefined;
  deploy: 'docker' | 'none';
  withBlog: boolean;
  /**
   * Answers to the chosen recipe's own options, from flags such as
   * `--no-blog`. A key is present only when the user typed its flag, so an
   * unanswered option still gets its prompt.
   */
  recipeOptionFlags: RecipeOptionFlags;
}

export function parseArgs(argv: string[]): ParsedArgs {
  // argv = process.argv.slice(2)
  let projectName: string | undefined;
  let recipe: string | undefined;
  let mode: 'ssg' | 'ssr' | undefined;
  let adapter: 'lit' | 'fast' | 'elena' | undefined;
  let listRecipesFlag = false;
  let forRepo: string | undefined;
  let siteUrl: string | undefined;
  let deploy: 'docker' | 'none' = 'docker';
  let withBlog = false;
  const recipeOptionFlags: RecipeOptionFlags = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--list-recipes') {
      listRecipesFlag = true;
    } else if (arg === '--recipe' || arg === '-r') {
      recipe = argv[++i];
    } else if (arg === '--mode' || arg === '-m') {
      const val = argv[++i];
      if (val === 'ssg' || val === 'ssr') mode = val;
    } else if (arg === '--adapter' || arg === '-a') {
      const val = argv[++i];
      if (val === 'lit' || val === 'fast' || val === 'elena') adapter = val;
    } else if (arg === '--for-repo') {
      forRepo = argv[++i] ?? '.';
    } else if (arg.startsWith('--for-repo=')) {
      forRepo = arg.slice('--for-repo='.length);
    } else if (arg === '--site-url') {
      siteUrl = argv[++i];
    } else if (arg.startsWith('--site-url=')) {
      siteUrl = arg.slice('--site-url='.length);
    } else if (arg === '--deploy') {
      const val = argv[++i];
      if (val === 'docker' || val === 'none') deploy = val;
    } else if (arg === '--with-blog') {
      // --for-repo's own flag, not a recipe option: it says what --for-repo
      // does to the blog the recipe already shipped.
      withBlog = true;
    } else if (arg === '--blog') {
      recipeOptionFlags.blog = true;
    } else if (arg === '--no-blog') {
      recipeOptionFlags.blog = false;
    } else if (!arg.startsWith('-') && projectName === undefined) {
      projectName = arg;
    }
  }

  return {
    projectName, recipe, mode, adapter, listRecipes: listRecipesFlag,
    forRepo, siteUrl, deploy, withBlog, recipeOptionFlags,
  };
}
