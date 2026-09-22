#!/usr/bin/env node
/**
 * create-litro — Scaffolding CLI for Litro
 *
 * Usage:
 *   npm create @beatzball/litro
 *   npx @beatzball/create-litro
 *   npx @beatzball/create-litro <project-path> [--recipe <recipe>] [--mode <ssg|ssr>] [--adapter <lit|fast|elena>]
 *
 * <project-path> is a path, not a bare name. Relative to the current
 * directory, or absolute, and a quoted leading `~` means your home
 * directory. The project is named after the last segment.
 *
 * A recipe declares which adapters it can produce. Asking for one it cannot is
 * refused before anything is written, and the prompt offers only what it can.
 *
 * Documentation site for an existing repository:
 *   npx @beatzball/create-litro site --recipe starlight --for-repo . \
 *     --site-url https://example.dev
 *
 *   --for-repo <dir>   read the repo's name, description, remote and default
 *                      branch, then write metadata, the starlight config,
 *                      a deploy (Dockerfile + nginx.conf) and an AGENTS.md
 *   --site-url <url>   canonical URL the site is served from
 *   --deploy <docker|none>   deploy files to emit (default: docker)
 *   --with-blog        keep the recipe's sample blog (default: removed)
 *
 * Recipe options:
 *   --blog, --no-blog  answer a recipe's "Include a blog?" question without
 *                      being asked. Only for a recipe that offers it.
 *
 *   npx @beatzball/create-litro --list-recipes
 *
 * Prompts for project name, recipe, and mode, then scaffolds a complete
 * Litro project from the selected recipe template.
 *
 * No external dependencies — uses Node.js built-ins only.
 */

import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { existsSync } from 'node:fs';
import process from 'node:process';
import { listRecipes, loadRecipe, resolveRecipeLineage, scaffold } from './scaffold.js';
import { applyForRepo } from './for-repo.js';
import { parseArgs } from './args.js';
import { resolveProjectPath, resolveUserPath } from './project-path.js';
import {
  adapterChoices,
  adapterFromChoice,
  assertAdapterSupported,
  supportedAdapters,
} from './adapters.js';
import {
  applyRecipeOptions,
  assertFlagsApply,
  declaresOption,
  resolveRecipeOptions,
} from './recipe-options.js';
import type { LitroAdapter, LitroRecipe } from './types.js';
import type { ScaffoldOptions } from './scaffold.js';

// ---------------------------------------------------------------------------
// Prompt helpers
// ---------------------------------------------------------------------------

async function prompt(question: string, defaultVal = ''): Promise<string> {
  // If stdin is not a TTY (piped/redirected), use the default immediately.
  if (!process.stdin.isTTY) return defaultVal;

  const rl = createInterface({ input, output });
  const answer = await rl.question(
    defaultVal ? `${question} (${defaultVal}): ` : `${question}: `,
  );
  rl.close();
  return answer.trim() || defaultVal;
}

