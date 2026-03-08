/**
 * Ambient TypeScript declarations for the `litro:content` virtual module.
 *
 * Add to your project's tsconfig.json `compilerOptions.types` or include this
 * file directly:
 *
 *   /// <reference types="litro/content/env" />
 *
 * Or add to tsconfig.json:
 *   { "include": ["node_modules/litro/src/content/env.d.ts"] }
 *
 * With this declaration, TypeScript resolves:
 *   import { getPosts, Post } from 'litro:content';
 */

declare module 'litro:content' {
  export interface Post {
    slug: string;
    title: string;
    date: Date;
    description?: string;
    tags: string[];
    draft: boolean;
    body: string;
    rawBody: string;
    url: string;
    frontmatter: Record<string, unknown>;
  }

  export interface GetPostsOptions {
    tag?: string;
    limit?: number;
    includeDrafts?: boolean;
  }

  export function getPosts(options?: GetPostsOptions): Promise<Post[]>;
  export function getPost(slug: string): Promise<Post | null>;
  export function getTags(): Promise<string[]>;
  export function getGlobalData(): Promise<Record<string, unknown>>;
}
