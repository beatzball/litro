/**
 * `--for-repo` — turn a freshly scaffolded starlight site into *this project's*
 * documentation site.
 *
 * WHY THIS EXISTS
 *
 * The starlight recipe produces a generic site: placeholder title, example
 * URL, a sample blog, a sidebar listing pages about Litro itself. Pointing it
 * at a real project meant a dozen mechanical edits — rename, retitle, set the
 * canonical URL, point "Edit this page" at the right branch, wire a deploy,
 * and write the instructions an agent needs to add a page correctly.
 *
 * All of that is derivable from the repository, so it is done here instead of
 * being retyped (or half-remembered) each time. What is NOT done here is the
 * writing: turning a README into good pages is a judgement call, and this
 * module deliberately leaves it to a human or an agent, guided by the
 * AGENTS.md it drops next to the content.
 */
import { readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, basename, resolve } from 'node:path';

export interface RepoInfo {
  /** Short project name, e.g. "roost". */
  name: string;
  /** One-line description, or '' when nothing could be found. */
  description: string;
  /** Canonical https URL of the repository, or '' if not a GitHub remote. */
  repoUrl: string;
  /** Default branch, used to build "edit this page" links. */
  defaultBranch: string;
}

export interface ForRepoOptions {
  /** Path to the repository the docs are for. */
  repoDir: string;
  /** Where the site was scaffolded. */
  siteDir: string;
  /** Public URL the site will be served from, e.g. https://roosting.dev. */
  siteUrl?: string;
  /** Site directory name relative to the repo root, for edit links. */
  siteRelPath: string;
  /** Emit Dockerfile + nginx.conf. */
  deploy: 'docker' | 'none';
  /** Keep the recipe's sample blog. */
  withBlog: boolean;
}

