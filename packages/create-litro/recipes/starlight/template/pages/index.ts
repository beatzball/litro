import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { LitroPage } from '@beatzball/litro/runtime';
import { definePageData } from '@beatzball/litro';
import { getGlobalData } from 'litro:content';
import { siteConfig } from '../server/starlight.config.js';
import { starlightHead } from '../src/route-meta.js';

// Register components used in render()
import '../src/components/starlight-header.js';
import '../src/components/sl-card.js';
import '../src/components/sl-card-grid.js';

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
      {
        icon: '📄',
        title: 'Docs',
        description: 'Structured documentation with sidebar, TOC, and prev/next navigation.',
      },
      {
        icon: '✍️',
        title: 'Blog',
        description: 'Write posts in Markdown. Tags, dates, and listing pages auto-generated.',
      },
      {
        icon: '🎨',
        title: 'Theming',
        description: 'Light and dark mode via CSS custom properties. Zero JavaScript required.',
      },
      {
        icon: '⚡',
        title: 'Static',
        description: 'Pre-rendered to plain HTML. Deploy to any CDN with no server required.',
      },
    ],
  } satisfies SplashData;
});

export const routeMeta = {
  head: starlightHead,
  title: '{{projectName}}',
};

@customElement('page-home')
export class SplashPage extends LitroPage {
  override render() {
    const data = this.serverData as SplashData | null;
    const { siteTitle = '{{projectName}}', description = '', nav = [], features = [] } = data ?? {};

    return html`
      <div style="min-height:100vh;display:flex;flex-direction:column;">
        <starlight-header
          siteTitle="${siteTitle}"
          .nav="${nav}"
          currentPath="/"
        ></starlight-header>
        <main style="
          flex:1;
          max-width:56rem;
          margin:0 auto;
          padding:4rem 1.5rem 3rem;
          width:100%;
        ">
          <section style="text-align:center;margin-bottom:4rem;">
            <h1 style="
              font-size:clamp(2rem,5vw,3.5rem);
              font-weight:800;
              color:var(--sl-color-text);
              margin:0 0 1rem;
              line-height:1.1;
            ">${siteTitle}</h1>
            ${description ? html`
              <p style="
                font-size:var(--sl-text-xl);
                color:var(--sl-color-gray-4);
                max-width:36rem;
                margin:0 auto 2.5rem;
                line-height:1.6;
              ">${description}</p>
            ` : ''}
            <div style="display:flex;gap:1rem;justify-content:center;flex-wrap:wrap;">
              <a href="/docs/getting-started" style="
                display:inline-block;
                padding:0.6rem 1.5rem;
                background:var(--sl-color-accent);
                color:var(--sl-color-text-invert,#fff);
                border-radius:var(--sl-border-radius);
                font-weight:600;
                text-decoration:none;
                font-size:var(--sl-text-base);
              ">Get Started</a>
              <a href="/blog" style="
                display:inline-block;
                padding:0.6rem 1.5rem;
                border:1px solid var(--sl-color-border);
                color:var(--sl-color-text);
                border-radius:var(--sl-border-radius);
                font-weight:600;
                text-decoration:none;
                font-size:var(--sl-text-base);
              ">Blog</a>
            </div>
          </section>

          <section>
            <sl-card-grid>
              ${features.map(f => html`
                <sl-card
                  icon="${f.icon ?? ''}"
                  title="${f.title}"
                  description="${f.description}"
                ></sl-card>
              `)}
            </sl-card-grid>
          </section>
        </main>
      </div>
    `;
  }
}

export default SplashPage;
