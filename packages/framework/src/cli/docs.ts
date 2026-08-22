/**
 * `litro docs` — keep a docs site's navigation honest.
 *
 * WHY THIS EXISTS
 *
 * The starlight recipe has two sources of truth that can silently disagree:
 * the Markdown files under the content directory, and the hand-written
 * `sidebar` array in `server/starlight.config.js`. Add a page and forget the
 * config and the page is live but unreachable — no link, no prev/next, and
 * nothing anywhere says so.
 *
 * Worse, the recipe's own documentation claims `sidebar.order` in a page's
 * frontmatter "controls sort order within the sidebar group". It never did:
 * nothing read that field. `sync` makes that sentence true by generating the
 * sidebar from the frontmatter, so the pages themselves are the source of
 * truth and the config becomes derived output.
 *
 *   litro docs sync    regenerate the sidebar from the content directory
 *   litro docs check   verify pages and sidebar agree (exit 1 if not)
 *
 * `check` is the CI-shaped half: it changes nothing and fails loudly.
 */
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve, basename, extname } from 'pathe';
import process from 'node:process';
import { resolveContentDir } from '../content/resolve-content-dir.js';

/** A docs page as the sidebar cares about it. */
export interface DocsPage {
  /** URL slug, derived from the filename. */
  slug: string;
  /** Path relative to the project root, for error messages. */
  relPath: string;
  title: string;
  description: string;
  /** Sidebar label. Defaults to `title`; `sidebar.label` overrides it. */
  label: string;
  /** Sidebar group label. Pages with no group land in `defaultGroup`. */
  group: string;
  /** Sort key within the group. Pages without one sort last, then by title. */
  order: number | null;
}

export interface SidebarGroup {
  label: string;
  items: Array<{ label: string; slug: string }>;
}

/** Problems `check` reports. Each one is a reason a reader hits a dead end. */
export interface DocsProblem {
  relPath: string;
  kind: string;
  detail: string;
}

const DEFAULT_GROUP = 'Documentation';

/**
 * Parse just enough YAML frontmatter for the fields the sidebar needs.
 *
 * Deliberately not a YAML parser: the recipe's frontmatter is a flat block of
 * `key: value` plus an optional one-level `sidebar:` map, and pulling in a
 * parser for that would be the only reason this module needed a dependency.
 * Anything more exotic is reported by `check` rather than guessed at.
 */
export function parseFrontmatter(source: string): Record<string, string> {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source);
  if (!match) return {};

  const fields: Record<string, string> = {};
  let currentParent: string | null = null;

  for (const rawLine of match[1].split(/\r?\n/)) {
    if (rawLine.trim() === '' || rawLine.trimStart().startsWith('#')) continue;

    const indented = /^\s/.test(rawLine);
    const pair = /^\s*([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(rawLine);
    if (!pair) continue;

    const [, key, rawValue] = pair;
    const value = rawValue.trim().replace(/^['"]|['"]$/g, '');

    if (!indented) {
      currentParent = value === '' ? key : null;
      if (value !== '') fields[key] = value;
    } else if (currentParent) {
      fields[`${currentParent}.${key}`] = value;
    }
  }

  return fields;
}

/** Slug for a content file: the filename, or the directory for `index.md`. */
function slugFor(filePath: string): string {
  const base = basename(filePath, extname(filePath));
  return base === 'index' ? basename(join(filePath, '..')) : base;
}

/** Every `.md` file under `dir`, recursively, sorted for stable output. */
async function markdownFiles(dir: string): Promise<string[]> {
  const found: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await markdownFiles(full)));
    else if (entry.name.endsWith('.md')) found.push(full);
  }
  return found;
}

