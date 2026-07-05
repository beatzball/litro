/**
 * Litro Vite plugin
 *
 * Registers the `litro:content` virtual module for Vite builds (dev + client prod).
 *
 * Virtual module ID: `litro:content`
 * Resolved ID:       `\0litro:content`  (Vite/Rollup null-byte convention)
 *
 * The loaded module creates a ContentIndex instance bound to the project's
 * content directory and exports getPosts / getPost / getTags / getGlobalData.
 * In dev mode the module is invalidated whenever a file in contentDir changes,
 * causing the next import to rebuild the ContentIndex.
 */

import type { Plugin, ResolvedConfig } from 'vite';
import { writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'pathe';
import { resolveContentDir } from '../content/resolve-content-dir.js';

const VIRTUAL_ID = 'litro:content';
const RESOLVED_ID = '\0litro:content';

function generateModuleSource(): string {
  // litro:content is server-only. In the browser, page data is provided via
  // definePageData → serverData (injected JSON). These no-op stubs satisfy the
  // static import at the top of page files without pulling in Node.js modules
  // (node:fs, fast-glob, gray-matter, etc.) that would break Vite's dep optimizer.
  //
  // In dev mode, Vite sends a 'litro:content-update' WebSocket event when any
  // Markdown file in the content directory changes. The browser reloads so the
  // server can serve fresh page data (the stub resets _buildPromise on every
  // request in dev mode). import.meta.hot is undefined in production builds so
  // this block is dead code and tree-shaken by Rollup.
  return `// litro:content — browser stub (server data comes via definePageData → serverData)
export async function getPosts(_options) { return []; }
export async function getPost(_slug) { return null; }
export async function getTags() { return []; }
export async function getGlobalData() { return {}; }

if (import.meta.hot) {
  import.meta.hot.on('litro:content-update', () => {
    location.reload();
  });
}
`;
}

export function litroContentPlugin(): Plugin {
  let resolvedContentDir: string;
  let config: ResolvedConfig;

  return {
    name: 'litro:content',
    enforce: 'pre',

    async configResolved(resolved) {
      config = resolved;
      const rootDir = config.root;
      const fallback = resolve(rootDir, 'content/blog');
      resolvedContentDir = await resolveContentDir(rootDir, fallback);
    },

    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID;
    },

    load(id) {
      if (id !== RESOLVED_ID) return;
      return generateModuleSource();
    },

    configureServer(server) {
      // Watch content directory for Markdown changes and invalidate the virtual
      // module so Vite's module graph stays consistent.
      const watchDir = resolvedContentDir;
      if (!watchDir) return;

      // Explicitly add the content dir — it may be outside Vite's project root
      // (e.g. a shared packages/docs-content/ workspace package).
      server.watcher.add(watchDir);

      // Version file for the browser polling script — same mechanism as the
      // Nitro content plugin uses, but driven by Vite's chokidar watcher (which
      // reliably fires in this process context). Written to dist/client/ so it
      // is served at /_litro/_litro-version.json by Nitro's publicAssets handler.
      const clientDir = resolve(config.root, 'dist', 'client');
      const versionFile = join(clientDir, '_litro-version.json');
      const writeVersion = async () => {
        await mkdir(clientDir, { recursive: true });
        await writeFile(versionFile, JSON.stringify({ v: Date.now() }), 'utf-8');
      };

      // Write the initial version file so the polling script gets a 200 from
      // the first request rather than a 404 on a clean dist/.
      writeVersion().catch(() => {});

      const onContentFileEvent = (file: string) => {
        if (!file.startsWith(watchDir + '/')) return;
        // Basename check — skip dotfiles (.conform.*.md, .DS_Store, etc.)
        const base = file.split('/').pop() ?? '';
        if (!base || base.startsWith('.') || !/\.(md|markdown)$/.test(base)) return;
        // Invalidate the cached virtual module so Vite's module graph stays consistent.
        const mod = server.moduleGraph.getModuleById(RESOLVED_ID);
        if (mod) server.moduleGraph.invalidateModule(mod);
        // Write the version file so the browser polling script picks up the change.
        // Also send a Vite WS event as best-effort for environments where the
        // WebSocket connection is available (e.g. standalone Vite server).
        writeVersion().catch(() => {});
        server.ws.send({ type: 'custom', event: 'litro:content-update' });
      };

      server.watcher.on('add', onContentFileEvent);
      server.watcher.on('change', onContentFileEvent);
      server.watcher.on('unlink', onContentFileEvent);
    },
  };
}

export default litroContentPlugin;

export { litroActionsPlugin } from './actions.js';
