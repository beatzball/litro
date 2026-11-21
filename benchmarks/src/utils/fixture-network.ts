/** A fixture comparison must not include live Hacker News data or network latency. */
export function assertNoLiveHnRequests(urls: readonly string[]): void {
  const live = urls.find(url => new URL(url).hostname === 'hacker-news.firebaseio.com');
  if (live) throw new Error('Lighthouse requested the live Hacker News API; use prerendered fixture data during hydration');
}
