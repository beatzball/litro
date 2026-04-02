import { execSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { join } from 'node:path';
import { computeStats } from '../utils/stats.js';
import { ROOT_DIR, DOCS_DIR, DOCS_SSR_DIR, BUILD_RUNS } from '../config.js';
import type { RunStats } from '../types.js';

export async function measureBuildTime(
  mode: 'ssg' | 'ssr',
  runs: number = BUILD_RUNS,
): Promise<RunStats> {
  const distDir = mode === 'ssg'
    ? join(DOCS_DIR, 'dist')
    : join(DOCS_SSR_DIR, 'dist');

  const buildCmd = mode === 'ssg' ? 'pnpm build:docs' : 'pnpm build:docs-ssr';

  const times: number[] = [];

  for (let i = 0; i < runs; i++) {
    rmSync(distDir, { recursive: true, force: true });

    const start = performance.now();
    execSync(buildCmd, { cwd: ROOT_DIR, stdio: 'pipe' });
    const elapsed = Math.round(performance.now() - start);

    times.push(elapsed);
    console.log(`[build-time] ${mode} run ${i + 1}/${runs}: ${elapsed}ms`);
  }

  return computeStats(times);
}
