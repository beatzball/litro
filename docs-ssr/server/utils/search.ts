import type { Post } from 'litro:content';
import type { H3Event } from 'h3';
import { previewPosts } from './preview.js';

export interface SearchResult {
  title: string;
  url: string;
  description: string;
  snippet: string;
  type: 'blog' | 'docs' | 'compare' | 'page';
  date?: string;
}

export interface SearchOptions {
  type?: 'blog' | 'docs' | 'all';
  limit?: number;
}

/** Map internal content URLs to public routes. */
function toPublicUrl(contentUrl: string): string {
  if (contentUrl.startsWith('/content/blog/'))
    return '/blog/' + contentUrl.slice('/content/blog/'.length);
  if (contentUrl.startsWith('/content/docs/'))
    return '/docs/' + contentUrl.slice('/content/docs/'.length);
  if (contentUrl.startsWith('/content/compare/'))
    return '/compare/' + contentUrl.slice('/content/compare/'.length);
  // Top-level content pages (e.g. why-web-components)
  if (contentUrl.startsWith('/content/'))
    return '/' + contentUrl.slice('/content/'.length);
  return contentUrl;
}

/** Determine content type from the internal URL. */
function contentType(url: string): SearchResult['type'] {
  if (url.startsWith('/content/blog/')) return 'blog';
  if (url.startsWith('/content/docs/')) return 'docs';
  if (url.startsWith('/content/compare/')) return 'compare';
  return 'page';
}

/** Strip HTML tags for plain-text search. */
function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '');
}

/**
 * Extract a snippet around the first match of `query` in `text`.
 * Wraps the matched substring in `<mark>` tags.
 */
export function extractSnippet(text: string, query: string, maxLen = 160): string {
  const plain = stripHtml(text);
  const lower = plain.toLowerCase();
  const idx = lower.indexOf(query.toLowerCase());

  if (idx === -1) {
    // No match in body — return the start of the text
    return plain.slice(0, maxLen) + (plain.length > maxLen ? '...' : '');
  }

  const pad = Math.floor((maxLen - query.length) / 2);
  const start = Math.max(0, idx - pad);
  const end = Math.min(plain.length, idx + query.length + pad);

  let snippet = '';
  if (start > 0) snippet += '...';
  const before = plain.slice(start, idx);
  const match = plain.slice(idx, idx + query.length);
  const after = plain.slice(idx + query.length, end);
  snippet += before + '<mark>' + match + '</mark>' + after;
  if (end < plain.length) snippet += '...';

  return snippet;
}

/** Score a post against a search query. Higher = better match. */
function scorePost(post: Post, queryLower: string): number {
  let score = 0;
  if (post.title.toLowerCase().includes(queryLower)) score += 10;
  if (post.description?.toLowerCase().includes(queryLower)) score += 5;
  if (post.rawBody.toLowerCase().includes(queryLower)) score += 1;
  return score;
}

/**
 * Search all content for a query string.
 * Returns results ranked by relevance (title > description > body).
 */
export async function searchContent(
  query: string,
  event: H3Event,
  options: SearchOptions = {},
): Promise<SearchResult[]> {
  if (!query.trim()) return [];

  const { type = 'all', limit = 20 } = options;
  const queryLower = query.toLowerCase().trim();

  const allPosts = await previewPosts(event);

  // Filter by content type if requested
  let posts = allPosts;
  if (type === 'blog') {
    posts = posts.filter(p => p.url.startsWith('/content/blog/'));
  } else if (type === 'docs') {
    posts = posts.filter(p => p.url.startsWith('/content/docs/'));
  }

  // Score and filter to posts that match at least somewhere
  const scored = posts
    .map(post => ({ post, score: scorePost(post, queryLower) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map(({ post }) => ({
    title: post.title,
    url: toPublicUrl(post.url),
    description: post.description ?? '',
    snippet: extractSnippet(post.rawBody, query),
    type: contentType(post.url),
    ...(post.date ? { date: post.date.toISOString() } : {}),
  }));
}
