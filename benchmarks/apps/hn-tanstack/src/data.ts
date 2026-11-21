import { createServerFn } from '@tanstack/react-start';
import {
  fetchTopStories, fetchAskStories, fetchShowStories, fetchStories,
  fetchStoryWithComments, fetchUser,
} from '../../hn-shared/api';

export const getTopStories = createServerFn({ method: 'GET' }).handler(async () =>
  fetchStories(await fetchTopStories(30)),
);
export const getAskStories = createServerFn({ method: 'GET' }).handler(async () =>
  fetchStories(await fetchAskStories(30)),
);
export const getShowStories = createServerFn({ method: 'GET' }).handler(async () =>
  fetchStories(await fetchShowStories(30)),
);
export const getStory = createServerFn({ method: 'GET' })
  .validator((id: number) => id)
  .handler(({ data }) => fetchStoryWithComments(data));
export const getUser = createServerFn({ method: 'GET' })
  .validator((id: string) => id)
  .handler(({ data }) => fetchUser(data));
