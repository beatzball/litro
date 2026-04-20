import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { LitroPage } from '@beatzball/litro/runtime';
import { definePageData } from '@beatzball/litro';
import { fetchStoryWithComments, fetchStory, timeAgo, hostName } from '../../../hn-shared/api.js';
import { topStoryIds, askStoryIds, showStoryIds } from '../../../hn-shared/fixture-ids.js';
import type { HNStory, CommentTree } from '../../../hn-shared/types.js';

interface StoryPageData {
  story: HNStory | null;
  comments: CommentTree[];
}

export const pageData = definePageData(async (event) => {
  const id = Number(event.context.params?.id);
  const result = await fetchStoryWithComments(id, 2);
  if (!result) return { story: null, comments: [] };
  return { story: result.story, comments: result.comments } satisfies StoryPageData;
});

export async function generateRoutes(): Promise<string[]> {
  const allIds = [...new Set([...topStoryIds, ...askStoryIds, ...showStoryIds])];
  return allIds.map(id => `/story/${id}`);
}

@customElement('page-story-id')
export class StoryPage extends LitroPage {
  static override properties = { serverData: { state: true } };

  render() {
    const data = this.serverData as StoryPageData | null;
    if (!data) return html`<div class="hn-loading">Loading...</div>`;

    const { story, comments } = data;
    if (!story) return html`<div class="hn-empty">Story not found</div>`;
    const domain = hostName(story.url);

    return html`
      <link rel="stylesheet" href="/hn.css">
      <header class="hn-header">
        <div class="hn-header-inner">
          <a class="hn-logo" href="/">Y</a>
          <nav class="hn-nav">
            <a href="/">top</a>
            <span class="hn-nav-sep">|</span>
            <a href="/ask">ask</a>
            <span class="hn-nav-sep">|</span>
            <a href="/show">show</a>
          </nav>
        </div>
      </header>
      <main class="hn-main">
        <div class="story-detail">
          <span class="upvote"></span>
          <span class="story-title">
            <a href="${story.url ?? '#'}">${story.title}</a>
            ${domain ? html`<span class="story-domain">(${domain})</span>` : ''}
          </span>
          <div class="story-meta">
            ${story.score} points by
            <a href="/user/${story.by}">${story.by}</a>
            ${timeAgo(story.time)}
            | ${story.descendants ?? 0} comments
          </div>
          ${story.text ? html`<div class="story-text">${unsafeHTML(story.text)}</div>` : ''}
        </div>
        <div class="comment-section">
          ${comments.map(c => this._commentNode(c, 0))}
        </div>
      </main>
    `;
  }

  private _commentNode(comment: CommentTree, depth: number): unknown {
    return html`
      <div class="comment comment-indent-${Math.min(depth, 2)}">
        <div class="comment-meta">
          <a href="/user/${comment.by}">${comment.by}</a>
          ${timeAgo(comment.time)}
        </div>
        <div class="comment-text">${unsafeHTML(comment.text ?? '')}</div>
        ${comment.children?.map(child => this._commentNode(child, depth + 1))}
      </div>
    `;
  }
}

export default StoryPage;
