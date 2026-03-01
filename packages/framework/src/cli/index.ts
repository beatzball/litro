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
 * preview:  Runs `nitro preview` against the production build output.
 *
 * Delegates entirely to the `nitro` and `vite` CLI binaries found in the project's
 * node_modules. Does NOT use execa — only Node.js built-in child_process.spawn.
 */

import { spawn } from 'node:child_process';
import process from 'node:process';

const [,, command, ...args] = process.argv;
const cwd = process.cwd();

function run(
  cmd: string,
  cmdArgs: string[],
  env?: Record<string, string>,
): ReturnType<typeof spawn> {
  const child = spawn(cmd, cmdArgs, {
    cwd,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, ...env },
  });
  child.on('exit', (code) => process.exit(code ?? 0));
  return child;
}

switch (command) {
  case 'dev': {
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

    // Stage 1: Build client bundle with Vite → dist/client/
    console.log('[litro] Building client bundle (vite build)...');
    const vite = run('vite', ['build']);
    // Stage 2: Build server bundle with Nitro → .output/
    // The exit listener added by run() calls process.exit, so we override it here
    // to allow chaining.
    vite.removeAllListeners('exit');
    vite.on('exit', (code) => {
      if (code !== 0) {
        process.exit(code ?? 1);
      }
      console.log(`[litro] Building server bundle (nitro build --mode ${mode})...`);
      run('nitro', ['build'], { LITRO_MODE: mode });
    });
    break;
  }

  case 'generate':
    // Alias for `litro build --mode static`
    console.log('[litro] Building client bundle (vite build)...');
    {
      const vite = run('vite', ['build']);
      vite.removeAllListeners('exit');
      vite.on('exit', (code) => {
        if (code !== 0) {
          process.exit(code ?? 1);
        }
        console.log('[litro] Building static site (nitro build --mode static)...');
        run('nitro', ['build'], { LITRO_MODE: 'static' });
      });
    }
    break;

  case 'preview':
    run('nitro', ['preview']);
    break;

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
