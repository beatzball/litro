import { css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { LitroPage } from '@beatzball/litro/runtime';
import { definePageData } from '@beatzball/litro';
import { getPosts } from 'litro:content';
import { siteConfig } from '../../server/starlight.config.js';
import { starlightHead } from '@beatzball/litro-docs-ui/src/route-meta.js';
import { buildSeoHead, buildJsonLd } from '@beatzball/litro-docs-ui/src/seo.js';
import { docsIndexStyles } from '@beatzball/litro-docs-ui/src/docs-index-styles.js';
import { buildDocsIndexGroups, type DocsIndexGroup } from '@beatzball/litro-docs-ui/src/docs-index.js';

// Register components used in render()
import '@beatzball/litro-docs-ui/src/components/starlight-page.js';

export interface DocsIndexData {
  groups: DocsIndexGroup[];
  sidebar: typeof siteConfig.sidebar;
  nav: typeof siteConfig.nav;
  siteTitle: string;
  seoHead: string;
  seoTitle: string;
}

const DESCRIPTION =
  'Every Litro guide in one place — getting started, core concepts, adapters, recipes, deployment and package references.';

export const pageData = definePageData(async (_event) => {
  const posts = await getPosts();
  const groups = buildDocsIndexGroups(siteConfig.sidebar, posts);

  const seoTitle = 'Documentation — Litro';
  const seoHead = buildSeoHead({
    title: seoTitle,
    description: DESCRIPTION,
    path: '/docs',
    type: 'website',
  }) + buildJsonLd({
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    'name': 'Litro Documentation',
    'description': DESCRIPTION,
    'url': 'https://litro.dev/docs',
  });

  return {
    groups,
    sidebar: siteConfig.sidebar,
    nav: siteConfig.nav,
    siteTitle: siteConfig.title,
    seoHead,
    seoTitle,
  } satisfies DocsIndexData;
});

export const routeMeta = {
  head: starlightHead,
  title: 'Documentation — Litro',
};

@customElement('page-docs')
export class DocsIndexPage extends LitroPage {
  /**
   * Styles live in this page's shadow root so they reach the
   * <div slot="content"> subtree. Global stylesheets cannot pierce it.
   */
  static override styles = docsIndexStyles;

  override render() {
    const data = this.serverData as DocsIndexData | null;
    if (!data) return html`<p>Loading&hellip;</p>`;

    return html`
      <starlight-page
        siteTitle="${data.siteTitle}"
        pageTitle="Documentation"
        .nav="${data.nav}"
        .sidebar="${data.sidebar}"
        .toc="${[]}"
        currentSlug=""
        currentPath="/docs"
      >
        <div slot="content">
          <p class="intro">${DESCRIPTION}</p>

          ${data.groups.map(group => html`
            <section class="doc-group">
              <h2>${group.label}</h2>
              <ul>
                ${group.items.map(item => html`
                  <li>
                    <a href="${item.href}">${item.label}</a>
                    ${item.description ? html`<span class="item-desc">${item.description}</span>` : ''}
                  </li>
                `)}
              </ul>
            </section>
          `)}
        </div>
      </starlight-page>
    `;
  }
}

export default DocsIndexPage;
