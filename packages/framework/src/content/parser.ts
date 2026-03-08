import { readFile, stat } from 'node:fs/promises';
import { basename, extname, dirname, relative } from 'pathe';
import matter from 'gray-matter';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import type { Post } from './types.js';

/**
 * Parse a single Markdown file into a Post object.
 *
 * @param filePath      Absolute path to the .md / .markdown file
 * @param contentDir    Absolute path to the content directory (used to derive slug)
 * @param directoryData Optional directory-level data merged into frontmatter
 *                      (file frontmatter values win on conflict)
 */
export async function parseMarkdownFile(
  filePath: string,
  contentDir: string,
  directoryData?: Record<string, unknown>,
): Promise<Post> {
  // 1. Read the file
  const raw = await readFile(filePath, 'utf-8');

  // 2. Parse frontmatter + body with gray-matter
  const parsed = matter(raw);
  const rawBody = parsed.content;

  // 3. Merge directoryData — file frontmatter wins on conflict
  const merged: Record<string, unknown> = {
    ...(directoryData ?? {}),
    ...parsed.data,
  };

  // 4a. title
  const filenameWithoutExt = basename(filePath, extname(filePath));
  const title: string =
    typeof merged['title'] === 'string' && merged['title'].trim().length > 0
      ? (merged['title'] as string)
      : filenameWithoutExt;

  // 4b. date — coerce to Date; fall back to file mtime
  let date: Date;
  if (merged['date'] instanceof Date) {
    date = merged['date'];
  } else if (typeof merged['date'] === 'string' && merged['date'].trim().length > 0) {
    date = new Date(merged['date'] as string);
  } else if (typeof merged['date'] === 'number') {
    date = new Date(merged['date'] as number);
  } else {
    const fileStat = await stat(filePath);
    date = fileStat.mtime;
  }

  // 4c. tags — normalise to string[]
  let tags: string[];
  if (Array.isArray(merged['tags'])) {
    tags = (merged['tags'] as unknown[]).map(String);
  } else if (typeof merged['tags'] === 'string' && (merged['tags'] as string).trim().length > 0) {
    tags = (merged['tags'] as string).split(',').map((t) => t.trim()).filter(Boolean);
  } else {
    tags = [];
  }

  // 4d. draft
  const draft: boolean =
    typeof merged['draft'] === 'boolean' ? (merged['draft'] as boolean) : false;

  // 5. Derive slug
  const relPath = relative(contentDir, filePath);
  // Strip extension
  const relNoExt = relPath.replace(/\.(md|markdown)$/i, '');
  // If filename (without ext) is "index", use parent directory name
  const parts = relNoExt.split('/');
  let slug: string;
  if (parts[parts.length - 1] === 'index' && parts.length > 1) {
    slug = parts[parts.length - 2];
  } else {
    slug = parts[parts.length - 1];
  }

  // 6. Derive URL
  // Frontmatter 'url' or 'permalink' takes full precedence.
  // Otherwise derive from the file's path relative to the parent of contentDir
  // so that the content directory name becomes the URL prefix:
  //   contentDir=…/content/blog, file=…/content/blog/hello-world.md → /blog/hello-world
  //   contentDir=…/content/articles, file=…/content/articles/my-post.md → /articles/my-post
  let url: string;
  if (typeof merged['url'] === 'string' && merged['url'].trim().length > 0) {
    url = merged['url'] as string;
  } else if (typeof merged['permalink'] === 'string' && merged['permalink'].trim().length > 0) {
    url = merged['permalink'] as string;
  } else {
    const contentParent = dirname(contentDir);
    const relFromParent = relative(contentParent, filePath).replace(/\.(md|markdown)$/i, '');
    const urlParts = relFromParent.split('/');
    // Mirror the index-file handling used for slug derivation
    if (urlParts[urlParts.length - 1] === 'index' && urlParts.length > 1) {
      urlParts.pop();
    }
    url = '/' + urlParts.join('/');
  }

  // 7. Render body to HTML
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeStringify, { allowDangerousHtml: true });

  const vfile = await processor.process(rawBody);
  const body = String(vfile);

  // 8. Return Post
  return {
    slug,
    title,
    date,
    description: typeof merged['description'] === 'string' ? merged['description'] : undefined,
    tags,
    draft,
    body,
    rawBody,
    url,
    frontmatter: merged,
  };
}
