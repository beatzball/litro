import { timeAgo } from '../hn-shared/api.js';
import type { CommentTree } from '../hn-shared/types.js';

export function renderComment(comment: CommentTree, depth: number): string {
  const indent = Math.min(depth, 2);
  const childrenHtml = (comment.children ?? [])
    .map(child => renderComment(child, depth + 1))
    .join('');
  return `
    <div class="comment comment-indent-${indent}">
      <div class="comment-meta">
        <a href="/user/${comment.by}">${comment.by}</a>
        ${timeAgo(comment.time)}
      </div>
      <div class="comment-text">${comment.text ?? ''}</div>
      ${childrenHtml}
    </div>
  `;
}

export function renderComments(comments: CommentTree[]): string {
  return comments.map(c => renderComment(c, 0)).join('');
}
