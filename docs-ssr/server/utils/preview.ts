import type { H3Event } from 'h3';
import type { Post, GetPostsOptions } from 'litro:content';
import { getPosts } from 'litro:content';

/** Check if the current request is in preview mode. */
export function isPreview(event: H3Event): boolean {
  return event.context.preview === true;
}

/**
 * Fetch posts with preview-aware draft filtering.
 * In preview mode, draft posts are included.
 */
export async function previewPosts(
  event: H3Event,
  options?: GetPostsOptions,
): Promise<Post[]> {
  return getPosts({
    ...options,
    includeDrafts: isPreview(event),
  });
}
