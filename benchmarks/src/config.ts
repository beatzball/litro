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

export const ROOT_DIR = new URL('../../', import.meta.url).pathname;
export const DOCS_DIR = new URL('../../docs/', import.meta.url).pathname;
export const DOCS_SSR_DIR = new URL('../../docs-ssr/', import.meta.url).pathname;
export const RESULTS_DIR = new URL('../results/', import.meta.url).pathname;