/** Read every docs page under `docsDir`. */
export async function readDocsPages(
  docsDir: string,
  rootDir: string,
): Promise<DocsPage[]> {
  const files = await markdownFiles(docsDir);
  const pages: DocsPage[] = [];

  for (const file of files) {
    const source = await readFile(file, 'utf-8');
    const fm = parseFrontmatter(source);
    const rawOrder = fm['sidebar.order'];
    const parsedOrder = rawOrder === undefined ? NaN : Number(rawOrder);

    pages.push({
      slug: slugFor(file),
      relPath: file.startsWith(rootDir) ? file.slice(rootDir.length + 1) : file,
      title: fm.title ?? '',
      description: fm.description ?? '',
      label: fm['sidebar.label'] ?? fm.title ?? '',
      group: fm['sidebar.group'] ?? DEFAULT_GROUP,
      order: Number.isFinite(parsedOrder) ? parsedOrder : null,
    });
  }

  return pages;
}

/**
 * Build the sidebar tree from pages.
 *
 * Groups appear in the order their lowest-ordered page appears, so moving a
 * page's `order` can promote its whole group. Within a group, pages sort by
 * `order`; pages without one sort last, alphabetically by title, so a page
 * that forgets the field is still reachable rather than dropped.
 */
export function buildSidebar(pages: DocsPage[]): SidebarGroup[] {
  const byGroup = new Map<string, DocsPage[]>();
  for (const page of pages) {
    const bucket = byGroup.get(page.group);
    if (bucket) bucket.push(page);
    else byGroup.set(page.group, [page]);
  }

  const rank = (p: DocsPage) => (p.order === null ? Number.MAX_SAFE_INTEGER : p.order);

  const groups: SidebarGroup[] = [];
  for (const [label, groupPages] of byGroup) {
    const sorted = [...groupPages].sort(
      (a, b) => rank(a) - rank(b) || a.title.localeCompare(b.title),
    );
    groups.push({
      label,
      items: sorted.map((p) => ({ label: p.label || p.slug, slug: p.slug })),
    });
  }

  return groups.sort(
    (a, b) =>
      Math.min(...byGroup.get(a.label)!.map(rank)) -
      Math.min(...byGroup.get(b.label)!.map(rank)),
  );
}

/** Render the sidebar as the `sidebar: [...]` literal for the config file. */
export function renderSidebar(groups: SidebarGroup[]): string {
  const width = Math.max(
    0,
    ...groups.flatMap((g) => g.items.map((i) => `'${i.label}',`.length)),
  );

  const body = groups
    .map((group) => {
      const items = group.items
        .map((item) => {
          const label = `'${item.label}',`.padEnd(width);
          return `        { label: ${label} slug: '${item.slug}' },`;
        })
        .join('\n');
      return `    {\n      label: '${group.label}',\n      items: [\n${items}\n      ],\n    },`;
    })
    .join('\n');

  return `  sidebar: [\n${body}\n  ],`;
}

/**
 * Replace the `sidebar: [...]` block in a starlight config.
 *
 * Returns null when the block cannot be found, so the caller can fail loudly
 * rather than append a second `sidebar` key that silently loses to the first.
 */
export function replaceSidebarBlock(
  configSource: string,
  rendered: string,
): string | null {
  const start = configSource.indexOf('  sidebar: [');
  if (start === -1) return null;

  // Walk brackets so a `[` inside a label cannot end the block early.
  let depth = 0;
  let end = -1;
  for (let i = configSource.indexOf('[', start); i < configSource.length; i++) {
    const ch = configSource[i];
    if (ch === '[') depth++;
    else if (ch === ']') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end === -1) return null;

  const after = configSource.slice(end + 1);
  const trailingComma = after.startsWith(',') ? 1 : 0;
  return configSource.slice(0, start) + rendered + after.slice(trailingComma);
}

