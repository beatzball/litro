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
import { resolve } from 'pathe';
import { resolveContentDir } from '../content/resolve-content-dir.js';

const VIRTUAL_ID = 'litro:content';
const RESOLVED_ID = '\0litro:content';

function generateModuleSource(): string {
  // litro:content is server-only. In the browser, page data is provided via
  // definePageData → serverData (injected JSON). These no-op stubs satisfy the
  // static import at the top of page files without pulling in Node.js modules
  // (node:fs, fast-glob, gray-matter, etc.) that would break Vite's dep optimizer.
  return `// litro:content — browser stub (server data comes via definePageData → serverData)
export async function getPosts(_options) { return []; }
export async function getPost(_slug) { return null; }
export async function getTags() { return []; }
export async function getGlobalData() { return {}; }
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
      // Watch content directory for Markdown changes; invalidate the virtual module.
      const watchDir = resolvedContentDir;
      if (!watchDir) return;

      server.watcher.add(watchDir);

      server.watcher.on('change', (file) => {
        if (!file.startsWith(watchDir + '/')) return;
        const mod = server.moduleGraph.getModuleById(RESOLVED_ID);
        if (mod) {
          server.moduleGraph.invalidateModule(mod);
          server.ws.send({ type: 'full-reload' });
        }
      });

      server.watcher.on('add', (file) => {
        if (!file.startsWith(watchDir + '/')) return;
        const mod = server.moduleGraph.getModuleById(RESOLVED_ID);
        if (mod) {
          server.moduleGraph.invalidateModule(mod);
          server.ws.send({ type: 'full-reload' });
        }
      });
    },
  };
}

export default litroContentPlugin;
