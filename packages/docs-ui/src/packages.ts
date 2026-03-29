import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'pathe';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';

export interface PackageInfo {
  slug: string;
  name: string;
  dir: string;
  version: string;
  description: string;
  readmeHtml: string;
  readmeMd: string;
  changelogHtml: string;
  changelogMd: string;
}

const PACKAGES = [
  { slug: 'litro',        dir: 'framework',    name: '@beatzball/litro' },
  { slug: 'litro-router', dir: 'litro-router', name: '@beatzball/litro-router' },
  { slug: 'create-litro', dir: 'create-litro', name: '@beatzball/create-litro' },
] as const;

export const ALL_PACKAGE_SLUGS = PACKAGES.map(p => p.slug);

export async function renderMarkdown(md: string): Promise<string> {
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeStringify, { allowDangerousHtml: true });
  const vfile = await processor.process(md);
  return String(vfile);
}

export async function getPackageInfo(slug: string): Promise<PackageInfo | null> {
  const pkg = PACKAGES.find(p => p.slug === slug);
  if (!pkg) return null;

  // process.cwd() is the docs/ workspace root during litro build/dev
  const root = resolve(process.cwd(), '..');
  const pkgJson = JSON.parse(
    readFileSync(resolve(root, 'packages', pkg.dir, 'package.json'), 'utf-8'),
  ) as { version: string; description: string };

  // README — strip the leading # h1 (same as the page title)
  const readmePath = resolve(root, 'packages', pkg.dir, 'README.md');
  const rawReadme = existsSync(readmePath)
    ? readFileSync(readmePath, 'utf-8')
    : '';
  const readmeMd = rawReadme.replace(/^#\s+.+\n/, '');

  // CHANGELOG — strip the leading # h1
  const changelogMd = readFileSync(
    resolve(root, 'packages', pkg.dir, 'CHANGELOG.md'),
    'utf-8',
  ).replace(/^#\s+.+\n/, '');

  const [readmeHtml, changelogHtml] = await Promise.all([
    renderMarkdown(readmeMd),
    renderMarkdown(changelogMd),
  ]);

  return {
    ...pkg,
    version: pkgJson.version,
    description: pkgJson.description,
    readmeHtml,
    readmeMd,
    changelogHtml,
    changelogMd,
  };
}
