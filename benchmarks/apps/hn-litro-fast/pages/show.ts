import { FASTElement, Observable, html, css, repeat } from '@microsoft/fast-element';
import { LitroPage } from '@beatzball/litro/adapter/fast/page';
import { definePageData } from '@beatzball/litro/runtime/page-data.js';
import { fetchShowStories, fetchStories, timeAgo, hostName } from '../../hn-shared/api.js';
import type { HNStory } from '../../hn-shared/types.js';

interface ShowPageData {
  stories: HNStory[];
}

export const pageData = definePageData(async () => {
  const ids = await fetchShowStories(30);
  const stories = await fetchStories(ids);
  return { stories } satisfies ShowPageData;
});

export class ShowPage extends LitroPage {}
Observable.defineProperty(ShowPage.prototype, 'serverData');

function storyUrl(story: HNStory): string {
  return story.url ?? `/story/${story.id}`;
}

ShowPage.define({
  name: 'page-show',
  template: html<ShowPage>`
    <link rel="stylesheet" href="/hn.css">
    ${x => x.serverData === null
      ? html`<div class="hn-loading">Loading...</div>`
      : html<ShowPage>`
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
          <ol class="story-list">
            ${repeat(x => x.serverData?.stories ?? [], html<HNStory, ShowPage>`
              <li class="story-item">
                <span class="story-rank">${(story, c) => (c.index + 1) + '.'}</span>
                <span class="upvote"></span>
                <span class="story-title">
                  <a href="${story => storyUrl(story)}">${story => story.title}</a>
                  ${story => story.url ? html`<span class="story-domain">(${hostName(story.url)})</span>` : ''}
                </span>
                <div class="story-meta">
                  ${story => story.score} points by
                  <a href="${story => `/user/${story.by}`}">${story => story.by}</a>
                  ${story => timeAgo(story.time)}
                  | <a href="${story => `/story/${story.id}`}">${story => (story.descendants ?? 0) + ' comments'}</a>
                </div>
              </li>
            `)}
          </ol>
        </main>
      `}
  `,
});

export default ShowPage;
