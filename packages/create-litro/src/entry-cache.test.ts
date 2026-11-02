/**
 * Every recipe template must not cache the client entry forever (issue 253).
 *
 * `/_litro/app.js` keeps one name in every build. Marked `immutable`, a
 * browser keeps the old entry after a deploy, and that entry asks for chunks
 * the new build no longer has. Only the hashed `/_litro/assets/**` may be
 * immutable, and the template's client build must use `litroEntryPlugin()` so
 * the page can load the entry as `app.js?v=<content hash>`.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const recipesDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'recipes');

const templates = readdirSync(recipesDir).flatMap((recipe) =>
  readdirSync(join(recipesDir, recipe))
    .filter((d) => d.startsWith('template'))
    .map((d) => join(recipe, d))
    .filter((t) => existsSync(join(recipesDir, t, 'nitro.config.ts'))),
);

describe('recipe templates cache the client entry safely', () => {
  it('finds the templates', () => {
    expect(templates.length).toBeGreaterThanOrEqual(6);
  });

  it.each(templates)('%s/nitro.config.ts', (template) => {
    const src = readFileSync(join(recipesDir, template, 'nitro.config.ts'), 'utf-8');
    expect(src).not.toContain("'/_litro/**'");
    expect(src).toMatch(/'\/_litro\/assets\/\*\*': \{\s*headers: \{ 'cache-control': 'public, max-age=31536000, immutable' \}/);
    expect(src).toMatch(/'\/_litro\/app\.js': \{\s*headers: \{ 'cache-control': 'no-cache' \}/);
    // A maxAge on the /_litro/ publicAssets mount makes Nitro add its own
    // '/_litro/**' immutable rule, which a static host's _headers file then
    // applies to app.js as well.
    expect(src).not.toMatch(/baseURL: '\/_litro\/',\s*maxAge/);
  });

  it.each(templates)('%s/vite.config.ts', (template) => {
    const src = readFileSync(join(recipesDir, template, 'vite.config.ts'), 'utf-8');
    expect(src).toContain('litroEntryPlugin()');
  });
});
