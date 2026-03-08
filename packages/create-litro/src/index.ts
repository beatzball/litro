#!/usr/bin/env node
/**
 * create-litro — Scaffolding CLI for Litro
 *
 * Usage:
 *   npm create litro
 *   npx create-litro
 *   npx create-litro <project-name> [--recipe <recipe>] [--mode <ssg|ssr>]
 *   npx create-litro --list-recipes
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
  listRecipes: boolean;
}

function parseArgs(argv: string[]): ParsedArgs {
  // argv = process.argv.slice(2)
  let projectName: string | undefined;
  let recipe: string | undefined;
  let mode: 'ssg' | 'ssr' | undefined;
  let listRecipesFlag = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--list-recipes') {
      listRecipesFlag = true;
    } else if (arg === '--recipe' || arg === '-r') {
      recipe = argv[++i];
    } else if (arg === '--mode' || arg === '-m') {
      const val = argv[++i];
      if (val === 'ssg' || val === 'ssr') mode = val;
    } else if (!arg.startsWith('-') && projectName === undefined) {
      projectName = arg;
    }
  }

  return { projectName, recipe, mode, listRecipes: listRecipesFlag };
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

  // 4. Recipe-specific options (prompt for any that are defined on the recipe)
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

  // 5. Validate target directory
  const projectDir = join(process.cwd(), projectName);

  if (existsSync(projectDir)) {
    console.error(`\n  Error: directory "${projectName}" already exists.\n`);
    process.exit(1);
  }

  // 6. Scaffold
  const options: ScaffoldOptions = {
    projectName,
    mode,
    recipeOptions,
    recipeVersion: '0.0.1',
  };

  await scaffold(chosenRecipe.name, options, projectDir);

  console.log(`
  Created ${projectName}

  Next steps:

    cd ${projectName}
    npm install          # or: pnpm install / yarn install
    npm run dev          # start dev server on http://localhost:3030

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
