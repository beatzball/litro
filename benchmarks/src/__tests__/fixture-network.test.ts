import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertNoLiveHnRequests } from '../utils/fixture-network.js';

test('a fixture audit rejects live HN requests while allowing extracted static payloads', () => {
  assert.doesNotThrow(() => assertNoLiveHnRequests([
    'http://localhost:4014/story/47760529',
    'http://localhost:4014/story/47760529/_payload.json',
    'http://localhost:4014/_nuxt/app.js',
  ]));
  assert.throws(() => assertNoLiveHnRequests([
    'http://localhost:4014/',
    'https://hacker-news.firebaseio.com/v0/topstories.json',
  ]), /live Hacker News API/);
});
