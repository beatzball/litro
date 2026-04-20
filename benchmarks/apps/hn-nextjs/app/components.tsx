import type { HNStory } from '../../hn-shared/types';
import { timeAgo, hostName } from '../../hn-shared/api';
import type { CommentTree } from '../../hn-shared/types';

export function HnHeader() {
  return (
    <header className="hn-header">
      <div className="hn-header-inner">
        <a className="hn-logo" href="/">Y</a>
        <nav className="hn-nav">
          <a href="/">top</a>
          <span className="hn-nav-sep">|</span>
          <a href="/ask">ask</a>
          <span className="hn-nav-sep">|</span>
          <a href="/show">show</a>
        </nav>
      </div>
    </header>
  );
}

export function StoryItem({ story, rank }: { story: HNStory; rank: number }) {
  const host = hostName(story.url);
  return (
    <li className="story-item">
      <div className="story-title">
        <span className="story-rank">{rank}.</span>
        <span className="upvote" />
        <a href={story.url ?? `/story/${story.id}`}>{story.title}</a>
        {host && <span className="story-domain">({host})</span>}
      </div>
      <div className="story-meta">
        {story.score} points by{' '}
        <a href={`/user/${story.by}`}>{story.by}</a>{' '}
        {timeAgo(story.time)} |{' '}
        <a href={`/story/${story.id}`}>
          {story.descendants ?? 0} comments
        </a>
      </div>
    </li>
  );
}

export function StoryList({ stories }: { stories: HNStory[] }) {
  return (
    <ol className="story-list">
      {stories.map((story, i) => (
        <StoryItem key={story.id} story={story} rank={i + 1} />
      ))}
    </ol>
  );
}

export function CommentNode({
  comment,
  depth = 0,
}: {
  comment: CommentTree;
  depth?: number;
}) {
  const indentClass = `comment-indent-${Math.min(depth, 2)}`;
  return (
    <li className={`comment ${indentClass}`}>
      <div className="comment-meta">
        <a href={`/user/${comment.by}`}>{comment.by}</a>{' '}
        {timeAgo(comment.time)}
      </div>
      <div
        className="comment-text"
        dangerouslySetInnerHTML={{ __html: comment.text ?? '' }}
      />
      {comment.children?.length > 0 && (
        <ul className="comment-tree">
          {comment.children.map((child) => (
            <CommentNode key={child.id} comment={child} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}