/** Everything `check` verifies. Pure, so it is straightforward to test. */
export function findProblems(
  pages: DocsPage[],
  sources: Map<string, string>,
): DocsProblem[] {
  const problems: DocsProblem[] = [];

  for (const page of pages) {
    if (!page.title) {
      problems.push({
        relPath: page.relPath,
        kind: 'missing title',
        detail: 'Frontmatter needs a `title:` — it becomes the <h1> and the sidebar label.',
      });
    }
    if (!page.description) {
      problems.push({
        relPath: page.relPath,
        kind: 'missing description',
        detail: 'Frontmatter needs a `description:` — it is used for SEO and the OG image.',
      });
    }

    const body = (sources.get(page.relPath) ?? '').replace(/^---[\s\S]*?\r?\n---/, '');
    if (/^\s*#\s+/m.test(body.split('\n').slice(0, 8).join('\n'))) {
      problems.push({
        relPath: page.relPath,
        kind: 'duplicate h1',
        detail:
          'Body starts with `# ` but the frontmatter title is already rendered as the ' +
          '<h1>. Start the body at `## `.',
      });
    }
  }

  const bySlug = new Map<string, DocsPage[]>();
  for (const page of pages) {
    const bucket = bySlug.get(page.slug);
    if (bucket) bucket.push(page);
    else bySlug.set(page.slug, [page]);
  }
  for (const [slug, dupes] of bySlug) {
    if (dupes.length < 2) continue;
    problems.push({
      relPath: dupes.map((d) => d.relPath).sort().join(', '),
      kind: 'duplicate slug',
      detail:
        `Slugs are filename-derived and must be unique across the whole content ` +
        `directory; "${slug}" is claimed by ${dupes.length} files.`,
    });
  }

  return problems;
}

/**
 * Read the group structure already in a config file.
 *
 * Used to refuse a `sync` that would silently flatten a hand-built navigation:
 * grouping is a design decision, and losing it should never be a side effect.
 */
export function existingGroups(configSource: string): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  const block = /sidebar:\s*\[([\s\S]*?)\n  \],/.exec(configSource);
  if (!block) return groups;

  const groupRe = /label:\s*'([^']+)',\s*\n\s*items:\s*\[([\s\S]*?)\]/g;
  for (const match of block[1].matchAll(groupRe)) {
    const slugs = [...match[2].matchAll(/slug:\s*'([^']+)'/g)].map((m) => m[1]);
    groups.set(match[1], slugs);
  }
  return groups;
}

// ---------------------------------------------------------------------------
// Command entry points
// ---------------------------------------------------------------------------

interface DocsPaths {
  rootDir: string;
  docsDir: string;
  configPath: string;
}

async function resolvePaths(rootDir: string): Promise<DocsPaths | string> {
  const contentDir = await resolveContentDir(rootDir, resolve(rootDir, 'content'));
  const docsDir = existsSync(join(contentDir, 'docs'))
    ? join(contentDir, 'docs')
    : contentDir;
  if (!existsSync(docsDir)) {
    return `No content directory found. Looked for ${docsDir}. Is this a Litro docs site?`;
  }

  const configPath = join(rootDir, 'server/starlight.config.js');
  if (!existsSync(configPath)) {
    return `No ${configPath}. \`litro docs\` expects a site built from the starlight recipe.`;
  }

  return { rootDir, docsDir, configPath };
}

