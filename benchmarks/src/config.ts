export const ROUTES = [
  '/',
  '/docs/introduction',
  '/blog',
  '/blog/welcome',
];

export const SSG_PORT = 3033;
export const SSR_PORT = 3034;

export const SSG_BASE_URL = `http://localhost:${SSG_PORT}`;
export const SSR_BASE_URL = `http://localhost:${SSR_PORT}`;

export const BUILD_RUNS = 3;

export const AUTOCANNON_CONNECTIONS = 10;
export const AUTOCANNON_DURATION = 10;

export const LIGHTHOUSE_RUNS = 3;
export const STREAMING_RUNS = 5;

export const SERVER_READY_TIMEOUT = 30_000;

export const CROSS_FRAMEWORK_ROUTES = ['/', '/blog/hello'];
export const APPS_DIR = new URL('../apps/', import.meta.url).pathname;

/**
 * The packages whose versions are recorded with each framework's result.
 *
 * The headline version alone is not enough to read a number a year later: a
 * Litro build time depends on Lit, @lit-labs/ssr, Nitro and Vite, and a Next
 * page weight depends on React. `measureFramework` resolves each of these from
 * the app's own node_modules and leaves out the ones that are not installed.
 */
const LITRO_CORE_PKGS = ['@beatzball/litro', '@beatzball/litro-router'] as const;
const LITRO_BUILD_PKGS = ['nitropack', 'vite'] as const;
const LITRO_VERSION_PKGS = [
  ...LITRO_CORE_PKGS,
  'lit',
  '@lit-labs/ssr',
  '@lit-labs/ssr-client',
  ...LITRO_BUILD_PKGS,
] as const;
const NUXT_VERSION_PKGS = ['nuxt', 'vue', 'vite'] as const;
const NEXT_VERSION_PKGS = ['next', 'react', 'react-dom'] as const;

export const FRAMEWORK_CONFIGS = [
  {
    name: 'litro',
    dir: 'litro',
    installCmd: 'pnpm install',
    buildCmd: 'pnpm exec litro build --mode static',
    outputDir: 'dist/static',
    previewCmd: 'npx serve dist/static -l 4001',
    previewPort: 4001,
    versionPkg: '@beatzball/litro',
    versionPkgs: LITRO_VERSION_PKGS,
  },
  {
    name: 'nuxt',
    dir: 'nuxt',
    installCmd: 'npm install',
    buildCmd: 'npx nuxi generate',
    outputDir: '.output/public',
    previewCmd: 'npx serve .output/public -l 4002',
    previewPort: 4002,
    versionPkg: 'nuxt',
    versionPkgs: NUXT_VERSION_PKGS,
  },
  {
    name: 'nextjs',
    dir: 'nextjs',
    installCmd: 'npm install',
    buildCmd: 'npx next build',
    outputDir: 'out',
    previewCmd: 'npx serve out -l 4003',
    previewPort: 4003,
    versionPkg: 'next',
    versionPkgs: NEXT_VERSION_PKGS,
  },
] as const;

export const MOCK_API_PORT = 4100;

export const HN_ROUTES = ['/', '/ask', '/show', '/story/47760529', '/user/divan'];

// SSG-only configs. TODO: Add HN_SSR_FRAMEWORK_CONFIGS with SSR build commands
// and server start commands for per-request rendering benchmarks.
export const HN_FRAMEWORK_CONFIGS = [
  {
    name: 'litro-lit',
    dir: 'hn-litro',
    installCmd: 'pnpm install',
    buildCmd: 'pnpm exec litro build --mode static',
    outputDir: 'dist/static',
    previewCmd: 'npx serve dist/static -l 4010',
    previewPort: 4010,
    versionPkg: '@beatzball/litro',
    versionPkgs: LITRO_VERSION_PKGS,
  },
  {
    name: 'litro-fast',
    dir: 'hn-litro-fast',
    installCmd: 'pnpm install',
    buildCmd: 'pnpm exec litro build --mode static',
    outputDir: 'dist/static',
    previewCmd: 'npx serve dist/static -l 4011',
    previewPort: 4011,
    versionPkg: '@beatzball/litro',
    versionPkgs: [...LITRO_CORE_PKGS, '@microsoft/fast-element', '@microsoft/fast-ssr', ...LITRO_BUILD_PKGS],
  },
  {
    name: 'litro-elena',
    dir: 'hn-litro-elena',
    installCmd: 'pnpm install',
    buildCmd: 'pnpm exec litro build --mode static',
    outputDir: 'dist/static',
    previewCmd: 'npx serve dist/static -l 4012',
    previewPort: 4012,
    versionPkg: '@beatzball/litro',
    versionPkgs: [...LITRO_CORE_PKGS, '@elenajs/core', '@elenajs/ssr', ...LITRO_BUILD_PKGS],
  },
  {
    name: 'nextjs',
    dir: 'hn-nextjs',
    installCmd: 'npm install',
    buildCmd: 'npx next build',
    outputDir: 'out',
    previewCmd: 'npx serve out -l 4013',
    previewPort: 4013,
    versionPkg: 'next',
    versionPkgs: NEXT_VERSION_PKGS,
  },
  {
    name: 'nuxt',
    dir: 'hn-nuxt',
    installCmd: 'npm install',
    buildCmd: 'npx nuxi generate',
    outputDir: '.output/public',
    previewCmd: 'npx serve .output/public -l 4014',
    previewPort: 4014,
    versionPkg: 'nuxt',
    versionPkgs: NUXT_VERSION_PKGS,
  },
] as const;

export const ROOT_DIR = new URL('../../', import.meta.url).pathname;
export const DOCS_DIR = new URL('../../docs/', import.meta.url).pathname;
export const DOCS_SSR_DIR = new URL('../../docs-ssr/', import.meta.url).pathname;
export const RESULTS_DIR = new URL('../results/', import.meta.url).pathname;
