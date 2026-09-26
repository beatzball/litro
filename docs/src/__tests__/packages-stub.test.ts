/**
 * Guard: the browser stub for packages.ts holds no copy of the package list.
 *
 * packages.ts reads README and CHANGELOG files with node:fs and runs the
 * Markdown toolchain, so the client build replaces it with a stub
 * (CONTENT-008). The stub used to write the slugs out by hand, and the list
 * went a package short the day litro-agent was added — nothing failed, because
 * the only reader runs at build time against the real module.
 *
 * The stub now re-exports the slugs from package-list.ts. These tests hold
 * that shape: no literal list in the stub, and the module it points at is the
 * one the server module exports from.
 *
 * Run with: pnpm test:docs
 */

import { describe, it, expect } from 'vitest';
import {
  PACKAGES_STUB_ID,
  PACKAGES_STUB_SOURCE,
  packagesStubPlugin,
} from '../../vite.config.js';
import {
  PACKAGES_STUB_SOURCE as SSR_STUB_SOURCE,
} from '../../../docs-ssr/vite.config.js';
import { ALL_PACKAGE_SLUGS } from '@beatzball/litro-docs-ui/src/packages.js';

/** The module specifier the stub re-exports the slugs from. */
function reExportSpecifier(source: string): string | undefined {
  return source.match(/export\s*\{[^}]*ALL_PACKAGE_SLUGS[^}]*\}\s*from\s*'([^']+)'/)?.[1];
}

describe('packages browser stub', () => {
  it('is byte-identical in docs/ and docs-ssr/', () => {
    expect(SSR_STUB_SOURCE).toBe(PACKAGES_STUB_SOURCE);
  });

  it('is what the plugin loads for the stub id', () => {
    const plugin = packagesStubPlugin();
    const load = plugin.load as (id: string) => string | undefined;
    expect(load.call(plugin, PACKAGES_STUB_ID)).toBe(PACKAGES_STUB_SOURCE);
    expect(load.call(plugin, 'some/other/module.js')).toBeUndefined();
  });

  it('replaces packages.js, the module that needs node:fs', () => {
    const plugin = packagesStubPlugin();
    const resolveId = plugin.resolveId as (id: string, importer?: string) => string | undefined;
    expect(resolveId.call(plugin, '/x/src/packages.js', '/x/page.ts')).toBe(PACKAGES_STUB_ID);
    expect(resolveId.call(plugin, '/x/src/packages.ts', '/x/page.ts')).toBe(PACKAGES_STUB_ID);
    // package-list.js is browser-safe and must reach the bundle untouched.
    expect(resolveId.call(plugin, '/x/src/package-list.js', '/x/page.ts')).toBeUndefined();
  });

  it('writes no package list of its own', () => {
    expect(PACKAGES_STUB_SOURCE).not.toMatch(/ALL_PACKAGE_SLUGS\s*=/);
    expect(PACKAGES_STUB_SOURCE).not.toMatch(/'litro-router'/);
  });

  it('re-exports the same slugs the real module exports', async () => {
    const specifier = reExportSpecifier(PACKAGES_STUB_SOURCE);
    expect(specifier).toBeDefined();
    const stubModule = (await import(specifier!)) as { ALL_PACKAGE_SLUGS: readonly string[] };
    expect([...stubModule.ALL_PACKAGE_SLUGS]).toEqual([...ALL_PACKAGE_SLUGS]);
    expect(stubModule.ALL_PACKAGE_SLUGS).toContain('litro-agent');
  });
});
