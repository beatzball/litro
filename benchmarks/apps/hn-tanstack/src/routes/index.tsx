import { createFileRoute } from '@tanstack/react-router';
import { getTopStories } from '../data';
import { HnHeader, StoryList } from '../components';

export const Route = createFileRoute('/')({
  loader: () => getTopStories(),
  component: StoryListPage,
});

function StoryListPage() {
  const stories = Route.useLoaderData();
  return (
    <>
      <HnHeader />
      <main className="hn-main">

        <StoryList stories={stories} />
      </main>
    </>
  );
}
