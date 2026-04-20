import type { HNStory, HNComment, HNItem, HNUser, CommentTree } from './types.js';

function getBase(): string {
  return process.env.HN_API_BASE ?? 'https://hacker-news.firebaseio.com/v0';
}

async function fetchJson<T>(path: string): Promise<T | null> {
  const res = await fetch(`${getBase()}/${path}`);
  if (!res.ok) return null;
  const text = await res.text();
  if (!text || text === 'null') return null;
  return JSON.parse(text) as T;
}

export async function fetchTopStories(limit = 30): Promise<number[]> {
  const ids = await fetchJson<number[]>('topstories.json');
  return (ids ?? []).slice(0, limit);
}

export async function fetchAskStories(limit = 30): Promise<number[]> {
  const ids = await fetchJson<number[]>('askstories.json');
  return (ids ?? []).slice(0, limit);
}

export async function fetchShowStories(limit = 30): Promise<number[]> {
  const ids = await fetchJson<number[]>('showstories.json');
  return (ids ?? []).slice(0, limit);
}

export async function fetchItem(id: number): Promise<HNItem | null> {
  return fetchJson<HNItem>(`item/${id}.json`);
}

export async function fetchStory(id: number): Promise<HNStory | null> {
  return fetchJson<HNStory>(`item/${id}.json`);
}

export async function fetchUser(id: string): Promise<HNUser | null> {
  return fetchJson<HNUser>(`user/${id}.json`);
}

export async function fetchStories(ids: number[]): Promise<HNStory[]> {
  const results = await Promise.all(ids.map(id => fetchItem(id)));
  return results.filter((item): item is HNStory => item != null && item.type === 'story');
}

export async function fetchCommentTree(id: number, depth = 2): Promise<CommentTree | null> {
  if (depth <= 0) return null;
  try {
    const item = await fetchItem(id) as HNComment;
    if (!item || item.deleted || item.dead) return null;
    const children: CommentTree[] = [];
    if (item.kids?.length && depth > 1) {
      const childResults = await Promise.all(
        item.kids.slice(0, 20).map(kid => fetchCommentTree(kid, depth - 1)),
      );
      for (const child of childResults) {
        if (child) children.push(child);
      }
    }
    return { ...item, children };
  } catch {
    return null;
  }
}

export async function fetchStoryWithComments(
  id: number,
  commentDepth = 2,
): Promise<{ story: HNStory; comments: CommentTree[] } | null> {
  const story = await fetchStory(id);
  if (!story) return null;
  const comments: CommentTree[] = [];
  if (story.kids?.length) {
    const results = await Promise.all(
      story.kids.slice(0, 30).map(kid => fetchCommentTree(kid, commentDepth)),
    );
    for (const comment of results) {
      if (comment) comments.push(comment);
    }
  }
  return { story, comments };
}

export function timeAgo(unixTime: number): string {
  const seconds = Math.floor(Date.now() / 1000) - unixTime;
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function hostName(url?: string): string {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}
