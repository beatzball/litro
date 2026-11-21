import { createFileRoute } from '@tanstack/react-router';
import { getAskStories } from '../data';
import { HnHeader, StoryList } from '../components';

export const Route = createFileRoute('/ask')({
  loader: () => getAskStories(),
  component: StoryListPage,
});

function StoryListPage() {
  const stories = Route.useLoaderData();
  return (
    <>
      <HnHeader />
      <main className="hn-main">
        <h2>Ask HN</h2>
        <StoryList stories={stories} />
      </main>
    </>
  );
}
