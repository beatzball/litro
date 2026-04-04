const siteUrl = (process.env.SITE_URL ?? 'https://litro.dev').replace(/\/$/, '');

export interface SeoOptions {
  title: string;
  description: string;
  path: string;
  type?: 'website' | 'article';
  image?: string;
  siteName?: string;
}

export function buildSeoHead(options: SeoOptions): string {
  const { title, description, path, type = 'website', image, siteName = 'Litro' } = options;
  const url = `${siteUrl}${path}`;
  const ogImageUrl = image ?? `${siteUrl}/__og${path === '/' ? '/index' : path}.png`;

  return [
    `<meta name="description" content="${escapeAttr(description)}" />`,
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:title" content="${escapeAttr(title)}" />`,
    `<meta property="og:description" content="${escapeAttr(description)}" />`,
    `<meta property="og:type" content="${type}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${ogImageUrl}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:site_name" content="${escapeAttr(siteName)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeAttr(title)}" />`,
    `<meta name="twitter:description" content="${escapeAttr(description)}" />`,
    `<meta name="twitter:image" content="${ogImageUrl}" />`,
    `<link rel="sitemap" type="application/xml" href="/sitemap.xml" />`,
  ].join('\n');
}

export function buildJsonLd(data: object): string {
  return `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
}

function escapeAttr(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
