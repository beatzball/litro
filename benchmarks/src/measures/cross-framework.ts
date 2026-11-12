import { execSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { computeStats } from '../utils/stats.js';
import { gzipSize } from '../utils/gzip.js';
import { measureLighthouse } from './lighthouse.js';
import { measureStaticBundleSize } from './bundle-size.js';
import { measureHttpPerf } from './http-perf.js';
import { startCommand, waitForReady, stopServer } from '../utils/server-lifecycle.js';
import type { FrameworkResult, LighthouseResult, PageWeightResult } from '../types.js';
import { CROSS_FRAMEWORK_ROUTE_CHECKS } from '../config.js';
import { checkPage, toRouteCheck, type RouteSpec } from '../utils/page-check.js';

export interface FrameworkConfig {
  name: string;
  dir: string;
  installCmd: string;
  buildCmd: string;
  outputDir: string;
  /**
   * Everything else the build writes and would read back on the next run.
   * Cleared with `outputDir` before every timed build, so each one is cold.
   */
  cacheDirs?: readonly string[];
  previewCmd: string;
  previewPort: number;
  versionPkg: string;
  versionPkgs?: readonly string[];
}

async function resolveVersion(appDir: string, pkg: string): Promise<string> {
  try {
    const pkgJson = join(appDir, 'node_modules', pkg, 'package.json');
    const raw = await readFile(pkgJson, 'utf-8');
    return JSON.parse(raw).version ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Resolves every package version that shapes this app's numbers.
 *
 * A package that is not installed is left out of the map rather than recorded
 * as 'unknown', so the file only ever states versions that were really there.
 * Litro links to the workspace, so its own version is the one built from this
 * commit.
 */
async function resolveVersions(
  appDir: string,
  pkgs: readonly string[],
): Promise<Record<string, string>> {
  const versions: Record<string, string> = {};
  for (const pkg of pkgs) {
    const version = await resolveVersion(appDir, pkg);
    if (version !== 'unknown') versions[pkg] = version;
  }
  return versions;
}

export async function measureFramework(
  config: FrameworkConfig,
  appsDir: string,
  runs: number,
  routes?: readonly RouteSpec[],
  env?: Record<string, string>,
  measureLighthouseFlag = false,
): Promise<FrameworkResult> {
  if (!Number.isSafeInteger(runs) || runs < 1) throw new Error('Build runs must be a positive integer');
  const appDir = join(appsDir, config.dir);
  console.log(`\n[cross-framework] ${config.name}`);
  const execEnv = env ? { ...process.env, ...env } : undefined;

  // Install deps if needed
  if (!existsSync(join(appDir, 'node_modules'))) {
    console.log(`  Installing dependencies...`);
    execSync(config.installCmd, { cwd: appDir, stdio: 'pipe', env: execEnv });
  }

  // Build N times.
  //
  // Every timed build is a cold build. Removing only `outputDir` used to leave
  // `.next/cache`, Nuxt's `node_modules/.cache/nuxt` and Litro's `.nitro` and
  // `node_modules/.vite` in place, so even run 1 was an incremental rebuild.
  // That was symmetric and therefore fair, but "build time" then meant
  // something no reader assumes it means, and the figure moved with whatever
  // happened to be on disk. Clearing the caches makes the number the one a
  // clean checkout produces.
  const times: number[] = [];
  for (let i = 0; i < runs; i++) {
    const outputDir = join(appDir, config.outputDir);
    rmSync(outputDir, { recursive: true, force: true });
    for (const cacheDir of config.cacheDirs ?? []) {
      rmSync(join(appDir, cacheDir), { recursive: true, force: true });
    }

    const start = performance.now();
    execSync(config.buildCmd, { cwd: appDir, stdio: 'pipe', env: execEnv });
    const elapsed = Math.round(performance.now() - start);

    times.push(elapsed);
    console.log(`  build ${i + 1}/${runs}: ${elapsed}ms`);
  }

  // Measure output size (after last build)
  const bundleSize = await measureStaticBundleSize(join(appDir, config.outputDir));
  const outputSize = bundleSize.totalOutput;
  console.log(`  output size: ${(outputSize / 1024).toFixed(1)} KB`);

  // Measure page weight
  const baseUrl = `http://localhost:${config.previewPort}`;
  const proc = await startCommand(config.previewCmd, [], appDir, config.previewPort, 'preview', true, env);

  const pageWeight: Record<string, PageWeightResult> = {};
  let httpPerf: FrameworkResult['httpPerf'] = {};
  let lighthouse: Record<string, LighthouseResult> | undefined;
  try {
    await waitForReady(baseUrl, undefined, proc);

    const effectiveRoutes = (routes ?? CROSS_FRAMEWORK_ROUTE_CHECKS).map(toRouteCheck);
    const broken: string[] = [];
    for (const check of effectiveRoutes) {
      const route = check.path;
      const res = await fetch(baseUrl + route, { signal: AbortSignal.timeout(30_000) });
      const buf = Buffer.from(await res.arrayBuffer());
      pageWeight[route] = {
        rawBytes: buf.byteLength,
        gzipBytes: gzipSize(buf),
        statusCode: res.status,
      };
      const problem = checkPage(check, res.status, buf.toString('utf-8'));
      if (problem) broken.push(problem);
      console.log(`  ${route}: ${res.status} — ${buf.byteLength} bytes (gzip: ${gzipSize(buf)})`);
    }

    // Stop the run rather than record a comparison between a working app and a
    // broken one. The April 2026 results shipped with Litro answering 404 for
    // /blog/hello while Nuxt and Next answered 200: Litro's page weight for
    // that route was the weight of an error page, and its output size was the
    // size of a build missing a page. Nothing in the harness objected, and the
    // numbers were published. A route that does not answer 200 with its own
    // rendered content now fails the run — see utils/page-check.ts for the two
    // ways a broken app still answers 200.
    if (broken.length > 0) {
      throw new Error(
        `[${config.name}] did not serve every measured route: ${broken.join(', ')}. ` +
        `A framework comparison is only meaningful when all apps serve the same pages, ` +
        `so no results are written. Fix the app, do not relax this check.`,
      );
    }

    console.log('  static HTTP performance...');
    httpPerf = await measureHttpPerf(baseUrl, effectiveRoutes.map(r => r.path));

    if (measureLighthouseFlag) {
      console.log(`  lighthouse audit...`);
      lighthouse = await measureLighthouse(baseUrl, effectiveRoutes.map(r => r.path));
    }
  } finally {
    await stopServer(proc);
  }

  const version = await resolveVersion(appDir, config.versionPkg);
  const versions = await resolveVersions(
    appDir,
    config.versionPkgs ?? [config.versionPkg],
  );
  console.log(`  version: ${version}`);
  console.log(`  stack: ${Object.entries(versions).map(([p, v]) => `${p}@${v}`).join(', ')}`);

  return {
    name: config.name,
    version,
    versions,
    buildTime: computeStats(times),
    outputSize,
    bundleSize,
    httpPerf,
    rendering: 'ssg',
    streaming: null,
    pageWeight,
    ...(lighthouse ? { lighthouse } : {}),
  };
}
