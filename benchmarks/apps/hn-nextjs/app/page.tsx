import { fetchTopStories, fetchStories } from '../../hn-shared/api';
import { HnHeader, StoryList } from './components';

export default async function Home() {
  const ids = await fetchTopStories(30);
  const stories = await fetchStories(ids);
  return (
    <>
      <HnHeader />
      <main className="hn-main">
        <StoryList stories={stories} />
      </main>
    </>
  );
}
