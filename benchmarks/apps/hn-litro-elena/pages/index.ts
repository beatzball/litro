import { html, unsafeHTML } from '@elenajs/core';
import { LitroPage } from '@beatzball/litro/adapter/elena/page';
import { definePageData } from '@beatzball/litro/runtime/page-data.js';
import { fetchTopStories, fetchStories, timeAgo, hostName } from '../../hn-shared/api.js';
import type { HNStory } from '../../hn-shared/types.js';

interface TopPageData {
  stories: HNStory[];
}

export const pageData = definePageData(async () => {
  const ids = await fetchTopStories(30);
  const stories = await fetchStories(ids);
  return { stories } satisfies TopPageData;
});

function storyItem(story: HNStory, rank: number): string {
  const domain = hostName(story.url);
  return `
    <li class="story-item">
      <span class="story-rank">${rank}.</span>
      <span class="upvote"></span>
      <span class="story-title">
        <a href="${story.url ?? `/story/${story.id}`}">${story.title}</a>
        ${domain ? `<span class="story-domain">(${domain})</span>` : ''}
      </span>
      <div class="story-meta">
        ${story.score} points by
        <a href="/user/${story.by}">${story.by}</a>
        ${timeAgo(story.time)}
        | <a href="/story/${story.id}">${story.descendants ?? 0} comments</a>
      </div>
    </li>
  `;
}

export class HomePage extends LitroPage {
  static override tagName = 'page-home';

  render() {
    const data = this.serverData as TopPageData | null;
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
          ${unsafeHTML(data.stories.map((story, i) => storyItem(story, i + 1)).join(''))}
        </ol>
      </main>
    `;
  }
}

HomePage.define();

export default HomePage;
