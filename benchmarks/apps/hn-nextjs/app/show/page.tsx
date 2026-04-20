import { fetchShowStories, fetchStories } from '../../../hn-shared/api';
import { HnHeader, StoryList } from '../components';

export default async function ShowPage() {
  const ids = await fetchShowStories(30);
  const stories = await fetchStories(ids);
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
