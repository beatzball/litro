import { fetchStoryWithComments, timeAgo, hostName } from '../../../../hn-shared/api';
import { topStoryIds, askStoryIds, showStoryIds } from '../../../../hn-shared/fixture-ids';
import { HnHeader, CommentNode } from '../../components';

export async function generateStaticParams() {
  const allIds = new Set([...topStoryIds, ...askStoryIds, ...showStoryIds]);
  return Array.from(allIds).map((id) => ({ id: String(id) }));
}

export default async function StoryPage({
  params,
}: {
  params: { id: string };
}) {
  const result = await fetchStoryWithComments(Number(params.id));
  if (!result) {
    return (
      <>
        <HnHeader />
        <main className="hn-main">
          <div className="hn-empty">Story not found.</div>
        </main>
      </>
    );
  }
  const { story, comments } = result;
  const host = hostName(story.url);

  return (
    <>
      <HnHeader />
      <main className="hn-main">
        <div className="story-detail">
          <div className="story-title">
            <span className="upvote" />
            <a href={story.url ?? '#'}>{story.title}</a>
            {host && <span className="story-domain">({host})</span>}
          </div>
          <div className="story-meta">
            {story.score} points by{' '}
            <a href={`/user/${story.by}`}>{story.by}</a>{' '}
            {timeAgo(story.time)} | {story.descendants ?? 0} comments
          </div>
          {story.text && (
            <div
              className="story-text"
              dangerouslySetInnerHTML={{ __html: story.text }}
            />
          )}
        </div>
        <div className="comment-section">
          {comments.length > 0 ? (
            <ul className="comment-tree">
              {comments.map((c) => (
                <CommentNode key={c.id} comment={c} depth={0} />
              ))}
            </ul>
          ) : (
            <div className="hn-empty">No comments yet.</div>
          )}
        </div>
      </main>
    </>
  );
}
