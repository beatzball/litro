import { defineEventHandler, setResponseHeader } from 'h3';
import { getPosts } from 'litro:content';

const SITE_URL = (process.env.SITE_URL ?? 'https://litro.dev').replace(/\/$/, '');

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'content-type', 'application/rss+xml; charset=utf-8');

  const allPosts = await getPosts();
  const blogPosts = allPosts
    .filter(p => p.url.startsWith('/content/blog/'))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const items = blogPosts.map(post => {
    const slug = post.url.slice('/content/blog/'.length);
    const link = `${SITE_URL}/blog/${slug}`;
    const pubDate = new Date(post.date).toUTCString();
    const description = (post as typeof post & { description?: string }).description ?? '';
    return `
    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <description>${escapeXml(description)}</description>
      <pubDate>${pubDate}</pubDate>
    </item>`;
  });

  const lastBuildDate = blogPosts.length > 0
    ? new Date(blogPosts[0].date).toUTCString()
    : new Date().toUTCString();

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Litro Blog</title>
    <link>${SITE_URL}/blog</link>
    <description>Technical articles on web components, SSR, and standards-based development from the Litro team.</description>
    <language>en</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${SITE_URL}/blog/rss.xml" rel="self" type="application/rss+xml" />${items.join('')}
  </channel>
</rss>`;
});
