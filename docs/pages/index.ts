import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { LitroPage } from '@beatzball/litro/runtime';
import { definePageData } from '@beatzball/litro';
import { getGlobalData } from 'litro:content';
import { siteConfig } from '../server/starlight.config.js';
import { starlightHead } from '../src/route-meta.js';
import { buildSeoHead } from '../src/seo.js';

// Register components used in render()
import '../src/components/starlight-header.js';
import '../src/components/litro-card.js';
import '../src/components/litro-card-grid.js';

export interface SplashData {
  siteTitle: string;
  description: string;
  nav: Array<{ label: string; href: string }>;
  features: Array<{ title: string; description: string; icon?: string; iconSrc?: string }>;
  seoHead: string;
}

export const pageData = definePageData(async (_event) => {
  const metadata = await getGlobalData();
  const siteTitle = String(metadata.title ?? siteConfig.title);
  const description = String(metadata.description ?? siteConfig.description);

  const seoHead = buildSeoHead({
    title: siteTitle,
    description,
    path: '/',
    type: 'website',
  });

  return {
    siteTitle,
    description,
    nav: siteConfig.nav,
    features: [
      {
        iconSrc: '/logos/lit-flame.svg',
        title: 'Lit Components',
        description: 'Standard web components — no VDOM, no proprietary runtime. Works anywhere.',
      },
      {
        iconSrc: '/logos/nitro.svg',
        title: 'Nitro Server',
        description: 'API routes, middleware, and every Nitro deployment adapter out of the box.',
      },
      {
        icon: '🚀',
        title: 'Streaming SSR',
        description: 'Declarative Shadow DOM streaming via @lit-labs/ssr. Fast first paint.',
      },
      {
        icon: '🔀',
        title: 'File-System Routing',
        description: 'Pages folder maps directly to URLs. Dynamic segments, catch-alls, nested routes.',
      },
      {
        icon: '🏗️',
        title: 'Static Generation',
        description: 'Prerender all routes to HTML. Deploy to any CDN with zero server cost.',
      },
      {
        icon: '📝',
        title: 'Content Layer',
        description: 'Markdown content with 11ty-compatible frontmatter and data cascade.',
      },
    ],
    seoHead,
  } satisfies SplashData;
});

export const routeMeta = {
  head: starlightHead,
  title: 'Litro — Fullstack Lit Framework',
};

@customElement('page-home')
export class SplashPage extends LitroPage {
  override render() {
    const data = this.serverData as SplashData | null;
    const { siteTitle = 'Litro', description = '', nav = [], features = [] } = data ?? {};

    return html`
      <div style="min-height:100vh;display:flex;flex-direction:column;">
        <starlight-header
          siteTitle="${siteTitle}"
          .nav="${nav}"
          currentPath="/"
        ></starlight-header>

        <section style="
          position:relative;
          text-align:center;
          padding:5rem 1.5rem 5rem;
          overflow:hidden;
          background:
            radial-gradient(ellipse 80% 50% at 50% -10%, color-mix(in srgb, var(--sl-color-accent) 18%, transparent), transparent),
            var(--sl-color-bg);
        ">
          <!-- dot texture overlay -->
          <div style="
            position:absolute;
            inset:0;
            background-image:radial-gradient(circle, color-mix(in srgb, var(--sl-color-accent) 25%, transparent) 1px, transparent 1px);
            background-size:20px 20px;
            opacity:0.5;
            pointer-events:none;
          "></div>

          <!-- pill badge -->
          <div style="
            position:relative;
            display:inline-block;
            margin-bottom:1.5rem;
            padding:0.3rem 0.9rem;
            border:1px solid color-mix(in srgb, var(--sl-color-accent) 50%, transparent);
            border-radius:9999px;
            font-size:var(--sl-text-sm);
            font-weight:500;
            color:var(--sl-color-accent);
            background:color-mix(in srgb, var(--sl-color-accent) 8%, transparent);
          ">Fullstack Web Framework</div>

          <div style="position:relative;">
            <img
              src="/logo.png"
              alt="Litro logo"
              style="
                width:7rem;height:7rem;object-fit:contain;
                display:block;margin:0 auto 1.25rem;
                filter:drop-shadow(0 0 24px color-mix(in srgb, var(--sl-color-accent) 60%, transparent));
              "
            />
            <h1 style="
              font-size:clamp(2.5rem,6vw,4rem);
              font-weight:800;
              margin:0 0 1.25rem;
              line-height:1.05;
              background:linear-gradient(135deg, var(--sl-color-accent) 0%, color-mix(in srgb, var(--sl-color-accent) 60%, #38bdf8) 100%);
              -webkit-background-clip:text;
              -webkit-text-fill-color:transparent;
              background-clip:text;
            ">${siteTitle}</h1>
            ${description ? html`
              <p style="
                font-size:var(--sl-text-xl);
                color:var(--sl-color-gray-5);
                max-width:36rem;
                margin:0 auto 2.5rem;
                line-height:1.6;
              ">${description}</p>
            ` : ''}
            <div style="display:flex;gap:1rem;justify-content:center;flex-wrap:wrap;">
              <sl-button variant="primary" size="medium" href="/docs/introduction">Get Started</sl-button>
              <sl-button variant="default" size="medium" href="/blog">Blog</sl-button>
            </div>
          </div>
        </section>

        <main style="
          flex:1;
          max-width:56rem;
          margin:0 auto;
          padding:3rem 1.5rem 4rem;
          width:100%;
        ">
          <litro-card-grid>
            ${features.map(f => html`
              <litro-card
                icon="${f.icon ?? ''}"
                iconSrc="${f.iconSrc ?? ''}"
                title="${f.title}"
                description="${f.description}"
              ></litro-card>
            `)}
          </litro-card-grid>
        </main>
      </div>
    `;
  }
}

export default SplashPage;
