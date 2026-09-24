import { html, css, repeat, when } from '@microsoft/fast-element';
import { LitroPage } from '@beatzball/litro/adapter/fast/page';
import { definePageData } from '@beatzball/litro';
import { getPosts } from 'litro:content';
import { siteConfig } from '../../server/starlight.config.js';
import { starlightHead } from '../../src/route-meta.js';

// Register components — namespace imports prevent Rollup tree-shaking.
import * as _starlightPage from '../../src/components/starlight-page.js';
globalThis.__litro_ce__ = { ...(globalThis as any).__litro_ce__, _starlightPage };

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
  title: 'Documentation — playground-starlight-fast',
};

export class DocsIndexPage extends LitroPage {}

const template = html<DocsIndexPage>`
  ${(x) => {
    const data = x.serverData as DocsIndexData | null;
    if (!data) return html`<p>Loading&hellip;</p>`;

    return html<DocsIndexPage>`
      <starlight-page
        :siteTitle="${() => data.siteTitle}"
        :pageTitle="${() => 'Documentation'}"
        :nav="${() => data.nav}"
        :sidebar="${() => data.sidebar}"
        :toc="${() => []}"
        :currentSlug="${() => ''}"
        :currentPath="${() => '/docs'}"
      >
        <div slot="content">
          ${repeat(() => data.groups, html<DocsIndexGroup>`
            <section class="doc-group">
              <h2>${g => g.label}</h2>
              <ul>
                ${repeat(g => g.items, html<DocsIndexItem>`
                  <li>
                    <a href="${item => item.href}">${item => item.label}</a>
                    ${when(item => !!item.description, html<DocsIndexItem>`
                      <span class="item-desc">${item => item.description}</span>
                    `)}
                  </li>
                `)}
              </ul>
            </section>
          `)}
        </div>
      </starlight-page>
    `;
  }}
`;

/**
 * Styles injected into page-docs's shadow root so they reach the
 * <div slot="content"> subtree. Global stylesheets cannot pierce
 * shadow DOM boundaries.
 */
const styles = css`
  /* A document stylesheet stops at this shadow boundary, so the box-sizing
     reset has to be repeated inside it. Without it a padded full-width box
     measures its width PLUS its gutters, and a phone scrolls sideways by
     exactly the gutter.
     See .agents/rules/adapters-ssr.md (SSR-008). */
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

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

DocsIndexPage.define({ name: 'page-docs', template, styles });

export default DocsIndexPage;
