import { defineEventHandler, getQuery } from 'h3';
import { searchContent } from '../../utils/search.js';
import type { SearchOptions } from '../../utils/search.js';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const q = typeof query.q === 'string' ? query.q : '';
  const type = (query.type === 'blog' || query.type === 'docs') ? query.type : 'all';
  const limit = typeof query.limit === 'string' ? Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 50) : 20;

  const results = await searchContent(q, event, { type, limit } as SearchOptions);
  return { query: q, results };
});
