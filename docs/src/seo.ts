const siteUrl = (process.env.SITE_URL ?? 'https://litro.dev').replace(/\/$/, '');

export interface SeoOptions {
  title: string;
  description: string;
  path: string;
  type?: 'website' | 'article';
}

export function buildSeoHead(options: SeoOptions): string {
  const { title, description, path, type = 'website' } = options;
  const url = `${siteUrl}${path}`;

  return [
    `<meta name="description" content="${escapeAttr(description)}" />`,
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:title" content="${escapeAttr(title)}" />`,
    `<meta property="og:description" content="${escapeAttr(description)}" />`,
    `<meta property="og:type" content="${type}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${siteUrl}/og-default.png" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeAttr(title)}" />`,
    `<meta name="twitter:description" content="${escapeAttr(description)}" />`,
    `<link rel="sitemap" type="application/xml" href="/sitemap.xml" />`,
  ].join('\n');
}

function escapeAttr(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
