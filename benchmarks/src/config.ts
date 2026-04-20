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
  },
] as const;

export const ROOT_DIR = new URL('../../', import.meta.url).pathname;
export const DOCS_DIR = new URL('../../docs/', import.meta.url).pathname;
export const DOCS_SSR_DIR = new URL('../../docs-ssr/', import.meta.url).pathname;
export const RESULTS_DIR = new URL('../results/', import.meta.url).pathname;
