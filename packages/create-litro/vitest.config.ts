import { realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { defineConfig } from 'vitest/config';

// macOS reports the temp directory as /var/folders/... but serves it from
// /private/var/folders/..., and vite-node matches on the resolved path.
const TMP = [tmpdir(), realpathSync(tmpdir())];

export default defineConfig({
  server: {
    fs: {
      // The scaffolder loads a recipe's config with a dynamic import of an
      // absolute path. Tests build fixture recipes in a temp directory and
      // point the scaffolder at them, so vite-node has to be allowed to read
      // from there. Left at the default it serves only files under the project
      // root, and the import fails with "Does the file exist?".
      allow: [process.cwd(), ...TMP],
    },
  },
  test: {
    exclude: [
      '**/node_modules/**',
      '**/recipes/**/template/**',
      // tsc emits the specs to dist/ too; without this every test runs twice,
      // and the compiled copy can be stale relative to the source.
      '**/dist/**',
    ],
  },
});