async function promptSelect(question: string, choices: string[], defaultVal?: string): Promise<string> {
  if (!process.stdin.isTTY) return defaultVal ?? choices[0];

  const lines = choices.map((c, i) => `  ${i + 1}. ${c}`).join('\n');
  const defaultIdx = defaultVal ? choices.indexOf(defaultVal) + 1 : 1;
  const rl = createInterface({ input, output });

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const answer = await rl.question(`${question}\n${lines}\n  Choice (${defaultIdx}): `);
    const trimmed = answer.trim();
    if (trimmed === '') {
      rl.close();
      return choices[defaultIdx - 1];
    }
    const n = parseInt(trimmed, 10);
    if (!isNaN(n) && n >= 1 && n <= choices.length) {
      rl.close();
      return choices[n - 1];
    }
    // Allow typing the value directly.
    if (choices.includes(trimmed)) {
      rl.close();
      return trimmed;
    }
    process.stdout.write(`  Please enter a number between 1 and ${choices.length}.\n`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  // --list-recipes: print available recipes and exit.
  if (args.listRecipes) {
    const recipes = await listRecipes();
    if (recipes.length === 0) {
      console.log('\n  No recipes found.\n');
    } else {
      console.log('\n  Available recipes:\n');
      for (const r of recipes) {
        console.log(`    ${r.name.padEnd(20)} ${r.displayName} — ${r.description}`);
      }
      console.log('');
    }
    return;
  }

  console.log('\n  Welcome to Litro!\n');

  // 1. Project path
  //
  // The argument is a PATH, not a bare name: `create-litro /tmp/demo/my-app`
  // must write to /tmp/demo/my-app. It used to be joined onto the current
  // directory, which concatenates an absolute path rather than replacing it,
  // so the app landed in ./tmp/demo/my-app and the CLI reported success.
  const projectArg = args.projectName ?? await prompt('Project name', 'my-litro-app');
  let project: ReturnType<typeof resolveProjectPath>;
  try {
    project = resolveProjectPath(projectArg);
  } catch (err: unknown) {
    console.error(`\n  ${(err as Error).message}\n`);
    process.exit(1);
  }
  // `name` is the last segment alone: {{projectName}} becomes package.json's
  // `name` and the site title, and neither can hold a path.
  const projectName = project.name;

  // 2. Recipe selection
  const recipes = await listRecipes();
  let chosenRecipe: LitroRecipe;

  if (args.recipe) {
    const found = await loadRecipe(args.recipe);
    if (!found) {
      console.error(`\n  Error: recipe "${args.recipe}" not found.\n`);
      process.exit(1);
    }
    chosenRecipe = found;
  } else if (recipes.length === 0) {
    console.error('\n  Error: no recipes available.\n');
    process.exit(1);
  } else if (recipes.length === 1) {
    chosenRecipe = recipes[0];
  } else {
    const displayNames = recipes.map((r) => `${r.name} — ${r.description}`);
    const selected = await promptSelect('Select a recipe:', displayNames);
    // Match back to the recipe by index in displayNames.
    const idx = displayNames.indexOf(selected);
    chosenRecipe = recipes[idx !== -1 ? idx : 0];
  }

  // 3. Mode selection (only if recipe supports both)
  let mode: 'ssg' | 'ssr';
  if (chosenRecipe.mode === 'both') {
    if (args.mode) {
      mode = args.mode;
    } else {
      const selected = await promptSelect(
        'Deployment mode:',
        ['ssr — Server-side rendering (Node.js / edge)', 'ssg — Static site generation (CDN)'],
        'ssr — Server-side rendering (Node.js / edge)',
      );
      mode = selected.startsWith('ssg') ? 'ssg' : 'ssr';
    }
  } else {
    mode = chosenRecipe.mode as 'ssg' | 'ssr';
  }

  // 4. Adapter selection
  //
  // Only the adapters the chosen recipe declares are ever on offer, and an
  // adapter asked for on the command line is refused here — before the target
  // directory is even named, so a refusal leaves nothing behind.
  const choices = adapterChoices(chosenRecipe);
  let adapter: LitroAdapter;
  if (args.adapter) {
    try {
      assertAdapterSupported(chosenRecipe, args.adapter);
    } catch (err: unknown) {
      console.error(`\n  ${(err as Error).message}\n`);
      process.exit(1);
    }
    adapter = args.adapter;
  } else if (choices.length === 1) {
    // Nothing to choose from — asking a one-answer question wastes a keystroke.
    adapter = supportedAdapters(chosenRecipe)[0];
  } else {
    const selected = await promptSelect('Component framework:', choices, choices[0]);
    adapter = adapterFromChoice(selected);
  }

  // 5. Recipe-specific options.
  //
  // --for-repo owns the blog when it is in play: it removes the blog itself,
  // with a repository URL to repoint the Blog button at, so --with-blog is the
  // answer and the question is not asked twice.
  const forRepoOwnsBlog = args.forRepo !== undefined && declaresOption(chosenRecipe, 'blog');
  const optionFlags = { ...args.recipeOptionFlags };
  if (forRepoOwnsBlog) optionFlags.blog = args.withBlog;

  try {
    assertFlagsApply(chosenRecipe, args.recipeOptionFlags);
  } catch (err: unknown) {
    console.error(`\n  ${(err as Error).message}\n`);
    process.exit(1);
  }

  const recipeOptions = await resolveRecipeOptions(chosenRecipe, optionFlags, {
    text: prompt,
    select: promptSelect,
  });

  // 6. Validate target directory
  //
  // The SAME resolved path the scaffolder writes to, so an existing directory
  // is still refused and nothing is ever overwritten.
  const projectDir = project.dir;

  if (existsSync(projectDir)) {
    console.error(`\n  Error: directory "${project.display}" already exists.\n`);
    process.exit(1);
  }

  // 7. Scaffold
  const options: ScaffoldOptions = {
    projectName,
    mode,
    adapter,
    recipeOptions,
    recipeVersion: '0.0.1',
  };

  await scaffold(chosenRecipe.name, options, projectDir);

  // Some answers change what is on disk. This runs after every template layer
  // is copied, so a base recipe's blog is removed along with the recipe's own.
  await applyRecipeOptions(
    chosenRecipe,
    recipeOptions,
    projectDir,
    forRepoOwnsBlog ? ['blog'] : [],
  );

  // --for-repo turns the generic recipe output into *this project's* docs
  // site. Only starlight, and recipes built on it, produce a docs site, so
  // refuse loudly rather than half-applying to a template with no content/docs.
  let forRepoSummary = '';
  if (args.forRepo !== undefined) {
    // A recipe that extends starlight has starlight's docs site in it, so it
    // can be shaped the same way. Anything else has no content/docs to shape.
    const lineage = await resolveRecipeLineage(chosenRecipe.name);
    if (!lineage.includes('starlight')) {
      console.error(
        `\n  --for-repo builds a documentation site, which only the ` +
          `'starlight' recipe and recipes built on it provide.\n  Got ` +
          `'${chosenRecipe.name}'. Re-run with --recipe starlight.\n`,
      );
      process.exit(1);
    }
    const { relative } = await import('node:path');
    let repoDir: string;
    try {
      repoDir = resolveUserPath(args.forRepo);
    } catch (err: unknown) {
      console.error(`\n  --for-repo: ${(err as Error).message}\n`);
      process.exit(1);
    }
    // Both sides are absolute, so this is the real path from the repo root to
    // the site — the edit links in the generated starlight config depend on it.
    const siteRelPath = relative(repoDir, projectDir) || projectName;

    const repo = await applyForRepo({
      repoDir,
      siteDir: projectDir,
      siteUrl: args.siteUrl,
      siteRelPath,
      deploy: args.deploy,
      withBlog: args.withBlog,
    });

    forRepoSummary =
      `\n  Shaped for ${repo.name}` +
      (repo.repoUrl ? ` (${repo.repoUrl})` : ' (no git remote found)') +
      (args.siteUrl ? `\n  Site URL: ${args.siteUrl}` : '') +
      (repo.description ? '' : '\n  No description found — set one in _data/metadata.js.') +
      (args.siteUrl ? '' : '\n  No --site-url given — set `url` in _data/metadata.js.') +
      `\n  Wrote AGENTS.md — point your coding agent at it before editing pages.`;
  }

  console.log(`
  Created ${project.display}${forRepoSummary}

  Next steps:

    cd ${project.display}
    npm install          # or: pnpm install / yarn install
    npm run dev          # start dev server on http://localhost:3000

  Commands:
    npm run dev          start development server
    npm run build        production build (Vite + Nitro)
    npm run preview      preview the production build
`);
}

main().catch((err: unknown) => {
  console.error('[create-litro] Fatal error:', err);
  process.exit(1);
});
