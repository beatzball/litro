/**
 * The /docs landing page exists eight times.
 *
 * `docs/` and `docs-ssr/` share `buildDocsIndexGroups()` in
 * `@beatzball/litro-docs-ui`, and a unit test there pins its behavior. The
 * recipe templates cannot import that package — a scaffolded app installs only
 * the published Litro packages — so each adapter template keeps its own copy,
 * and every starlight playground is that template with `{{projectName}}`
 * substituted.
 *
 * Nothing compared a template to its playground mirror, so a fix applied to one
 * silently skipped the other. This test pins the four mirrors to their
 * templates. It is deliberately narrow: PR 193 adds a general recipe-to-
 * playground copy test (`supernova-copies.test.ts`), and once both are on the
 * same branch this should be folded into it rather than kept alongside.
 */
import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const PAGE = 'pages/docs/index.ts';

/**
 * Each playground and the recipe template it is a copy of.
 *
 * supernova has no docs page of its own: the recipe extends starlight and
 * inherits its Lit template, so `playground-supernova` mirrors the same file as
 * `playground-starlight`.
 */
const MIRRORS = [
  { playground: 'playground-starlight', template: 'template' },
  { playground: 'playground-starlight-fast', template: 'template-fast' },
  { playground: 'playground-starlight-elena', template: 'template-elena' },
  { playground: 'playground-supernova', template: 'template' },
];

describe('the /docs page copies stay in step', () => {
  for (const { playground, template } of MIRRORS) {
    it(`${playground}/${PAGE} matches recipes/starlight/${template}/${PAGE}`, async () => {
      const templatePath = join(REPO, 'packages/create-litro/recipes/starlight', template, PAGE);
      const playgroundPath = join(REPO, playground, PAGE);

      const [templateSource, playgroundSource] = await Promise.all([
        readFile(templatePath, 'utf-8'),
        readFile(playgroundPath, 'utf-8'),
      ]);

      // `{{projectName}}` is the one placeholder the scaffolder substitutes in
      // this file — the routeMeta title. Everything else must be identical.
      const expected = templateSource.replaceAll('{{projectName}}', playground);
      expect(playgroundSource).toBe(expected);
    });
  }

  it('every copy drops an empty sidebar group', async () => {
    // buildDocsIndexGroups() in @beatzball/litro-docs-ui filters empty groups,
    // and the recipe copies have to agree: a group with an empty `items` array
    // would otherwise render a heading over an empty list.
    const files = [
      ...new Set(
        MIRRORS.flatMap(({ playground, template }) => [
          join(REPO, 'packages/create-litro/recipes/starlight', template, PAGE),
          join(REPO, playground, PAGE),
        ]),
      ),
    ];
    for (const file of files) {
      const source = await readFile(file, 'utf-8');
      expect(source, `${file} has no empty-group filter`).toContain(
        '.filter(group => group.items.length > 0)',
      );
    }
  });
});
