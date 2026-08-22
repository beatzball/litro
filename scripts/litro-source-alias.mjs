/**
 * Workspace-only alias: resolve the published Litro packages to their
 * TypeScript source instead of their compiled `dist/`.
 *
 * WHY THIS EXISTS
 *
 * The packages used to advertise a `"source"` export condition, and every app
 * in this repo listed `'source'` first in `resolve.conditions`. That gave the
 * monorepo a nice loop — edit `packages/framework/src`, see it immediately —
 * but the same condition shipped to users through the recipe templates, where
 * it silently produced a broken client bundle:
 *
 *   - In this workspace, `node_modules/@beatzball/litro` is a symlink whose
 *     real path is `packages/framework/src/*.ts` — OUTSIDE any node_modules.
 *     Vite transpiles it and finds `packages/framework/tsconfig.json`, so
 *     `experimentalDecorators` applies and Lit's `@customElement` compiles.
 *
 *   - In an installed app the real path is INSIDE node_modules. Vite skips
 *     TypeScript transformation there entirely, so no tsconfig is consulted
 *     and the decorators pass through as raw syntax:
 *
 *         (@at(`litro-outlet`) class extends rt { ... })
 *
 *     No browser can parse that. `app.js` dies with "Invalid or unexpected
 *     token", nothing hydrates, and the FOUC rule blanks the page — while the
 *     build still exits 0 and the SSR HTML still looks perfect.
 *
 * So `"source"` is gone from the published packages, and the monorepo gets the
 * same convenience through this explicit alias instead. An alias is local to
 * this repo by construction: it cannot leak into anyone's app.
 *
 * HOW IT STAYS CORRECT
 *
 * The alias list is DERIVED from each package's own `exports` map at config
 * load time — every `import` target `./dist/x.js` maps to `./src/x.ts`. Add or
 * rename an export and the alias follows automatically. Nothing to keep in
 * sync by hand.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Directory of this file: <repo>/scripts */
const HERE = dirname(fileURLToPath(import.meta.url));

/** Published package name -> its directory under packages/ */
/** @type {Record<string, string>} */
const PACKAGES = {
  '@beatzball/litro': 'framework',
  '@beatzball/litro-router': 'litro-router',
  '@beatzball/litro-agent': 'litro-agent',
};

/** @typedef {{ find: RegExp, replacement: string }} AliasEntry */

/** @param {string} s @returns {string} */
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build the alias entries. Exported for the unit test; apps call
 * `litroSourceAlias()`.
 */
/**
 * Map a package `exports` "import" target to its TypeScript source.
 *
 *   ./dist/runtime/LitroOutlet.js  ->  ./src/runtime/LitroOutlet.ts
 *
 * Returns null when the target is not a compiled `dist/` entry. This is the
 * single definition of the dist->src rule; `scripts/check-doc-refs.mjs` uses
 * it too, so the two cannot drift.
 *
 * @param {unknown} importTarget
 * @returns {string | null}
 */
export function deriveSourceTarget(importTarget) {
  if (typeof importTarget !== 'string') return null;
  const src = importTarget.replace(/^\.\/dist\//, './src/').replace(/\.js$/, '.ts');
  return src === importTarget ? null : src;
}

/** @returns {AliasEntry[]} */
export function litroSourceAlias() {
  /** @type {AliasEntry[]} */
  const entries = [];

  for (const [pkgName, dir] of Object.entries(PACKAGES)) {
    const pkgRoot = resolve(HERE, '..', 'packages', dir);
    const manifest = JSON.parse(
      readFileSync(join(pkgRoot, 'package.json'), 'utf-8'),
    );

    for (const [subpath, conditions] of Object.entries(manifest.exports ?? {})) {
      if (typeof conditions !== 'object' || conditions === null) continue;
      const importTarget = conditions.import;
      if (typeof importTarget !== 'string') continue;

      const sourceTarget = deriveSourceTarget(importTarget);
      if (sourceTarget === null) continue; // not a compiled dist/ entry

      const specifier =
        subpath === '.' ? pkgName : `${pkgName}/${subpath.replace(/^\.\//, '')}`;
      const absolute = join(pkgRoot, sourceTarget);

      // Anchored regexes, never bare strings: a string `find` matches by
      // prefix, so '@beatzball/litro' would swallow '@beatzball/litro/runtime'.
      if (specifier.includes('*')) {
        entries.push({
          find: new RegExp(`^${escapeRegExp(specifier).replace('\\*', '(.*)')}$`),
          replacement: absolute.replace('*', '$1'),
        });
      } else {
        entries.push({
          find: new RegExp(`^${escapeRegExp(specifier)}$`),
          replacement: absolute,
        });
      }
    }
  }

  if (entries.length === 0) {
    throw new Error(
      '[litro-source-alias] Derived zero aliases. The packages/*/package.json ' +
        'exports maps changed shape — fix this helper rather than shipping a ' +
        'silently empty alias list.',
    );
  }

  return entries;
}

export default litroSourceAlias;
