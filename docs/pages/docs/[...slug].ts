import { html } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { customElement } from 'lit/decorators.js';
import { LitroPage } from '@beatzball/litro/runtime';
import { definePageData } from '@beatzball/litro';
import { createError } from 'h3';
import type { Post } from 'litro:content';
import { getPosts } from 'litro:content';
import { siteConfig } from '../../server/starlight.config.js';
import { extractHeadings, addHeadingIds } from '../../src/extract-headings.js';
import { starlightHead } from '../../src/route-meta.js';
import { buildSeoHead } from '../../src/seo.js';

// Register components used in render()
import '../../src/components/starlight-page.js';

export interface DocPageData {
  doc: Post;
  body: string;
  toc: Array<{ depth: number; text: string; slug: string }>;
  sidebar: typeof siteConfig.sidebar;
  siteTitle: string;
  currentSlug: string;
  prevDoc: { label: string; href: string } | null;
  nextDoc: { label: string; href: string } | null;
  nav: typeof siteConfig.nav;
  editUrl: string | null;
  seoHead: string;
}

function computePrevNext(
  sidebar: typeof siteConfig.sidebar,
  currentSlug: string,
): { prevDoc: DocPageData['prevDoc']; nextDoc: DocPageData['nextDoc'] } {
  const flat = sidebar.flatMap(g => g.items);
  const idx = flat.findIndex(item => item.slug === currentSlug);
  return {
    prevDoc: idx > 0
      ? { label: flat[idx - 1].label, href: `/docs/${flat[idx - 1].slug}` }
      : null,
    nextDoc: idx < flat.length - 1
      ? { label: flat[idx + 1].label, href: `/docs/${flat[idx + 1].slug}` }
      : null,
  };
}

export const pageData = definePageData(async (event) => {
  const slug = event.context.params?.slug ?? '';

  const posts = await getPosts();
  const doc = posts.find(p => p.url === `/content/docs/${slug}`);

  if (!doc) {
    throw createError({ statusCode: 404, message: `Doc not found: ${slug}` });
  }

  const toc = extractHeadings(doc.rawBody);
  // Strip the first <h1> from the HTML body — starlight-page renders the
  // page title from the frontmatter `title` field as its own styled <h1>.
  // Keeping the Markdown's leading # heading would produce duplicate <h1>s.
  const body = addHeadingIds(doc.body).replace(/^<h1[^>]*>.*?<\/h1>\s*/is, '');
  const { prevDoc, nextDoc } = computePrevNext(siteConfig.sidebar, slug);
  const editUrl = siteConfig.editUrlBase
    ? `${siteConfig.editUrlBase}/content/docs/${slug}.md`
    : null;

  const seoHead = buildSeoHead({
    title: `${doc.title} — Litro`,
    description: (doc as Post & { description?: string }).description ?? siteConfig.description,
    path: `/docs/${slug}`,
    type: 'article',
  });

  return {
    doc,
    body,
    toc,
    sidebar: siteConfig.sidebar,
    siteTitle: siteConfig.title,
    currentSlug: slug,
    prevDoc,
    nextDoc,
    nav: siteConfig.nav,
    editUrl,
    seoHead,
  } satisfies DocPageData;
});

export async function generateRoutes(): Promise<string[]> {
  const posts = await getPosts();
  return posts
    .filter(p => p.url.startsWith('/content/docs/'))
    .map(p => '/docs' + p.url.slice('/content/docs'.length));
}

export const routeMeta = {
  head: starlightHead,
  title: 'Docs — Litro',
};

@customElement('page-docs-slug')
export class DocPage extends LitroPage {
  override render() {
    const data = this.serverData as DocPageData | null;
    if (!data?.doc) return html`<p>Loading&hellip;</p>`;

    return html`
      <starlight-page
        siteTitle="${data.siteTitle}"
        pageTitle="${data.doc.title}"
        .nav="${data.nav}"
        .sidebar="${data.sidebar}"
        .toc="${data.toc}"
        currentSlug="${data.currentSlug}"
        currentPath="/docs/${data.currentSlug}"
      >
        <div slot="content">
          ${unsafeHTML(data.body)}

          ${data.prevDoc || data.nextDoc ? html`
            <nav style="
              display:flex;
              justify-content:space-between;
              padding-top:2rem;
              margin-top:2rem;
              border-top:1px solid var(--sl-color-border);
              font-size:var(--sl-text-sm);
            " aria-label="Previous and next pages">
              ${data.prevDoc ? html`
                <a href="${data.prevDoc.href}" style="color:var(--sl-color-accent);text-decoration:none;">
                  &larr; ${data.prevDoc.label}
                </a>
              ` : html`<span></span>`}
              ${data.nextDoc ? html`
                <a href="${data.nextDoc.href}" style="color:var(--sl-color-accent);text-decoration:none;">
                  ${data.nextDoc.label} &rarr;
                </a>
              ` : ''}
            </nav>
          ` : ''}

          ${data.editUrl ? html`
            <p style="margin-top:1.5rem;font-size:var(--sl-text-xs);color:var(--sl-color-gray-4);">
              <a href="${data.editUrl}" style="color:var(--sl-color-accent);" target="_blank" rel="noopener">
                Edit this page
              </a>
            </p>
          ` : ''}
        </div>
      </starlight-page>
    `;
  }
}

export default DocPage;
