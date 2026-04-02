import { readdir, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { DOCS_DIR, DOCS_SSR_DIR } from '../config.js';
import type { BundleSizeBreakdown } from '../types.js';

interface FileSizeEntry {
  path: string;
  size: number;
}

async function walkDir(dir: string): Promise<FileSizeEntry[]> {
  const entries: FileSizeEntry[] = [];
  let files: string[];
  try {
    files = await readdir(dir, { recursive: true, encoding: 'utf-8' }) as string[];
  } catch {
    return entries;
  }
  for (const file of files) {
    const fullPath = join(dir, file);
    const s = await stat(fullPath);
    if (s.isFile()) {
      entries.push({ path: fullPath, size: s.size });
    }
  }
  return entries;
}

function sumByExt(files: FileSizeEntry[], exts: string[]): number {
  return files
    .filter((f) => exts.includes(extname(f.path)))
    .reduce((sum, f) => sum + f.size, 0);
}

function sumAll(files: FileSizeEntry[]): number {
  return files.reduce((sum, f) => sum + f.size, 0);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} kB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

export async function measureBundleSize(mode: 'ssg' | 'ssr'): Promise<BundleSizeBreakdown> {
  const baseDir = mode === 'ssg' ? DOCS_DIR : DOCS_SSR_DIR;

  if (mode === 'ssg') {
    const clientFiles = await walkDir(join(baseDir, 'dist', 'client'));
    const staticFiles = await walkDir(join(baseDir, 'dist', 'static'));

    const clientJS = sumByExt(clientFiles, ['.js', '.mjs']);
    const clientCSS = sumByExt(clientFiles, ['.css']);
    const staticHTML = sumByExt(staticFiles, ['.html']);
    const totalOutput = sumAll(clientFiles) + sumAll(staticFiles);

    const result: BundleSizeBreakdown = {
      clientJS,
      clientCSS,
      serverBundle: 0,
      staticHTML,
      totalOutput,
    };

    console.log(`[bundle-size] ${mode}:`);
    console.log(`  clientJS:    ${formatBytes(clientJS)}`);
    console.log(`  clientCSS:   ${formatBytes(clientCSS)}`);
    console.log(`  staticHTML:  ${formatBytes(staticHTML)}`);
    console.log(`  totalOutput: ${formatBytes(totalOutput)}`);

    return result;
  }

  // SSR mode
  const clientFiles = await walkDir(join(baseDir, 'dist', 'client'));
  const serverFiles = await walkDir(join(baseDir, 'dist', 'server'));

  const clientJS = sumByExt(clientFiles, ['.js', '.mjs']);
  const clientCSS = sumByExt(clientFiles, ['.css']);
  const serverBundle = sumByExt(serverFiles, ['.js', '.mjs']);
  const totalOutput = sumAll(clientFiles) + sumAll(serverFiles);

  const result: BundleSizeBreakdown = {
    clientJS,
    clientCSS,
    serverBundle,
    staticHTML: 0,
    totalOutput,
  };

  console.log(`[bundle-size] ${mode}:`);
  console.log(`  clientJS:      ${formatBytes(clientJS)}`);
  console.log(`  clientCSS:     ${formatBytes(clientCSS)}`);
  console.log(`  serverBundle:  ${formatBytes(serverBundle)}`);
  console.log(`  totalOutput:   ${formatBytes(totalOutput)}`);

  return result;
}
