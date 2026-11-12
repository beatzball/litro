import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { getChromePath } from 'chrome-launcher';

/** Record versions only; executable locations can identify the local account. */
export async function collectToolVersions(includeChrome: boolean): Promise<Record<string, string>> {
  const versions: Record<string, string> = {};
  for (const name of ['lighthouse', 'chrome-launcher', 'serve', 'autocannon', 'tsx']) {
    const pkg = JSON.parse(await readFile(new URL(`../../node_modules/${name}/package.json`, import.meta.url), 'utf8'));
    if (/^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(pkg.version)) versions[name] = pkg.version;
  }
  const npm = execFileSync('npm', ['--version'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 }).trim();
  if (/^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(npm)) versions.npm = npm;
  if (includeChrome) {
    const output = execFileSync(getChromePath(), ['--version'], { encoding: 'utf8', timeout: 5000 });
    const version = output.match(/\b\d+\.\d+\.\d+\.\d+\b/);
    if (!version) throw new Error('Could not determine the Lighthouse browser version');
    versions.chrome = version[0];
  }
  return versions;
}
