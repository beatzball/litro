import { defineConfig } from 'vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { topStoryIds, askStoryIds, showStoryIds, userIds } from '../hn-shared/fixture-ids.ts';

const storyIds = [...new Set([...topStoryIds, ...askStoryIds, ...showStoryIds])];
const paths = [
  '/', '/ask', '/show',
  ...storyIds.map((id) => `/story/${id}`),
  ...userIds.map((id) => `/user/${id}`),
];

export default defineConfig({
  plugins: [
    tanstackStart({
      prerender: {
        enabled: true,
        autoStaticPathsDiscovery: false,
        crawlLinks: false,
        failOnError: true,
      },
      pages: paths.map((path) => ({ path })),
    }),
    viteReact(),
  ],
});
