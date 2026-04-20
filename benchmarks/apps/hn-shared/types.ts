export interface HNStory {
  id: number;
  title: string;
  url?: string;
  text?: string;
  by: string;
  time: number;
  score: number;
  descendants: number;
  kids?: number[];
  type: 'story' | 'job' | 'poll';
}

export interface HNComment {
  id: number;
  by: string;
  text: string;
  time: number;
  kids?: number[];
  parent: number;
  type: 'comment';
  deleted?: boolean;
  dead?: boolean;
}

export interface HNUser {
  id: string;
  created: number;
  karma: number;
  about?: string;
  submitted?: number[];
}

export type HNItem = HNStory | HNComment;

export interface StoryWithComments extends HNStory {
  comments: CommentTree[];
}

export interface CommentTree extends HNComment {
  children: CommentTree[];
}
