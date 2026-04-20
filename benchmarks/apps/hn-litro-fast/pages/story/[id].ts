import { FASTElement, Observable, html, css } from '@microsoft/fast-element';
import { LitroPage } from '@beatzball/litro/adapter/fast/page';
import { definePageData } from '@beatzball/litro/runtime/page-data.js';
import { fetchStoryWithComments, timeAgo, hostName } from '../../../hn-shared/api.js';
import { topStoryIds, askStoryIds, showStoryIds } from '../../../hn-shared/fixture-ids.js';
import { renderComments } from '../../render-comments.js';
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

export class StoryPage extends LitroPage {}
Observable.defineProperty(StoryPage.prototype, 'serverData');

StoryPage.define({
  name: 'page-story-id',
  template: html<StoryPage>`
    <link rel="stylesheet" href="/hn.css">
    ${x => {
      const data = x.serverData;
      if (!data) return html`<div class="hn-loading">Loading...</div>`;
      const story = data.story;
      if (!story) return html`<div class="hn-empty">Story not found</div>`;
      const domain = hostName(story.url);
      const commentsHtml = renderComments(data.comments);
      return html`
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
              <a href="${`/user/${story.by}`}">${story.by}</a>
              ${timeAgo(story.time)}
              | ${(story.descendants ?? 0) + ' comments'}
            </div>
            ${story.text ? html`<div class="story-text" :innerHTML="${story.text}"></div>` : ''}
          </div>
          <div class="comment-section" :innerHTML="${commentsHtml}"></div>
        </main>
      `;
    }}
  `,
});

export default StoryPage;
