#!/usr/bin/env node
/**
 * Litro CLI — dev/build/preview/generate commands
 *
 * dev:      Starts Nitro dev server on a single port.
 *           Nitro orchestrates the server; Vite middleware is injected via devHandlers
 *           in the project's nitro.config.ts.
 *
 * build:    Runs `vite build` (client bundle → dist/client/) then `nitro build`.
 *           Accepts --mode=static|server (default: server).
 *
 * generate: Alias for `litro build --mode static`.
 *
 * preview:  Runs the production server entry (.output/server/index.mjs) directly.
 *           `nitro preview` was removed in Nitro 2.13.
 *
 * Delegates entirely to the `nitro` and `vite` CLI binaries found in the project's
 * node_modules. Does NOT use execa — only Node.js built-in child_process.spawn.
 */

import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import process from 'node:process';
import { scanAndWriteClientRoutes } from '../plugins/pages.js';

const [,, command, ...args] = process.argv;
const cwd = process.cwd();

function run(
  cmd: string,
  cmdArgs: string[],
  env?: Record<string, string>,
): ReturnType<typeof spawn> {
  const binPath = join(cwd, 'node_modules', '.bin');
  const pathSep = process.platform === 'win32' ? ';' : ':';
  // Node.js v22 DEP0190: passing an args array with shell:true is deprecated.
  // Join into a single command string instead.
  const fullCmd = cmdArgs.length > 0 ? `${cmd} ${cmdArgs.join(' ')}` : cmd;
  const child = spawn(fullCmd, {
    cwd,
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
      PATH: `${binPath}${pathSep}${process.env.PATH}`,
      ...env,
    },
  });
  child.on('exit', (code) => process.exit(code ?? 0));
  return child;
}

