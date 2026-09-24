import { html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import { LitroPage } from '@beatzball/litro/runtime';
import { definePageData } from '@beatzball/litro';
import { getPosts } from 'litro:content';
import { siteConfig } from '../../server/starlight.config.js';
import { starlightHead } from '../../src/route-meta.js';

// Register components used in render()
import '../../src/components/starlight-page.js';

/**
 * The /docs landing page.
 *
 * Without it, /docs is a 404 — only /docs/<slug> exists — and a reader who
 * types the obvious path, or trims a URL back one segment, lands on nothing.
 * The page is prerendered like every other static route, so it works with no
 * client JavaScript.
 */

interface DocsIndexItem {
  label: string;
  href: string;
  description: string | null;
}

interface DocsIndexGroup {
  label: string;
  items: DocsIndexItem[];
}

export interface DocsIndexData {
  groups: DocsIndexGroup[];
  sidebar: typeof siteConfig.sidebar;
  siteTitle: string;
  nav: typeof siteConfig.nav;
}

export const pageData = definePageData(async (_event) => {
  const contentPrefix = '/content/docs/';
  const posts = await getPosts();

  // Each doc's frontmatter `description`, keyed by slug.
  const descriptions = new Map<string, string>();
  for (const post of posts) {
    if (!post.url.startsWith(contentPrefix)) continue;
    const description = post.description?.trim();
    if (description) descriptions.set(post.url.slice(contentPrefix.length), description);
  }

  // A group with an empty `items` array is dropped: rendering it would put a
  // heading over an empty list.
  const groups = siteConfig.sidebar
    .map(group => ({
      label: group.label,
      items: group.items.map(item => ({
        label: item.label,
        href: `/docs/${item.slug}`,
        description: descriptions.get(item.slug) ?? null,
      })),
    }))
    .filter(group => group.items.length > 0);

  return {
    groups,
    sidebar: siteConfig.sidebar,
    siteTitle: siteConfig.title,
    nav: siteConfig.nav,
  } satisfies DocsIndexData;
});

export const routeMeta = {
  head: starlightHead,
  title: 'Documentation — playground-starlight',
};

@customElement('page-docs')
export class DocsIndexPage extends LitroPage {
  /**
   * Styles live in this page's shadow root so they reach the
   * <div slot="content"> subtree. Global stylesheets cannot pierce it.
   */
  static override styles = css`
    :host { display: block; }

    .doc-group { margin-bottom: 2.5rem; }
    .doc-group h2 {
      margin: 0 0 1rem;
      font-size: var(--sl-text-xl, 1.25rem);
      font-weight: 600;
      color: var(--sl-color-text);
      border-bottom: 1px solid var(--sl-color-border, #e8e8e8);
      padding-bottom: 0.35em;
    }
    .doc-group ul {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
      gap: 1rem;
    }
    .doc-group li {
      border: 1px solid var(--sl-color-border, #e8e8e8);
      border-radius: 0.5rem;
      padding: 0.85rem 1rem;
    }
    .doc-group a {
      display: block;
      font-weight: 600;
      color: var(--sl-color-text-accent, var(--sl-color-accent, #ea580c));
      text-decoration: none;
    }
    .doc-group a:hover { text-decoration: underline; }
    .item-desc {
      display: block;
      margin-top: 0.35rem;
      font-size: var(--sl-text-sm, 0.875rem);
      line-height: 1.6;
      color: var(--sl-color-gray-5, #6b7280);
    }
  `;

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
