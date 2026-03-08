import { readFile } from 'node:fs/promises';
import { join, resolve } from 'pathe';

interface LitroRecipeManifest {
  contentDir?: string;
}

/**
 * Resolves the absolute content directory for a Litro project.
 *
 * Reads `litro.recipe.json` in `rootDir` and uses its `contentDir` field
 * when present. Falls back to `fallback` (default: `<rootDir>/content/blog`)
 * when the manifest is absent or has no `contentDir` entry.
 */
export async function resolveContentDir(
  rootDir: string,
  fallback = resolve(rootDir, 'content/blog'),
): Promise<string> {
  const manifestPath = join(rootDir, 'litro.recipe.json');
  try {
    const text = await readFile(manifestPath, 'utf-8');
    const manifest = JSON.parse(text) as LitroRecipeManifest;
    if (manifest.contentDir) {
      return resolve(rootDir, manifest.contentDir);
    }
  } catch {
    // No manifest — fall through to default
  }
  return fallback;
}
