#!/usr/bin/env node
/**
 * create-litro — Scaffolding CLI for Litro
 *
 * Usage:
 *   npm create @beatzball/litro
 *   npx @beatzball/create-litro
 *   npx @beatzball/create-litro <project-name> [--recipe <recipe>] [--mode <ssg|ssr>] [--adapter <lit|fast|elena>]
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
import { join } from 'node:path';
import process from 'node:process';
import { listRecipes, loadRecipe, scaffold } from './scaffold.js';
import { applyForRepo } from './for-repo.js';
import type { LitroRecipe } from './types.js';
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
// CLI argument parsing
// ---------------------------------------------------------------------------

interface ParsedArgs {
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
}

function parseArgs(argv: string[]): ParsedArgs {
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
      withBlog = true;
    } else if (!arg.startsWith('-') && projectName === undefined) {
      projectName = arg;
    }
  }

  return {
    projectName, recipe, mode, adapter, listRecipes: listRecipesFlag,
    forRepo, siteUrl, deploy, withBlog,
  };
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

  // 1. Project name
  const projectName = args.projectName ?? await prompt('Project name', 'my-litro-app');

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
  let adapter: 'lit' | 'fast' | 'elena';
  if (args.adapter) {
    adapter = args.adapter;
  } else {
    const selected = await promptSelect(
      'Component framework:',
      ['lit — Lit (default)', 'fast — Microsoft FAST Element', 'elena — Elena (light DOM)'],
      'lit — Lit (default)',
    );
    adapter = selected.startsWith('elena') ? 'elena' : selected.startsWith('fast') ? 'fast' : 'lit';
  }

  // 5. Recipe-specific options (prompt for any that are defined on the recipe)
  const recipeOptions: Record<string, unknown> = {};
  if (chosenRecipe.options && chosenRecipe.options.length > 0) {
    for (const opt of chosenRecipe.options) {
      if (opt.type === 'select' && opt.choices) {
        const selected = await promptSelect(opt.prompt, opt.choices, opt.default as string | undefined);
        recipeOptions[opt.key] = selected;
      } else if (opt.type === 'confirm') {
        const answer = await prompt(`${opt.prompt} (y/n)`, opt.default ? 'y' : 'n');
        recipeOptions[opt.key] = answer.toLowerCase().startsWith('y');
      } else {
        // text
        const answer = await prompt(opt.prompt, String(opt.default ?? ''));
        recipeOptions[opt.key] = answer;
      }
    }
  }

  // 6. Validate target directory
  const projectDir = join(process.cwd(), projectName);

  if (existsSync(projectDir)) {
    console.error(`\n  Error: directory "${projectName}" already exists.\n`);
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

  // --for-repo turns the generic recipe output into *this project's* docs
  // site. Only the starlight recipe produces a docs site, so refuse loudly
  // rather than half-applying to a template with no content/docs.
  let forRepoSummary = '';
  if (args.forRepo !== undefined) {
    if (chosenRecipe.name !== 'starlight') {
      console.error(
        `\n  --for-repo builds a documentation site, which only the ` +
          `'starlight' recipe provides.\n  Got '${chosenRecipe.name}'. ` +
          `Re-run with --recipe starlight.\n`,
      );
      process.exit(1);
    }
    const { relative, resolve: resolvePath } = await import('node:path');
    const repoDir = resolvePath(args.forRepo);
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
  Created ${projectName}${forRepoSummary}

  Next steps:

    cd ${projectName}
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
