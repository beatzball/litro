import { defineEventHandler, setResponseHeader } from 'h3';
import { getPosts } from 'litro:content';
import { routes } from '#litro/page-manifest';
import { ALL_PACKAGE_SLUGS } from '@beatzball/litro-docs-ui/src/packages.js';
import { renderSitemapXml } from '@beatzball/litro-docs-ui/src/sitemap.js';

const SITE_URL = (process.env.SITE_URL ?? 'https://litro.dev').replace(/\/$/, '');

// Nothing is listed by hand. `routes` is the page scanner's own view of
// pages/, and the content posts carry the rest, so a new page, a new doc or a
// new blog tag reaches the sitemap without anyone editing this file.
// See packages/docs-ui/src/sitemap.ts for the derivation.
export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'content-type', 'application/xml; charset=utf-8');

  return renderSitemapXml({
    siteUrl: SITE_URL,
    routes,
    posts: await getPosts(),
    packageSlugs: ALL_PACKAGE_SLUGS,
  });
});
