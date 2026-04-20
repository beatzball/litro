import { topStoryIds, askStoryIds, showStoryIds, userIds } from '../hn-shared/fixture-ids';

const allStoryIds = [...new Set([...topStoryIds, ...askStoryIds, ...showStoryIds])];

export default defineNuxtConfig({
  nitro: {
    prerender: {
      crawlLinks: false,
      routes: [
        '/', '/ask', '/show',
        ...allStoryIds.map(id => `/story/${id}`),
        ...userIds.map(id => `/user/${id}`),
      ],
    },
  },
  css: ['~/assets/hn.css'],
  compatibilityDate: '2025-01-01',
});
