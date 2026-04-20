import { fetchAskStories, fetchStories } from '../../../hn-shared/api';
import { HnHeader, StoryList } from '../components';

export default async function AskPage() {
  const ids = await fetchAskStories(30);
  const stories = await fetchStories(ids);
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
