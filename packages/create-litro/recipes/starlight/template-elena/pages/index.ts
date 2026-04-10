import { html, unsafeHTML } from '@elenajs/core';
import { LitroPage } from '@beatzball/litro/adapter/elena/page';
import { definePageData } from '@beatzball/litro';
import { getGlobalData } from 'litro:content';
import { siteConfig } from '../server/starlight.config.js';
import { starlightHead } from '../src/route-meta.js';
// Re-exporting child components prevents Rollup from tree-shaking
// the side-effect (.define() calls), ensuring SSR can expand them.
export { StarlightPage } from '../src/components/starlight-page.js';
export { LitroCardGrid } from '../src/components/litro-card-grid.js';
export { LitroCard } from '../src/components/litro-card.js';
export { LitroBadge } from '../src/components/litro-badge.js';

export interface SplashData {
  siteTitle: string;
  description: string;
  nav: Array<{ label: string; href: string }>;
  features: Array<{ title: string; description: string; icon?: string }>;
}

export const pageData = definePageData(async (_event) => {
  const metadata = await getGlobalData();
  return {
    siteTitle: String(metadata.title ?? siteConfig.title),
    description: String(metadata.description ?? siteConfig.description),
    nav: siteConfig.nav,
    features: [
      { icon: '\u{1F4C4}', title: 'Docs', description: 'Structured documentation with sidebar, TOC, and prev/next navigation.' },
      { icon: '\u270D\uFE0F', title: 'Blog', description: 'Write posts in Markdown. Tags, dates, and listing pages auto-generated.' },
      { icon: '\u{1F3A8}', title: 'Theming', description: 'Light and dark mode via CSS custom properties. Zero JavaScript required.' },
      { icon: '\u26A1', title: 'Static', description: 'Pre-rendered to plain HTML. Deploy to any CDN with no server required.' },
    ],
  } satisfies SplashData;
});

export const routeMeta = {
  head: starlightHead,
  title: '{{projectName}}',
};

export class SplashPage extends LitroPage {
  static override tagName = 'page-home';

  render() {
    const data = this.serverData as SplashData | null;
    const siteTitle = data?.siteTitle ?? '{{projectName}}';
    const description = data?.description ?? '';
    const nav = data?.nav ?? [];
    const features = data?.features ?? [];

    const descHtml = description
      ? `<p class="hero-desc">${description}</p>`
      : '';

    const cardsHtml = features.map(f =>
      `<litro-card icon="${f.icon ?? ''}" title="${f.title}" description="${f.description}"></litro-card>`
    ).join('');

    return html`
      <style>
        @scope (page-home) {
          :scope { display: block; }
          .main { flex: 1; max-width: 56rem; margin: 0 auto; padding: 4rem 1.5rem 3rem; width: 100%; }
          .hero { text-align: center; margin-bottom: 4rem; }
          .hero h1 { font-size: clamp(2rem,5vw,3.5rem); font-weight: 800; color: var(--sl-color-text); margin: 0 0 1rem; line-height: 1.1; }
          .hero-desc { font-size: var(--sl-text-xl); color: var(--sl-color-gray-4); max-width: 36rem; margin: 0 auto 2.5rem; line-height: 1.6; }
          .hero-cta { display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; }
          .btn-primary {
            display: inline-block; padding: 0.6rem 1.5rem; background: var(--sl-color-accent);
            color: var(--sl-color-text-invert, #fff); border-radius: var(--sl-border-radius);
            font-weight: 600; text-decoration: none; font-size: var(--sl-text-base);
          }
          .btn-secondary {
            display: inline-block; padding: 0.6rem 1.5rem; border: 1px solid var(--sl-color-border);
            color: var(--sl-color-text); border-radius: var(--sl-border-radius);
            font-weight: 600; text-decoration: none; font-size: var(--sl-text-base);
          }
        }
      </style>
      <starlight-page sitetitle="${siteTitle}" nav="${JSON.stringify(nav)}" currentpath="/" nosidebar="true">
        <main class="main">
          <section class="hero">
            <h1>${siteTitle} <litro-badge variant="tip" text="Elena"></litro-badge></h1>
            ${unsafeHTML(descHtml)}
            <div class="hero-cta">
              <a href="/docs/getting-started" class="btn-primary">Get Started</a>
              <a href="/blog" class="btn-secondary">Blog</a>
            </div>
          </section>
          <section>
            <litro-card-grid>${unsafeHTML(cardsHtml)}</litro-card-grid>
          </section>
        </main>
      </starlight-page>
    `;
  }
}

SplashPage.define();

export default SplashPage;
