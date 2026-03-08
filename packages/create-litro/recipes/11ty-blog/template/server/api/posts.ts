import { defineEventHandler, getQuery } from 'h3';
import { getPosts } from 'litro:content';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const tag = typeof query.tag === 'string' ? query.tag : undefined;
  return getPosts({ tag });
});