switch (command) {
  case 'dev': {
    // If dist/client/app.js doesn't exist, run vite build once so the static
    // asset handler has something to serve. Vite's dev middleware will still
    // intercept /_litro/app.js on the fly (serving app.ts) when available;
    // the pre-built file is the reliable fallback.
    const distClientApp = join(cwd, 'dist', 'client', 'app.js');
    if (!existsSync(distClientApp)) {
      console.log('[litro] Scanning pages...');
      await scanAndWriteClientRoutes(cwd);
      console.log('[litro] Building client bundle...');
      const binPath = join(cwd, 'node_modules', '.bin');
      const pathSep = process.platform === 'win32' ? ';' : ':';
      spawnSync('vite build', {
        cwd,
        stdio: 'inherit',
        shell: true,
        env: { ...process.env, PATH: `${binPath}${pathSep}${process.env.PATH}` },
      });
    }

    // Resolve port: --port <n> or -p <n> from args, falling back to 3030.
    const portFlagIdx = args.findIndex((a) => a === '--port' || a === '-p');
    const portInline = args.find((a) => a.startsWith('--port=') || a.startsWith('-p='));
    const port =
      portInline?.split('=')[1] ??
      (portFlagIdx !== -1 ? args[portFlagIdx + 1] : undefined) ??
      '3030';
    run('nitro', ['dev', '--port', port], { LITRO_MODE: 'server' });
    break;
  }

  case 'build': {
    const modeFlag =
      args.find((a) => a.startsWith('--mode='))?.split('=')[1] ??
      args[args.indexOf('--mode') + 1] ??
      'server';
    const mode = modeFlag === 'static' ? 'static' : 'server';

    (async () => {
      // Stage 0: Scan pages/ and write routes.generated.ts so Vite bundles
      // fresh routes into app.js (the Nitro build:before hook also does this
      // but runs after vite build, which would be too late).
      console.log('[litro] Scanning pages...');
      await scanAndWriteClientRoutes(cwd);

      // Stage 1: Build client bundle with Vite → dist/client/
      console.log('[litro] Building client bundle (vite build)...');
      const vite = run('vite', ['build']);
      // Stage 2: Build server bundle with Nitro → .output/
      // The exit listener added by run() calls process.exit, so we override it
      // here to allow chaining.
      vite.removeAllListeners('exit');
      vite.on('exit', (code) => {
        if (code !== 0) {
          process.exit(code ?? 1);
        }
        console.log(`[litro] Building server bundle (nitro build --mode ${mode})...`);
        run('nitro', ['build'], { LITRO_MODE: mode });
      });
    })().catch((err) => {
      console.error('[litro] Build failed:', err);
      process.exit(1);
    });
    break;
  }

  case 'generate':
    // Alias for `litro build --mode static`
    (async () => {
      console.log('[litro] Scanning pages...');
      await scanAndWriteClientRoutes(cwd);

      console.log('[litro] Building client bundle (vite build)...');
      const vite = run('vite', ['build']);
      vite.removeAllListeners('exit');
      vite.on('exit', (code) => {
        if (code !== 0) {
          process.exit(code ?? 1);
        }
        console.log('[litro] Building static site (nitro build --mode static)...');
        run('nitro', ['build'], { LITRO_MODE: 'static' });
      });
    })().catch((err) => {
      console.error('[litro] Generate failed:', err);
      process.exit(1);
    });
    break;

  case 'preview': {
    const portFlagIdx = args.findIndex((a) => a === '--port' || a === '-p');
    const portInline = args.find((a) => a.startsWith('--port=') || a.startsWith('-p='));
    const port = Number(
      portInline?.split('=')[1] ??
      (portFlagIdx !== -1 ? args[portFlagIdx + 1] : undefined) ??
      '3030',
    );

    // SSG build: serve dist/static/ with a built-in static file server.
    const staticDir = join(cwd, 'dist', 'static');
    if (existsSync(staticDir)) {
      const MIME: Record<string, string> = {
        '.html': 'text/html; charset=utf-8',
        '.css':  'text/css; charset=utf-8',
        '.js':   'text/javascript; charset=utf-8',
        '.mjs':  'text/javascript; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.png':  'image/png',
        '.jpg':  'image/jpeg',
        '.svg':  'image/svg+xml',
        '.ico':  'image/x-icon',
        '.woff2':'font/woff2',
        '.woff': 'font/woff',
      };
      const server = createServer((req, res) => {
        const url = (req.url ?? '/').split('?')[0];
        // Candidates: exact path, path + .html, path + /index.html
        const candidates = [
          join(staticDir, url),
          join(staticDir, url + '.html'),
          join(staticDir, url, 'index.html'),
        ];
        const filePath = candidates.find(
          (p) => existsSync(p) && statSync(p).isFile(),
        );
        if (!filePath) {
          const notFound = join(staticDir, '404.html');
          if (existsSync(notFound)) {
            res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
            createReadStream(notFound).pipe(res);
          } else {
            res.writeHead(404);
            res.end('Not found');
          }
          return;
        }
        const mime = MIME[extname(filePath)] ?? 'application/octet-stream';
        res.writeHead(200, { 'content-type': mime });
        createReadStream(filePath).pipe(res);
      });
      server.listen(port, () => {
        console.log(`[litro] Previewing static build at http://localhost:${port}`);
      });
      break;
    }

    // SSR build: run the production server entry directly.
    // ssrPreset sets output.dir = 'dist/server'; Nitro appends its own
    // 'server/' subdirectory, so the entry is dist/server/server/index.mjs.
    const entry = join(cwd, 'dist', 'server', 'server', 'index.mjs');
    if (!existsSync(entry)) {
      console.error(
        '[litro] No production build found.\n' +
        '        Expected dist/static/ (SSG) or dist/server/server/index.mjs (SSR).\n' +
        '        Run `litro build` first.',
      );
      process.exit(1);
    }
    run('node', [entry], { PORT: String(port) });
    break;
  }

  default:
    console.log(`
litro — Lit-first fullstack framework

Commands:
  litro dev              Start development server (default port: 3030)
  litro dev --port 8080  Start on a custom port
  litro build            Build for production (--mode static|server, default: server)
  litro generate         Build static site (alias for litro build --mode static)
  litro preview          Preview production build
    `);
    process.exit(0);
}
