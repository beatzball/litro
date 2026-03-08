export interface Post {
  slug: string;
  title: string;
  date: Date;
  description?: string;
  tags: string[];
  draft: boolean;
  body: string;                            // rendered HTML
  rawBody: string;                         // raw Markdown source
  url: string;                             // resolved URL path, e.g. /blog/hello-world
  frontmatter: Record<string, unknown>;    // full parsed frontmatter, pass-through
}

export interface GetPostsOptions {
  tag?: string;
  limit?: number;
  includeDrafts?: boolean;                 // default false; true in dev mode
}

// This is what `litro:content` exports
export interface ContentAPI {
  getPosts(options?: GetPostsOptions): Promise<Post[]>;
  getPost(slug: string): Promise<Post | null>;
  getTags(): Promise<string[]>;
  getGlobalData(): Promise<Record<string, unknown>>;
}
