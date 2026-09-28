/**
 * `--adapter elena`, run the way a user runs it.
 *
 * WHY THIS FILE EXISTS
 *
 * `src/adapters.test.ts` calls `deprecationNotice()` directly, so it proves the
 * string exists and says the right things. It cannot prove the CLI ever prints
 * it: `src/index.ts` is the file that decides that, and no unit spec executes
 * it. Deleting the two lines in `index.ts` that print the notice leaves that
 * suite green.
 *
 * So this spec builds the package and runs `dist/src/index.js` in a child
 * process, exactly as `cli-project-path.test.ts` does, and asserts on stdout.
 *
 * It also asserts the other half of deprecation, which matters more: the app is
 * still scaffolded, and it is still an Elena app. Deprecated is not removed.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PKG = dirname(dirname(fileURLToPath(import.meta.url)));
const CLI = join(PKG, 'dist', 'src', 'index.js');

// `dist/` is built once by the globalSetup in vitest.config.ts — never here:
// two specs building in parallel workers delete each other's dist/.

/** Run the CLI and return its stdout. stdin is not a TTY, so nothing prompts. */
function run(args: string[], cwd: string): string {
  return execFileSync(process.execPath, [CLI, ...args], {
    cwd,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

async function withTmp(fn: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), 'litro-cli-adapter-'));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

describe('scaffolding with a deprecated adapter', () => {
  it('still writes a working Elena app, and says the adapter is deprecated', async () => {
    await withTmp(async (dir) => {
      const target = join(dir, 'elena-app');
      const out = run([target, '--recipe', 'fullstack', '--mode', 'ssr', '--adapter', 'elena'], dir);

      // 1. The notice reached stdout. This is the assertion that fails without
      //    the two lines in src/index.ts.
      expect(out).toContain("the 'elena' adapter is deprecated");
      expect(out).toContain('will be removed at v1');
      expect(out).toContain("'lit' and 'fast' are the supported choices");

      // 2. It reads as information, not as a failure. A scaffold that worked
      //    must not print something a user mistakes for an error.
      expect(out).not.toMatch(/\bError\b|\bWarning\b|\bfailed\b/);

      // 3. The app is there, and it is an Elena app. Deprecation must not
      //    change a single byte of what a user who asks for it receives.
      expect(existsSync(join(target, 'package.json')), `nothing at ${target}`).toBe(true);
      const nitro = await readFile(join(target, 'nitro.config.ts'), 'utf-8');
      expect(nitro).toContain("LITRO_ADAPTER = 'elena'");
      const pkg = JSON.parse(await readFile(join(target, 'package.json'), 'utf-8'));
      expect(Object.keys(pkg.dependencies)).toContain('@elenajs/core');
    });
  }, 300_000);

  it('prints no notice for a live adapter', async () => {
    await withTmp(async (dir) => {
      const target = join(dir, 'lit-app');
      const out = run([target, '--recipe', 'fullstack', '--mode', 'ssr', '--adapter', 'lit'], dir);
      expect(out).not.toContain('deprecated');
      expect(existsSync(join(target, 'package.json'))).toBe(true);
    });
  }, 300_000);
});
