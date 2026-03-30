import { dirname, join } from 'pathe';
import { fileURLToPath } from 'node:url';

/**
 * Absolute path to the shared docs content directory.
 * Import this in nitro.config.ts to point both docs/ (SSG) and docs-ssr/ (SSR)
 * at the same Markdown source.
 */
export const CONTENT_DIR = join(dirname(fileURLToPath(import.meta.url)), 'content');
