#!/usr/bin/env node
/**
 * create-litro — Scaffolding CLI for Litro
 *
 * Usage:
 *   npm create litro
 *   npx create-litro
 *
 * Prompts for project name, mode, and TypeScript preference,
 * then scaffolds a new Litro project directory.
 *
 * No external dependencies — uses Node.js built-ins only.
 */

import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import process from 'node:process';

const rl = createInterface({ input, output });

async function prompt(question: string, defaultVal = ''): Promise<string> {
  const answer = await rl.question(
    defaultVal ? `${question} (${defaultVal}): ` : `${question}: `,
  );
  return answer.trim() || defaultVal;
}

async function main(): Promise<void> {
  console.log('\n  Welcome to Litro!\n');

  const projectName = await prompt('Project name', 'my-litro-app');
  const mode = await prompt('Mode (fullstack/static)', 'fullstack');
  const useTs =
    (await prompt('TypeScript? (yes/no)', 'yes')).toLowerCase() !== 'no';

  rl.close();

  const projectDir = join(process.cwd(), projectName);

  if (existsSync(projectDir)) {
    console.error(`\n  Error: directory "${projectName}" already exists.\n`);
    process.exit(1);
  }

  // Create directory structure
  await mkdir(projectDir, { recursive: true });
  await mkdir(join(projectDir, 'pages'), { recursive: true });
  await mkdir(join(projectDir, 'server', 'api'), { recursive: true });
  await mkdir(join(projectDir, 'public'), { recursive: true });

  const ext = useTs ? 'ts' : 'js';

  // ── package.json ─────────────────────────────────────────────────────────
  await writeFile(
    join(projectDir, 'package.json'),
    JSON.stringify(
      {
        name: projectName,
        private: true,
        type: 'module',
        scripts: {
          dev: 'litro dev',
          build: `litro build --mode ${mode === 'static' ? 'static' : 'server'}`,
          preview: 'litro preview',
          generate: 'litro generate',
        },
        dependencies: {
          litro: 'latest',
          lit: '^3.0.0',
          '@lit-labs/ssr': '^3.0.0',
          '@lit-labs/ssr-client': '^1.0.0',
          '@vaadin/router': '^2.0.0',
          nitropack: '^2.0.0',
          vite: '^5.0.0',
        },
        devDependencies: {
          typescript: '^5.0.0',
        },
      },
      null,
      2,
    ),
  );

  // ── tsconfig.json ─────────────────────────────────────────────────────────
  if (useTs) {
    await writeFile(
      join(projectDir, 'tsconfig.json'),
      JSON.stringify(
        {
          compilerOptions: {
            target: 'ES2022',
            module: 'NodeNext',
            moduleResolution: 'NodeNext',
            strict: true,
            experimentalDecorators: true,
            useDefineForClassFields: false,
          },
        },
        null,
        2,
      ),
    );
  }

  // ── nitro.config.ts / nitro.config.js ─────────────────────────────────────
  await writeFile(
    join(projectDir, `nitro.config.${ext}`),
    `import { defineNitroConfig } from 'nitropack/config';
import pagesPlugin from 'litro/plugins';

export default defineNitroConfig({
  plugins: [pagesPlugin()],
  publicAssets: [{ dir: 'dist/client', baseURL: '/_litro/', maxAge: 31536000 }],
  externals: { inline: ['@lit-labs/ssr', '@lit-labs/ssr-client'] },
});
`,
  );

  // ── vite.config.ts / vite.config.js ──────────────────────────────────────
  await writeFile(
    join(projectDir, `vite.config.${ext}`),
    `import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist/client',
    rollupOptions: { input: 'app.${ext}' },
  },
});
`,
  );

  // ── app.ts / app.js ───────────────────────────────────────────────────────
  // CRITICAL: @lit-labs/ssr-client/lit-element-hydrate-support.js must be
  // the very first import — it patches LitElement.prototype.createRenderRoot()
  // before any LitElement subclass is evaluated.
  await writeFile(
    join(projectDir, `app.${ext}`),
    `// CRITICAL: must be first import — patches LitElement before any component loads
import '@lit-labs/ssr-client/lit-element-hydrate-support.js';
import 'litro/runtime/LitroOutlet.js';
import 'litro/runtime/LitroLink.js';
import { routes } from './dist/client/routes.generated.js';

document.addEventListener('DOMContentLoaded', () => {
  const outlet = document.querySelector('litro-outlet');
  if (outlet) (outlet as any).routes = routes;
});
`,
  );

  // ── pages/index.ts / pages/index.js ───────────────────────────────────────
  await writeFile(
    join(projectDir, `pages/index.${ext}`),
    `import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';

@customElement('page-home')
export class HomePage extends LitElement {
  render() {
    return html\`
      <h1>Welcome to ${projectName}</h1>
      <p>Edit <code>pages/index.${ext}</code> to get started.</p>
    \`;
  }
}

export default HomePage;
`,
  );

  // ── server/api/hello.ts / server/api/hello.js ─────────────────────────────
  await writeFile(
    join(projectDir, `server/api/hello.${ext}`),
    `export default defineEventHandler(() => ({
  message: 'Hello from ${projectName}!',
  timestamp: new Date().toISOString(),
}));
`,
  );

  console.log(`
  Created ${projectName}

  Next steps:
    cd ${projectName}
    npm install
    npm run dev

  Documentation: https://github.com/your-org/litro
`);
}

main().catch((err: unknown) => {
  console.error('[create-litro] Fatal error:', err);
  process.exit(1);
});
