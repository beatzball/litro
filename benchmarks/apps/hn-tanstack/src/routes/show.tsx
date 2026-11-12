import { createFileRoute } from '@tanstack/react-router';
import { getShowStories } from '../data';
import { HnHeader, StoryList } from '../components';

export const Route = createFileRoute('/show')({
  loader: () => getShowStories(),
  component: StoryListPage,
});

function StoryListPage() {
  const stories = Route.useLoaderData();
  return (
    <>
      <HnHeader />
      <main className="hn-main">
        <h2>Show HN</h2>
        <StoryList stories={stories} />
      </main>
    </>
  );
}
