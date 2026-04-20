import { FASTElement, Observable, html, css, repeat } from '@microsoft/fast-element';
import { LitroPage } from '@beatzball/litro/adapter/fast/page';
import { definePageData } from '@beatzball/litro/runtime/page-data.js';
import { fetchAskStories, fetchStories, timeAgo } from '../../hn-shared/api.js';
import type { HNStory } from '../../hn-shared/types.js';

interface AskPageData {
  stories: HNStory[];
}

export const pageData = definePageData(async () => {
  const ids = await fetchAskStories(30);
  const stories = await fetchStories(ids);
  return { stories } satisfies AskPageData;
});

export class AskPage extends LitroPage {}
Observable.defineProperty(AskPage.prototype, 'serverData');

AskPage.define({
  name: 'page-ask',
  template: html<AskPage>`
    <link rel="stylesheet" href="/hn.css">
    ${x => x.serverData === null
      ? html`<div class="hn-loading">Loading...</div>`
      : html<AskPage>`
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
            ${repeat(x => x.serverData?.stories ?? [], html<HNStory, AskPage>`
              <li class="story-item">
                <span class="story-rank">${(story, c) => (c.index + 1) + '.'}</span>
                <span class="upvote"></span>
                <span class="story-title">
                  <a href="${story => `/story/${story.id}`}">${story => story.title}</a>
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

export default AskPage;
