import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { LitroPage } from '@beatzball/litro/runtime';
import { definePageData } from '@beatzball/litro';
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

@customElement('page-home')
export class HomePage extends LitroPage {
  static override properties = { serverData: { state: true } };

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
          ${data.stories.map((story, i) => this._storyItem(story, i + 1))}
        </ol>
      </main>
    `;
  }

  private _storyItem(story: HNStory, rank: number) {
    const domain = hostName(story.url);
    return html`
      <li class="story-item">
        <span class="story-rank">${rank}.</span>
        <span class="upvote"></span>
        <span class="story-title">
          <a href="${story.url ?? `/story/${story.id}`}">${story.title}</a>
          ${domain ? html`<span class="story-domain">(${domain})</span>` : ''}
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
}

export default HomePage;
