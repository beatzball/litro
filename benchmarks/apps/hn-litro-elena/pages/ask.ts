import { html, unsafeHTML } from '@elenajs/core';
import { LitroPage } from '@beatzball/litro/adapter/elena/page';
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

export class AskPage extends LitroPage {
  static override tagName = 'page-ask';

  render() {
    const data = this.serverData as AskPageData | null;
    if (!data) return html`<div class="hn-loading">Loading...</div>`;

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
        <ol class="story-list">
          ${unsafeHTML(data.stories.map((story, i) => `
            <li class="story-item">
              <span class="story-rank">${i + 1}.</span>
              <span class="upvote"></span>
              <span class="story-title">
                <a href="/story/${story.id}">${story.title}</a>
              </span>
              <div class="story-meta">
                ${story.score} points by
                <a href="/user/${story.by}">${story.by}</a>
                ${timeAgo(story.time)}
                | <a href="/story/${story.id}">${story.descendants ?? 0} comments</a>
              </div>
            </li>
          `).join(''))}
        </ol>
      </main>
    `;
  }
}

AskPage.define();

export default AskPage;
