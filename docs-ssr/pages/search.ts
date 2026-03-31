import { html, css } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { customElement } from 'lit/decorators.js';
import { LitroPage } from '@beatzball/litro/runtime';
import { definePageData } from '@beatzball/litro';
import { getQuery } from 'h3';
import { siteConfig } from '../server/starlight.config.js';
import { starlightHead } from '@beatzball/litro-docs-ui/src/route-meta.js';
import { buildSeoHead } from '@beatzball/litro-docs-ui/src/seo.js';
import { searchContent } from '../server/utils/search.js';
import type { SearchResult } from '../server/utils/search.js';

// Register components used in render()
import '@beatzball/litro-docs-ui/src/components/starlight-header.js';

export interface SearchPageData {
  query: string;
  results: SearchResult[];
  siteTitle: string;
  nav: typeof siteConfig.nav;
  seoHead: string;
}

export const pageData = definePageData(async (event) => {
  const query = getQuery(event);
  const q = typeof query.q === 'string' ? query.q : '';
  const type = query.type as 'blog' | 'docs' | 'all' | undefined;

  const results = await searchContent(q, {
    type: type === 'blog' || type === 'docs' ? type : 'all',
    limit: 30,
  });

  const seoHead = buildSeoHead({
    title: q ? `Search: ${q} — Litro` : 'Search — Litro',
    description: 'Search Litro documentation, blog posts, and guides.',
    path: '/search',
    type: 'website',
  }) + '<meta name="robots" content="noindex, follow" />';

  return {
    query: q,
    results,
    siteTitle: siteConfig.title,
    nav: siteConfig.nav,
    seoHead,
  } satisfies SearchPageData;
});

export const routeMeta = {
  head: starlightHead,
  title: 'Search — Litro',
};

@customElement('page-search')
export class SearchPage extends LitroPage {

  static override styles = css`
    .result-card {
      border-bottom: 1px solid var(--sl-color-border, #e8e8e8);
      padding-bottom: 1.25rem;
    }

    .result-title {
      font-size: var(--sl-text-xl, 1.25rem);
      font-weight: 600;
      color: var(--sl-color-text, #23262f);
      text-decoration: none;
      display: block;
      margin-bottom: 0.25rem;
    }

    .result-url {
      font-size: var(--sl-text-xs, 0.75rem);
      color: var(--sl-color-gray-4, #888);
      margin-bottom: 0.4rem;
    }

    .result-snippet {
      color: var(--sl-color-gray-5, #4b4b4b);
      line-height: 1.6;
      font-size: var(--sl-text-sm, 0.875rem);
    }

    mark {
      background: var(--sl-color-accent-low, #fff7ed);
      color: var(--sl-color-accent-high, #9a3412);
      padding: 0.05em 0.2em;
      border-radius: 2px;
    }

    .type-badge {
      display: inline-block;
      padding: 0.1em 0.5em;
      font-size: var(--sl-text-xs, 0.75rem);
      border-radius: 9999px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .type-blog {
      background: var(--sl-color-accent-low, #fff7ed);
      color: var(--sl-color-accent-high, #9a3412);
    }

    .type-docs {
      background: var(--sl-color-note-bg, #eff6ff);
      color: var(--sl-color-note, #0284c7);
    }

    .type-compare, .type-page {
      background: var(--sl-color-gray-2, #e8e8e8);
      color: var(--sl-color-gray-5, #4b4b4b);
    }
  `;

  override render() {
    const data = this.serverData as SearchPageData | null;
    const { query = '', results = [], siteTitle = 'Litro', nav = [] } = data ?? {};

    return html`
      <div style="min-height:100vh;display:flex;flex-direction:column;">
        <starlight-header
          siteTitle="${siteTitle}"
          .nav="${nav}"
          currentPath="/search"
          .spaNav="${true}"
        ></starlight-header>
        <main style="
          flex:1;
          max-width:56rem;
          margin:0 auto;
          padding:var(--sl-content-pad-y,2rem) var(--sl-content-pad-x,1.5rem);
          width:100%;
        ">
          <h1 style="font-size:var(--sl-text-4xl);font-weight:700;margin:0 0 0.5rem;">
            Search
          </h1>

          ${query ? html`
            <p style="color:var(--sl-color-gray-4);margin:0 0 2rem;">
              ${results.length} result${results.length !== 1 ? 's' : ''} for
              "<strong style="color:var(--sl-color-text);">${query}</strong>"
            </p>
          ` : html`
            <p style="color:var(--sl-color-gray-4);margin:0 0 2rem;">
              Enter a search term to find documentation, blog posts, and guides.
            </p>
          `}

          ${results.length > 0 ? html`
            <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:1.25rem;">
              ${results.map(r => html`
                <li class="result-card">
                  <litro-link href="${r.url}" class="result-title">${r.title}</litro-link>
                  <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.4rem;">
                    <span class="type-badge type-${r.type}">${r.type}</span>
                    <span class="result-url">${r.url}</span>
                  </div>
                  <p class="result-snippet">${unsafeHTML(r.snippet)}</p>
                </li>
              `)}
            </ul>
          ` : query ? html`
            <p style="color:var(--sl-color-gray-4);font-style:italic;">
              No results found. Try a different search term.
            </p>
          ` : ''}
        </main>
      </div>
    `;
  }
}

export default SearchPage;
