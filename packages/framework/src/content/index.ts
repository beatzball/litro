import { readFile } from 'node:fs/promises';
import { dirname, join } from 'pathe';
import fg from 'fast-glob';
import { parseMarkdownFile } from './parser.js';
import type { Post, GetPostsOptions } from './types.js';

export type { Post, GetPostsOptions };
export type { ContentAPI } from './types.js';

/**
 * Reads a `.11tydata.json` file for the given directory, or returns `{}`.
 */
async function readJsonDataFile(dir: string): Promise<Record<string, unknown>> {
  const jsonPath = join(dir, '.11tydata.json');
  try {
    const text = await readFile(jsonPath, 'utf-8');
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/**
 * Dynamically imports a `.11tydata.js` file for the given directory, or returns `{}`.
 */
async function readJsDataFile(dir: string): Promise<Record<string, unknown>> {
  const jsPath = join(dir, '.11tydata.js');
  try {
    const mod = await import(jsPath) as { default?: Record<string, unknown> } | Record<string, unknown>;
    const result = (mod as { default?: Record<string, unknown> }).default ?? (mod as Record<string, unknown>);
    return (result as Record<string, unknown>) ?? {};
  } catch {
    return {};
  }
}

/**
 * Loads the merged directory data for a given directory.
 * `.11tydata.js` wins over `.11tydata.json` on conflict.
 */
async function loadDirectoryData(dir: string): Promise<Record<string, unknown>> {
  const [jsonData, jsData] = await Promise.all([
    readJsonDataFile(dir),
    readJsDataFile(dir),
  ]);
  return { ...jsonData, ...jsData };
}

export class ContentIndex {
  private contentDir: string;
  private posts: Map<string, Post> = new Map();
  private tagIndex: Map<string, Post[]> = new Map();
  private built = false;
  private includeDrafts: boolean;
  private _buildPromise: Promise<void> | null = null;

  constructor(contentDir: string, options?: { includeDrafts?: boolean }) {
    this.contentDir = contentDir;
    this.includeDrafts = options?.includeDrafts ?? false;
  }

  /**
   * Scans `contentDir` for Markdown files, parses them, and builds internal
   * indices. Safe to call concurrently — all callers await the same promise.
   *
   * Design note: the promise is memoized after the first call, so subsequent
   * calls return the already-resolved promise without re-scanning. Content
   * changes at runtime are not picked up without creating a new ContentIndex
   * instance. In dev mode this is handled by Nitro's dev:reload hook, which
   * restarts the server (and therefore re-creates the instance).
   */
  build(): Promise<void> {
    if (!this._buildPromise) this._buildPromise = this.#doBuild();
    return this._buildPromise;
  }

  async #doBuild(): Promise<void> {
    const files = await fg(['**/*.md', '**/*.markdown'], {
      cwd: this.contentDir,
      absolute: true,
      dot: true,
    });

    // Cache directory data so we only read each directory once
    const dirDataCache = new Map<string, Record<string, unknown>>();

    const getDirData = async (dir: string): Promise<Record<string, unknown>> => {
      if (dirDataCache.has(dir)) return dirDataCache.get(dir)!;
      const data = await loadDirectoryData(dir);
      dirDataCache.set(dir, data);
      return data;
    };

    const parsedPosts = await Promise.all(
      files.map(async (file) => {
        const dir = dirname(file);
        const directoryData = await getDirData(dir);
        return parseMarkdownFile(file, this.contentDir, directoryData);
      }),
    );

    // Filter out drafts unless includeDrafts is true
    const filtered = this.includeDrafts
      ? parsedPosts
      : parsedPosts.filter((p) => !p.draft);

    // Sort by date descending
    const sorted = filtered.sort(
      (a, b) => b.date.getTime() - a.date.getTime(),
    );

    // Build posts map and tagIndex
    this.posts = new Map();
    this.tagIndex = new Map();

    for (const post of sorted) {
      this.posts.set(post.slug, post);
      for (const tag of post.tags) {
        if (!this.tagIndex.has(tag)) this.tagIndex.set(tag, []);
        this.tagIndex.get(tag)!.push(post);
      }
    }

    this.built = true;
  }

  /**
   * Returns posts matching the given options, sorted by date descending.
   */
  async getPosts(options?: GetPostsOptions): Promise<Post[]> {
    if (!this.built) await this.build();

    const effectiveIncludeDrafts =
      options?.includeDrafts ?? this.includeDrafts;

    let result: Post[];

    if (options?.tag) {
      result = this.tagIndex.get(options.tag) ?? [];
    } else {
      result = Array.from(this.posts.values());
    }

    // Apply draft filter
    if (!effectiveIncludeDrafts) {
      result = result.filter((p) => !p.draft);
    }

    // Already sorted descending from build(); maintain order
    if (options?.limit !== undefined && options.limit > 0) {
      result = result.slice(0, options.limit);
    }

    return result;
  }

  /**
   * Returns a single post by slug, or null if not found.
   */
  async getPost(slug: string): Promise<Post | null> {
    if (!this.built) await this.build();
    return this.posts.get(slug) ?? null;
  }

  /**
   * Returns all unique tags, sorted alphabetically.
   */
  async getTags(): Promise<string[]> {
    if (!this.built) await this.build();
    return Array.from(this.tagIndex.keys()).sort();
  }

  /**
   * Reads global site metadata from `_data/metadata.js` (or `.json`) relative
   * to the parent directory of `contentDir`.
   *
   * Lookup order:
   *   1. `<parent of contentDir>/_data/metadata.js`  (dynamic import, default export)
   *   2. `<parent of contentDir>/_data/metadata.json`
   *   3. `{}`
   */
  async getGlobalData(): Promise<Record<string, unknown>> {
    const dataDir = join(dirname(this.contentDir), '_data');

    // Try .js first
    const jsPath = join(dataDir, 'metadata.js');
    try {
      const mod = await import(jsPath) as { default?: Record<string, unknown> } | Record<string, unknown>;
      const result = (mod as { default?: Record<string, unknown> }).default ?? (mod as Record<string, unknown>);
      if (result && typeof result === 'object') {
        return result as Record<string, unknown>;
      }
    } catch {
      // fall through
    }

    // Try .json
    const jsonPath = join(dataDir, 'metadata.json');
    try {
      const text = await readFile(jsonPath, 'utf-8');
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      // fall through
    }

    return {};
  }
}