/** Run a command, returning '' instead of throwing when it is unavailable. */
function tryExec(cmd: string, args: string[], cwd: string): string {
  try {
    return execFileSync(cmd, args, {
      cwd,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

/** Normalise any git remote form to an https URL. */
export function normalizeRemote(remote: string): string {
  if (!remote) return '';
  // git@github.com:owner/repo.git, ssh://git@host/owner/repo, https://…/repo.git
  const ssh = /^[^@]+@([^:]+):(.+?)(?:\.git)?$/.exec(remote);
  if (ssh) {
    // A host alias like github.com-work resolves to the real host for URLs.
    const host = ssh[1].replace(/-.*$/, '') || ssh[1];
    return `https://${host}/${ssh[2]}`;
  }
  const url = /^(?:ssh|https?):\/\/(?:[^@]+@)?([^/]+)\/(.+?)(?:\.git)?$/.exec(remote);
  if (url) return `https://${url[1]}/${url[2]}`;
  return '';
}

/**
 * Learn what we can about the repository.
 *
 * Every lookup degrades to a sensible default rather than failing: scaffolding
 * must work in a directory with no git remote, no `gh`, and no network.
 */
export async function detectRepo(repoDir: string): Promise<RepoInfo> {
  const root = resolve(repoDir);
  const remote = tryExec('git', ['remote', 'get-url', 'origin'], root);
  const repoUrl = normalizeRemote(remote);

  const name = repoUrl ? basename(repoUrl) : basename(root);

  let defaultBranch =
    tryExec('git', ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD'], root)
      .split('/')
      .pop() ?? '';
  if (!defaultBranch) defaultBranch = tryExec('git', ['branch', '--show-current'], root);
  if (!defaultBranch) defaultBranch = 'main';

  // Description: the repo's own package.json first (offline, authoritative),
  // then GitHub via `gh` if it happens to be installed and authenticated.
  let description = '';
  const pkgPath = join(root, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(await readFile(pkgPath, 'utf-8'));
      if (typeof pkg.description === 'string') description = pkg.description;
    } catch {
      // A malformed package.json is the repo's problem, not a reason to fail here.
    }
  }
  if (!description && repoUrl.includes('github.com')) {
    const slug = repoUrl.split('github.com/')[1];
    const json = tryExec('gh', ['repo', 'view', slug, '--json', 'description'], root);
    if (json) {
      try {
        description = JSON.parse(json).description ?? '';
      } catch {
        /* leave empty */
      }
    }
  }

  return { name, description, repoUrl, defaultBranch };
}

/** Escape a value for embedding in a single-quoted JS string literal. */
function js(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

export function renderMetadata(repo: RepoInfo, siteUrl: string): string {
  return `export default {
  title: '${js(repo.name)}',
  url: '${js(siteUrl)}',
  language: 'en',
  description:
    '${js(repo.description)}',
  author: {
    name: '',
    email: '',
  },
};
`;
}

export function renderStarlightConfig(repo: RepoInfo, siteRelPath: string): string {
  const editBase = repo.repoUrl
    ? `'${js(repo.repoUrl)}/edit/${js(repo.defaultBranch)}/${js(siteRelPath)}/content/docs'`
    : 'null';
  const githubNav = repo.repoUrl
    ? `\n    { label: 'GitHub', href: '${js(repo.repoUrl)}' },`
    : '';

  return `export const siteConfig = {
  title: '${js(repo.name)}',
  description:
    '${js(repo.description)}',
  logo: null,
  // "Edit this page" links. Points at the default branch at scaffold time.
  editUrlBase: ${editBase},
  nav: [
    { label: 'Docs', href: '/docs/getting-started' },${githubNav}
  ],
  // Generated by \`litro docs sync\` from each page's frontmatter
  // (sidebar.order / sidebar.group / sidebar.label). Edit the pages, not this.
  sidebar: [
    {
      label: 'Documentation',
      items: [
        { label: 'Getting Started', slug: 'getting-started' },
      ],
    },
  ],
};

export default siteConfig;
`;
}

/**
 * The starter page.
 *
 * Deliberately short and obviously a placeholder: a scaffolder that writes
 * plausible-looking prose invites shipping text nobody wrote.
 */
export function renderStarterPage(repo: RepoInfo): string {
  return `---
title: Getting Started
description: ${repo.description || `What ${repo.name} is and how to install it.`}
sidebar:
  order: 1
  group: Documentation
---

## What ${repo.name} is

${repo.description || `_Describe ${repo.name} in a sentence or two._`}

## Install

\`\`\`sh
# TODO: the real install steps
\`\`\`

## Next steps

Replace this page, then add more under \`content/docs/\`. After adding or
renaming a page run:

\`\`\`sh
litro docs sync    # regenerate the sidebar from your pages
litro docs check   # verify pages and sidebar agree
\`\`\`
`;
}

export function renderDockerfile(): string {
  return `# Build the static site, then serve it with nginx.
#
# The build context is this directory, so a platform that builds from a
# subdirectory (Coolify: Base Directory) needs no extra path juggling.

FROM node:22-slim AS builder

RUN corepack enable

WORKDIR /app
# The lockfile glob tolerates its absence on a first build, before anyone has
# run install. corepack reads "packageManager" from package.json, so the image
# uses the same pnpm that produced the lockfile rather than the newest release.
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile || pnpm install

COPY . .
RUN pnpm build

FROM nginx:alpine

COPY --from=builder /app/dist/static /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
`;
}

export function renderNginxConf(): string {
  return `server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    # Keep redirects relative so a non-80 port or a proxy prefix survives.
    # With absolute_redirect on (the default), a trailing-slash redirect
    # rewrites the Host to nginx's own server_name and drops the port.
    absolute_redirect off;

    # Clean URLs. Serve the directory's index.html directly instead of
    # redirecting to the trailing-slash form: one fewer round trip, and no
    # chance of nginx rewriting host or port on the way.
    location / {
        try_files $uri $uri.html $uri/index.html =404;
    }

    # The client bundle has a stable name, but every deploy rewrites the file.
    location /_litro/ {
        expires 1y;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    # Shoelace icon assets are not content-hashed, so no immutable here.
    location /shoelace/ {
        expires 7d;
        add_header Cache-Control "public, max-age=604800";
    }

    location ~* \\.html$ {
        expires -1;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    gzip on;
    gzip_types text/html text/css application/javascript application/json image/svg+xml text/xml;
}
`;
}

export function renderDockerignore(): string {
  return `node_modules
dist
.output
.nitro
routes.generated.ts
server/stubs
*.tsbuildinfo
.DS_Store
`;
}

/**
 * Instructions any coding agent reads before touching the site.
 *
 * Harness-agnostic on purpose: it is plain Markdown, so Claude Code, Codex,
 * opencode and Cursor all work from the same rules instead of each needing
 * its own plugin.
 */
export function renderAgentsMd(repo: RepoInfo, siteUrl: string, siteRelPath: string): string {
  const site = siteUrl || 'the documentation site';
  return `# ${repo.name} docs site — agent instructions

This directory is the source for **${site}**. It is a Litro \`starlight\` site
in SSG mode: Markdown in, static HTML out.

Read this before changing anything in \`${siteRelPath}/\`.

## Where things live

| Path | What it is |
|------|-----------|
| \`content/docs/*.md\` | Every documentation page. One file = one page. |
| \`server/starlight.config.js\` | Site title, top nav, and the sidebar tree. |
| \`_data/metadata.js\` | Title, canonical URL, description (SEO and OG images). |
| \`pages/index.ts\` | The landing page (a Lit component, not Markdown). |
| \`pages/docs/[slug].ts\` | The doc page template. Not where you add a page. |

## Add a page

1. Create \`content/docs/<slug>.md\`. The filename becomes the URL:
   \`content/docs/foo.md\` → \`/docs/foo\`.

2. Give it frontmatter. \`title\` and \`description\` are required:

   \`\`\`markdown
   ---
   title: Your Page Title
   description: One sentence. Used for SEO and the OG image.
   sidebar:
     order: 2
     group: Documentation
   ---

   ## First heading

   Body starts here.
   \`\`\`

3. Regenerate the sidebar and verify:

   \`\`\`sh
   litro docs sync
   litro docs check
   \`\`\`

   Do **not** hand-edit the \`sidebar\` array — \`sync\` rewrites it from your
   pages' frontmatter.

## Rules

- **Start the body at \`##\`, not \`#\`.** The frontmatter \`title\` is already
  rendered as the page's \`<h1>\`; a \`#\` in the body makes a second one.
  \`litro docs check\` fails on this.
- **Slugs must be unique across the whole \`content/\` directory.** The build
  throws on a collision rather than silently dropping a page.
- **Internal links are absolute paths**: \`/docs/setup\`, not \`setup.md\`.
- **Never edit \`routes.generated.ts\` or anything in \`server/stubs/\`.** Both
  are regenerated on every build and are gitignored.
- **This site is for users. The repo \`README.md\` is for contributors.** Put a
  fact in one and link from the other rather than duplicating it.

## Verify

\`\`\`sh
pnpm install      # first time only
pnpm build        # must exit 0; prints every prerendered route
litro docs check  # pages and sidebar agree
pnpm dev          # live-reload while writing
\`\`\`

\`pnpm build\` is the real check: it fails on a duplicate slug, a missing
\`title\`, or a broken component, and prints the full route list so you can
confirm your page is there.
`;
}


/**
 * Remove what the recipe's landing page and e2e spec assume about the blog.
 *
 * Each edit asserts its target exists. If the recipe template is reshaped and
 * one of these no longer matches, scaffolding fails loudly here rather than
 * emitting a site with a dead link nobody notices until a reader clicks it.
 */
async function unlinkBlogReferences(siteDir: string, repo: RepoInfo): Promise<void> {
  const indexPath = join(siteDir, 'pages/index.ts');
  let index = await readFile(indexPath, 'utf-8');

  const blogCta = '<a href="/blog"';
  if (!index.includes(blogCta)) {
    throw new Error(
      `[create-litro] Expected a /blog link in pages/index.ts to rewrite. The ` +
        `starlight template changed shape; update unlinkBlogReferences().`,
    );
  }
  if (repo.repoUrl) {
    index = index.replace(blogCta, `<a href="${repo.repoUrl}"`).replace('">Blog</a>', '">GitHub</a>');
  } else {
    // No remote to point at, so drop the second call to action entirely
    // rather than leaving a button that goes nowhere.
    index = index.replace(/\s*<a href="\/blog"[\s\S]*?">Blog<\/a>/, '');
  }

  // The "Blog" feature card advertises a section that no longer exists.
  index = index.replace(
    /\s*\{\s*icon: '[^']*',\s*title: 'Blog',[\s\S]*?\},/,
    '',
  );
  await writeFile(indexPath, index, 'utf-8');

  // Point the generated e2e spec at the routes that actually exist.
  const specPath = join(siteDir, 'e2e/index.spec.ts');
  if (existsSync(specPath)) {
    const spec = await readFile(specPath, 'utf-8');
    const routes = [
      "const PRERENDERED_ROUTES = [",
      "  '/',",
      "  '/docs/getting-started',",
      "];",
    ].join('\n');
    const replaced = spec.replace(/const PRERENDERED_ROUTES = \[[\s\S]*?\];/, routes);
    if (replaced === spec) {
      throw new Error(
        `[create-litro] Expected PRERENDERED_ROUTES in e2e/index.spec.ts to rewrite.`,
      );
    }
    await writeFile(specPath, replaced, 'utf-8');
  }
}

/** Apply everything derivable from the repo to a freshly scaffolded site. */
export async function applyForRepo(options: ForRepoOptions): Promise<RepoInfo> {
  const repo = await detectRepo(options.repoDir);
  const { siteDir, siteRelPath } = options;
  const siteUrl = options.siteUrl ?? '';

  await writeFile(join(siteDir, '_data/metadata.js'), renderMetadata(repo, siteUrl), 'utf-8');
  await writeFile(
    join(siteDir, 'server/starlight.config.js'),
    renderStarlightConfig(repo, siteRelPath),
    'utf-8',
  );

  // Replace the recipe's Litro-specific sample pages with one honest starter.
  const docsDir = join(siteDir, 'content/docs');
  await rm(docsDir, { recursive: true, force: true });
  await mkdir(docsDir, { recursive: true });
  await writeFile(join(docsDir, 'getting-started.md'), renderStarterPage(repo), 'utf-8');
  await writeFile(join(docsDir, '.11tydata.json'), '{ "section": "docs" }\n', 'utf-8');

  if (!options.withBlog) {
    await rm(join(siteDir, 'content/blog'), { recursive: true, force: true });
    await rm(join(siteDir, 'pages/blog'), { recursive: true, force: true });
    // Deleting the pages is not enough: the landing page links to /blog and
    // the generated e2e spec asserts the blog routes return 200. Left alone,
    // a brand-new site ships a dead link and a failing test suite.
    await unlinkBlogReferences(siteDir, repo);
  }

  const pkgPath = join(siteDir, 'package.json');
  const pkg = JSON.parse(await readFile(pkgPath, 'utf-8'));
  pkg.name = `${repo.name}-docs`;

  // Pin the package manager to the one running now. Without this, corepack in
  // the Docker build resolves "pnpm" to the newest release rather than the one
  // that produced the lockfile -- which fails outright when the two disagree
  // about lockfile format or policy (pnpm 11 rejects recently-published
  // versions by default, so an install that works locally dies in the image).
  const pnpmVersion = tryExec('pnpm', ['--version'], siteDir);
  if (/^\d+\.\d+\.\d+/.test(pnpmVersion)) {
    pkg.packageManager = `pnpm@${pnpmVersion}`;
  }
  await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');

  if (options.deploy === 'docker') {
    await writeFile(join(siteDir, 'Dockerfile'), renderDockerfile(), 'utf-8');
    await writeFile(join(siteDir, 'nginx.conf'), renderNginxConf(), 'utf-8');
    await writeFile(join(siteDir, '.dockerignore'), renderDockerignore(), 'utf-8');
  }

  await writeFile(
    join(siteDir, 'AGENTS.md'),
    renderAgentsMd(repo, siteUrl, siteRelPath),
    'utf-8',
  );

  return repo;
}
