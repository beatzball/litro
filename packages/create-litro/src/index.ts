#!/usr/bin/env node
/**
 * create-litro — Scaffolding CLI for Litro
 *
 * Usage:
 *   npm create litro
 *   npx create-litro
 *
 * Prompts for project name and mode, then scaffolds a complete Litro project
 * with pages, blog routes, API handler, server middleware, and all config files.
 *
 * No external dependencies — uses Node.js built-ins only.
 */

import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import process from 'node:process';

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

async function main(): Promise<void> {
  // Support non-interactive usage: create-litro <name> [mode]
  const [,, argName, argMode] = process.argv;

  console.log('\n  Welcome to Litro!\n');

  const projectName = argName ?? await prompt('Project name', 'my-litro-app');
  const mode = argMode ?? await prompt('Mode (fullstack/static)', 'fullstack');

  const projectDir = join(process.cwd(), projectName);

  if (existsSync(projectDir)) {
    console.error(`\n  Error: directory "${projectName}" already exists.\n`);
    process.exit(1);
  }

  // ── Directory structure ───────────────────────────────────────────────────
  await mkdir(join(projectDir, 'pages', 'blog'), { recursive: true });
  await mkdir(join(projectDir, 'server', 'api'), { recursive: true });
  await mkdir(join(projectDir, 'server', 'middleware'), { recursive: true });
  await mkdir(join(projectDir, 'server', 'routes'), { recursive: true });
  await mkdir(join(projectDir, 'server', 'stubs'), { recursive: true });
  await mkdir(join(projectDir, 'public'), { recursive: true });

  // ── package.json ──────────────────────────────────────────────────────────
  await writeFile(
    join(projectDir, 'package.json'),
    JSON.stringify(
      {
        name: projectName,
        private: true,
        type: 'module',
        // "#litro/page-manifest" fallback stub — populated by the pages plugin on
        // every build. The "imports" field lets Node.js resolve the #-prefixed
        // specifier via package.json before @rollup/plugin-node-resolve uses the
        // virtual module set by the Nitro plugin. Keep this in sync with the pages
        // plugin output location.
        imports: {
          '#litro/page-manifest': './server/stubs/page-manifest.ts',
        },
        scripts: {
          dev: 'litro dev',
          build: `litro build${mode === 'static' ? ' --mode static' : ''}`,
          preview: 'litro preview',
          generate: 'litro generate',
        },
        dependencies: {
          litro: 'latest',
          lit: '^3.2.1',
          '@lit-labs/ssr': '^3.3.0',
          '@lit-labs/ssr-client': '^1.1.7',
          h3: '^1.13.0',
        },
        devDependencies: {
          nitropack: '^2.10.4',
          vite: '^5.4.11',
          typescript: '^5.7.3',
        },
      },
      null,
      2,
    ),
  );

  // ── tsconfig.json ─────────────────────────────────────────────────────────
  await writeFile(
    join(projectDir, 'tsconfig.json'),
    JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          strict: true,
          skipLibCheck: true,
          esModuleInterop: true,
          experimentalDecorators: true,
          useDefineForClassFields: false,
        },
        include: ['**/*.ts', '**/*.tsx'],
        exclude: ['node_modules', 'dist', '.nitro'],
      },
      null,
      2,
    ),
  );

  // ── .gitignore ────────────────────────────────────────────────────────────
  await writeFile(
    join(projectDir, '.gitignore'),
    `# Dependencies
node_modules/

# Build outputs
dist/
.output/
.nitro/

# Generated (overwritten on every build by the pages plugin)
server/stubs/page-manifest.ts
routes.generated.ts

# TypeScript build info
*.tsbuildinfo

# OS / editor
.DS_Store
.env
.env.*
*.local
`,
  );

  // ── nitro.config.ts ───────────────────────────────────────────────────────
  // Uses litro/plugins, litro/plugins/ssg, and litro/config package exports.
  // publicAssets.dir is relative to srcDir (= 'server/'), so '../dist/client'
  // reaches the Vite output at <rootDir>/dist/client.
  await writeFile(
    join(projectDir, 'nitro.config.ts'),
    `import { defineNitroConfig } from 'nitropack/config';
import type { Nitro } from 'nitropack';
import { resolve } from 'node:path';
import { ssrPreset, ssgPreset } from 'litro/config';
import pagesPlugin from 'litro/plugins';
import ssgPlugin from 'litro/plugins/ssg';

// LITRO_MODE controls the deployment target at build time:
//   LITRO_MODE=server  litro build     (default — Node.js server)
//   LITRO_MODE=static  litro generate  (SSG — static HTML for CDN)
const mode = process.env.LITRO_MODE ?? 'server';

export default defineNitroConfig({
  ...(mode === 'static' ? ssgPreset() : ssrPreset()),

  // Nitro auto-discovers server/routes/, server/api/, server/middleware/
  srcDir: 'server',

  // publicAssets.dir is resolved relative to srcDir ('server/').
  // Use '../dist/client' (not 'dist/client') to reach <rootDir>/dist/client.
  publicAssets: [
    { dir: '../dist/client', baseURL: '/_litro/', maxAge: 31536000 },
    { dir: '../public',      baseURL: '/',        maxAge: 0 },
  ],

  // Must be bundled for edge runtimes (Cloudflare Workers, Vercel Edge).
  externals: { inline: ['@lit-labs/ssr', '@lit-labs/ssr-client'] },

  // Lit uses legacy experimental decorators.
  esbuild: {
    options: {
      tsconfigRaw: {
        compilerOptions: {
          experimentalDecorators: true,
          useDefineForClassFields: false,
        },
      },
    },
  },

  // Exclude vite-dev.ts from auto-discovery so import('vite') never enters
  // the production module graph. Re-register with env:'dev' so it only runs
  // during development.
  ignore: ['**/middleware/vite-dev.ts'],
  handlers: [
    {
      middleware: true,
      handler: resolve('./server/middleware/vite-dev.ts'),
      env: 'dev',
    },
  ],

  hooks: {
    'build:before': async (nitro: Nitro) => {
      await pagesPlugin(nitro);
      await ssgPlugin(nitro);
    },
  },

  compatibilityDate: '2025-01-01',

  routeRules: {
    '/_litro/**': {
      headers: { 'cache-control': 'public, max-age=31536000, immutable' },
    },
  },
});
`,
  );

  // ── vite.config.ts ────────────────────────────────────────────────────────
  await writeFile(
    join(projectDir, 'vite.config.ts'),
    `import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist/client',
    rollupOptions: {
      input: 'app.ts',
      output: {
        // Stable (non-hashed) entry filename so the HTML shell can always
        // reference /_litro/app.js without knowing the content hash.
        entryFileNames: '[name].js',
      },
    },
  },
});
`,
  );

  // ── app.ts ────────────────────────────────────────────────────────────────
  // CRITICAL IMPORT ORDER: hydrate-support MUST be first — it patches
  // LitElement.prototype.createRenderRoot() before any Lit code is evaluated.
  await writeFile(
    join(projectDir, 'app.ts'),
    `// CRITICAL: must be first — patches LitElement before any component is loaded.
import '@lit-labs/ssr-client/lit-element-hydrate-support.js';

// Client runtime: router outlet and link custom elements.
import 'litro/runtime/LitroOutlet.js';
import 'litro/runtime/LitroLink.js';

// Routes generated by the page scanner before each vite build.
// routes.generated.ts lives at the project root (not in dist/) so Vite's
// emptyOutDir does not delete it between builds.
import { routes } from './routes.generated.js';

document.addEventListener('DOMContentLoaded', () => {
  const outlet = document.querySelector('litro-outlet') as (Element & { routes: unknown }) | null;
  if (outlet) {
    outlet.routes = routes;
  } else {
    console.warn('[litro] <litro-outlet> not found — router will not start.');
  }
});
`,
  );

  // ── pages/index.ts ────────────────────────────────────────────────────────
  await writeFile(
    join(projectDir, 'pages/index.ts'),
    `import { html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { LitroPage } from 'litro/runtime';
import { definePageData } from 'litro';

export interface HomeData {
  message: string;
  timestamp: string;
}

// Runs on the server before SSR — result injected as JSON into the HTML shell.
export const pageData = definePageData(async (_event) => {
  return {
    message: 'Hello from ${projectName}!',
    timestamp: new Date().toISOString(),
  } satisfies HomeData;
});

@customElement('page-home')
export class HomePage extends LitroPage {
  @state() declare serverData: HomeData | null;

  // Called on client-side navigation (not on the initial SSR load).
  override async fetchData() {
    const res = await fetch('/api/hello');
    return res.json() as Promise<HomeData>;
  }

  render() {
    if (this.loading) return html\`<p>Loading…</p>\`;
    return html\`
      <main>
        <h1>\${this.serverData?.message ?? 'Welcome to ${projectName}'}</h1>
        <p><small>Rendered at: \${this.serverData?.timestamp ?? '—'}</small></p>
        <nav>
          <litro-link href="/blog">Go to Blog →</litro-link>
        </nav>
      </main>
    \`;
  }
}

export default HomePage;
`,
  );

  // ── pages/blog/index.ts ───────────────────────────────────────────────────
  await writeFile(
    join(projectDir, 'pages/blog/index.ts'),
    `import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';

@customElement('page-blog')
export class BlogPage extends LitElement {
  render() {
    return html\`
      <main>
        <h1>Blog</h1>
        <p>Choose a post:</p>
        <ul>
          <li><litro-link href="/blog/hello-world">Hello World</litro-link></li>
          <li><litro-link href="/blog/getting-started">Getting Started</litro-link></li>
          <li><litro-link href="/blog/about-litro">About Litro</litro-link></li>
        </ul>
        <litro-link href="/">← Back Home</litro-link>
      </main>
    \`;
  }
}

export default BlogPage;
`,
  );

  // ── pages/blog/[slug].ts ──────────────────────────────────────────────────
  await writeFile(
    join(projectDir, 'pages/blog/[slug].ts'),
    `import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { definePageData } from 'litro';

export interface PostData {
  slug: string;
  title: string;
  content: string;
}

// Runs on the server; event.context.params contains the matched route params.
export const pageData = definePageData(async (event) => {
  const slug = event.context.params?.slug ?? '';
  return {
    slug,
    title: \`Post: \${slug}\`,
    content: \`This is the content for the "\${slug}" post.\`,
  } satisfies PostData;
});

// Tells the SSG which concrete paths to prerender when LITRO_MODE=static.
export async function generateRoutes(): Promise<string[]> {
  return ['/blog/hello-world', '/blog/getting-started', '/blog/about-litro'];
}

@customElement('page-blog-slug')
export class BlogPostPage extends LitElement {
  @state() declare serverData: PostData | null;

  render() {
    return html\`
      <article>
        <h1>\${this.serverData?.title ?? 'Loading…'}</h1>
        <p>\${this.serverData?.content ?? ''}</p>
        <litro-link href="/blog">← Back to Blog</litro-link>
        &nbsp;|&nbsp;
        <litro-link href="/">← Home</litro-link>
      </article>
    \`;
  }
}

export default BlogPostPage;
`,
  );

  // ── server/api/hello.ts ───────────────────────────────────────────────────
  await writeFile(
    join(projectDir, 'server/api/hello.ts'),
    `import { defineEventHandler } from 'h3';

export default defineEventHandler(() => ({
  message: 'Hello from ${projectName}!',
  timestamp: new Date().toISOString(),
}));
`,
  );

  // ── server/routes/[...].ts ────────────────────────────────────────────────
  // Catch-all handler: matches every request that is not an API route or a
  // static asset, finds the page component, and streams SSR output.
  await writeFile(
    join(projectDir, 'server/routes/[...].ts'),
    `import { defineEventHandler, setResponseHeader, getRequestURL } from 'h3';
import { createPageHandler } from 'litro/runtime/create-page-handler.js';
import type { LitroRoute } from 'litro';
import { routes, pageModules } from '#litro/page-manifest';

function matchRoute(
  pathname: string,
): { route: LitroRoute; params: Record<string, string> } | undefined {
  for (const route of routes) {
    if (route.isCatchAll) return { route, params: {} };

    if (!route.isDynamic) {
      if (pathname === route.path) return { route, params: {} };
      continue;
    }

    // Use named capture groups so param values are automatically mapped to names.
    const regexStr =
      '^' +
      route.path
        .replace(/:([^/]+)\\(\\.\\*\\)\\*/g, '(?<$1>.+)')
        .replace(/:([^/?]+)\\?/g, '(?<$1>[^/]*)?')
        .replace(/:([^/]+)/g, '(?<$1>[^/]+)') +
      '$';

    try {
      const match = pathname.match(new RegExp(regexStr));
      if (match) return { route, params: (match.groups ?? {}) as Record<string, string> };
    } catch {
      // malformed pattern — skip
    }
  }
  return undefined;
}

export default defineEventHandler(async (event) => {
  const pathname = getRequestURL(event).pathname;
  const result = matchRoute(pathname);

  if (!result) {
    setResponseHeader(event, 'content-type', 'text/html; charset=utf-8');
    return \`<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8" /><title>404</title></head>
<body><h1>404 — Not Found</h1><p>No page matched <code>\${pathname}</code>.</p></body>
</html>\`;
  }

  const { route: matched, params } = result;

  // Populate route params (e.g. slug from /blog/:slug) on the event context
  // so pageData fetchers can access them via event.context.params.
  event.context.params = { ...event.context.params, ...params };

  const handler = createPageHandler({
    route: matched,
    pageModule: pageModules[matched.filePath],
  });
  return handler(event);
});
`,
  );

  // ── server/middleware/vite-dev.ts ─────────────────────────────────────────
  // Excluded from production builds via nitro.config.ts ignore + handlers[env:'dev'].
  // In dev, intercepts every request so Vite can serve JS/TS modules with HMR.
  await writeFile(
    join(projectDir, 'server/middleware/vite-dev.ts'),
    `import { defineEventHandler, fromNodeMiddleware } from 'h3';

let viteHandlerPromise: Promise<ReturnType<typeof fromNodeMiddleware>> | null = null;

export default defineEventHandler(async (event) => {
  if (!process.dev || !process.env.NITRO_DEV_WORKER_ID) return;

  if (!viteHandlerPromise) {
    const httpServer = (event.node.req.socket as import('node:net').Socket & {
      server?: import('node:http').Server;
    }).server;

    viteHandlerPromise = import('vite')
      .then(({ createServer }) =>
        createServer({
          server: {
            middlewareMode: true,
            // Attach Vite HMR WebSocket to Nitro's existing HTTP server so
            // both share a single port with no conflicts.
            hmr: httpServer ? { server: httpServer } : true,
          },
          appType: 'custom',
          root: process.cwd(),
        }),
      )
      .then((server) => fromNodeMiddleware(server.middlewares));
  }

  const viteHandler = await viteHandlerPromise;
  return viteHandler(event);
});
`,
  );

  // ── server/stubs/page-manifest.ts ─────────────────────────────────────────
  // Fallback for the #litro/page-manifest virtual module (resolved via the
  // "imports" field in package.json). Overwritten on every build by the pages
  // plugin. Committed so the file always exists for a cold-start.
  await writeFile(
    join(projectDir, 'server/stubs/page-manifest.ts'),
    `// @generated by litro page scanner — do not edit
// This stub is overwritten on every build. It exists so the #litro/page-manifest
// import in server/routes/[...].ts resolves even before the first build.

export const routes: never[] = [];
export const pageModules: Record<string, unknown> = {};
export default routes;
`,
  );

  console.log(`
  ✔  Created ${projectName}

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