export async function docsSync(rootDir: string, force = false): Promise<number> {
  const paths = await resolvePaths(rootDir);
  if (typeof paths === 'string') {
    console.error(`[litro docs] ${paths}`);
    return 1;
  }

  const pages = await readDocsPages(paths.docsDir, rootDir);
  if (pages.length === 0) {
    console.error(`[litro docs] No .md pages under ${paths.docsDir}.`);
    return 1;
  }

  const untitled = pages.filter((p) => !p.title);
  if (untitled.length > 0) {
    // Refuse rather than write a sidebar labelled with raw slugs: a wrong nav
    // is harder to notice than a missing one.
    console.error('[litro docs] Cannot sync — these pages have no frontmatter `title`:');
    for (const p of untitled) console.error(`  ${p.relPath}`);
    return 1;
  }

  const configSource = await readFile(paths.configPath, 'utf-8');

  // Refuse to silently flatten a hand-built navigation. If the config already
  // has several groups but no page says which group it belongs to, syncing
  // would drop every group into one bucket -- a design decision quietly
  // discarded. Print the mapping that already exists so restoring it is a
  // copy-paste, and let --force through for a deliberate flatten.
  const priorGroups = existingGroups(configSource);
  const anyPageDeclaresGroup = pages.some((p) => p.group !== DEFAULT_GROUP);
  if (priorGroups.size > 1 && !anyPageDeclaresGroup && !force) {
    const groupOf = new Map<string, string>();
    for (const [label, slugs] of priorGroups) {
      for (const slug of slugs) groupOf.set(slug, label);
    }
    console.error(
      `[litro docs] Refusing to sync: the sidebar has ${priorGroups.size} groups, but no\n` +
        `page declares one, so syncing would collapse them into a single group.\n\n` +
        `Add the group to each page's frontmatter to keep the current structure:\n`,
    );
    for (const p of pages) {
      const label = groupOf.get(p.slug);
      console.error(`  ${p.relPath}`);
      console.error(`    sidebar:\n      group: ${label ?? '<new page — pick a group>'}`);
    }
    console.error(`\nOr re-run with --force to flatten the sidebar deliberately.`);
    return 1;
  }

  const updated = replaceSidebarBlock(configSource, renderSidebar(buildSidebar(pages)));
  if (updated === null) {
    console.error(
      `[litro docs] Could not find a \`sidebar: [ ... ]\` block in ${paths.configPath}.`,
    );
    return 1;
  }

  if (updated === configSource) {
    console.log(`[litro docs] Sidebar already matches ${pages.length} pages. No change.`);
    return 0;
  }

  await writeFile(paths.configPath, updated, 'utf-8');
  console.log(`[litro docs] Sidebar rewritten from ${pages.length} pages.`);
  return 0;
}

export async function docsCheck(rootDir: string): Promise<number> {
  const paths = await resolvePaths(rootDir);
  if (typeof paths === 'string') {
    console.error(`[litro docs] ${paths}`);
    return 1;
  }

  const pages = await readDocsPages(paths.docsDir, rootDir);
  const sources = new Map<string, string>();
  for (const page of pages) {
    sources.set(page.relPath, await readFile(join(rootDir, page.relPath), 'utf-8'));
  }

  const problems = findProblems(pages, sources);

  // A page missing from the sidebar is live but unreachable — the exact drift
  // this command exists to catch.
  const configSource = await readFile(paths.configPath, 'utf-8');
  const listed = new Set(
    [...configSource.matchAll(/slug:\s*'([^']+)'/g)].map((m) => m[1]),
  );
  for (const page of pages) {
    if (!listed.has(page.slug)) {
      problems.push({
        relPath: page.relPath,
        kind: 'not in sidebar',
        detail: `"${page.slug}" is reachable by URL but has no sidebar link. Run \`litro docs sync\`.`,
      });
    }
  }
  for (const slug of listed) {
    if (!pages.some((p) => p.slug === slug)) {
      problems.push({
        relPath: 'server/starlight.config.js',
        kind: 'dangling sidebar link',
        detail: `Sidebar links "${slug}" but no page has that slug — the link 404s.`,
      });
    }
  }

  if (problems.length === 0) {
    console.log(`[litro docs] OK — ${pages.length} pages, sidebar in sync.`);
    return 0;
  }

  console.error(
    `[litro docs] ${problems.length} problem${problems.length === 1 ? '' : 's'}:\n`,
  );
  for (const p of problems) {
    console.error(`  ${p.relPath}`);
    console.error(`    [${p.kind}] ${p.detail}`);
  }
  return 1;
}

/** Dispatch for `litro docs <subcommand>`. */
export async function docsCommand(args: string[], rootDir: string): Promise<number> {
  const [subcommand] = args;
  switch (subcommand) {
    case 'sync':
      return docsSync(rootDir, args.includes('--force'));
    case 'check':
      return docsCheck(rootDir);
    default:
      console.error(
        `Usage: litro docs <sync|check>\n\n` +
          `  sync   regenerate the sidebar in server/starlight.config.js from the\n` +
          `         content directory's frontmatter (title, sidebar.group, sidebar.order)\n` +
          `  check  verify every page has a title and description, slugs are unique,\n` +
          `         and the sidebar and pages agree. Changes nothing; exits 1 on drift.\n`,
      );
      return subcommand === undefined ? 1 : 1;
  }
}
