import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { renderComments } from './render-comments.js';
import type { HNStory, CommentTree } from '../hn-shared/types.js';

// FAST's prerender engine does not evaluate `:innerHTML` bindings, so the
// static HTML emitted for /story/* pages contains empty `<div class="comment-section">`
// and `<div class="story-text">` elements. This script fills them by reading the
// page's serialized `__litro_data__` JSON and rendering the same markup the
// client would produce at hydration time. Run as a Nitro `compiled` hook.

interface StoryPageData {
  story: HNStory | null;
  comments: CommentTree[];
}

const DATA_RE = /<script type="application\/json" id="__litro_data__"[^>]*>([\s\S]*?)<\/script>/;
const COMMENT_MARKER = '<div class="comment-section" ></div>';
const STORY_TEXT_MARKER = '<div class="story-text" ></div>';

export async function fillInnerHTMLBindings(staticDir: string): Promise<void> {
  const storyDir = resolve(staticDir, 'story');
  let entries: string[];
  try {
    entries = await readdir(storyDir);
  } catch {
    return;
  }

  let filled = 0;
  for (const entry of entries) {
    const filePath = join(storyDir, entry, 'index.html');
    try {
      const s = await stat(filePath);
      if (!s.isFile()) continue;
    } catch {
      continue;
    }

    const html = await readFile(filePath, 'utf-8');
    const match = DATA_RE.exec(html);
    if (!match) continue;

    let data: StoryPageData;
    try {
      data = JSON.parse(match[1]) as StoryPageData;
    } catch {
      continue;
    }
    if (!data.story) continue;

    let updated = html;
    if (data.comments?.length) {
      const commentsHtml = renderComments(data.comments);
      updated = updated.replace(
        COMMENT_MARKER,
        `<div class="comment-section">${commentsHtml}</div>`,
      );
    }
    if (data.story.text) {
      updated = updated.replace(
        STORY_TEXT_MARKER,
        `<div class="story-text">${data.story.text}</div>`,
      );
    }
    if (updated !== html) {
      await writeFile(filePath, updated, 'utf-8');
      filled++;
    }
  }

  if (filled > 0) {
    // eslint-disable-next-line no-console
    console.log(`[hn-litro-fast] filled :innerHTML on ${filled} story pages`);
  }
}
