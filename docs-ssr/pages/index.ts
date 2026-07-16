import { html, css } from "lit";
import { customElement } from "lit/decorators.js";
import { LitroPage } from "@beatzball/litro/runtime";
import { definePageData } from "@beatzball/litro";
import { getGlobalData } from "litro:content";
import { siteConfig } from "../server/starlight.config.js";
import { starlightHead } from "@beatzball/litro-docs-ui/src/route-meta.js";
import { buildSeoHead, buildJsonLd } from "@beatzball/litro-docs-ui/src/seo.js";

// Register components used in render()
import "@beatzball/litro-docs-ui/src/components/starlight-header.js";
import "@beatzball/litro-docs-ui/src/components/litro-card.js";
import "@beatzball/litro-docs-ui/src/components/litro-card-grid.js";

export interface SplashData {
  siteTitle: string;
  description: string;
  nav: Array<{ label: string; href: string }>;
  features: Array<{
    title: string;
    description: string;
    icon?: string;
    iconSrc?: string;
  }>;
  seoHead: string;
}

export const pageData = definePageData(async (_event) => {
  const metadata = await getGlobalData();
  const siteTitle = String(metadata.title ?? siteConfig.title);
  const description = String(metadata.description ?? siteConfig.description);

  const seoHead = buildSeoHead({
    title: siteTitle,
    description,
    path: "/",
    type: "website",
  }) + buildJsonLd({
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "Litro",
    "description": "A fullstack web framework combining web components, Nitro server, and Vite. File-based routing, streaming SSR, SSG, and Declarative Shadow DOM.",
    "url": "https://litro.dev",
    "applicationCategory": "DeveloperApplication",
    "operatingSystem": "Node.js",
    "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
    "author": { "@type": "Organization", "name": "beatzball", "url": "https://github.com/beatzball" },
    "license": "https://www.apache.org/licenses/LICENSE-2.0",
    "codeRepository": "https://github.com/beatzball/litro",
    "programmingLanguage": ["TypeScript", "JavaScript"],
  });

  return {
    siteTitle,
    description,
    nav: siteConfig.nav,
    features: [
      {
        iconSrc: "/logos/webcomponents.svg",
        title: "Web Components",
        description:
          "Pick your component library — Lit, FAST, or Elena. Standard custom elements, zero lock-in.",
      },
      {
        iconSrc: "/logos/nitro.svg",
        title: "Nitro Server",
        description:
          "API routes, middleware, and every Nitro deployment adapter out of the box.",
      },
      {
        icon: "🚀",
        title: "Streaming SSR",
        description:
          "Declarative Shadow DOM or light-DOM SSR — each adapter picks the fastest path to first paint.",
      },
      {
        icon: "🔀",
        title: "File-System Routing",
        description:
          "Pages folder maps directly to URLs. Dynamic segments, catch-alls, nested routes.",
      },
      {
        icon: "🏗️",
        title: "Static Generation",
        description:
          "Prerender all routes to HTML. Deploy to any CDN with zero server cost.",
      },
      {
        icon: "📝",
        title: "Content Layer",
        description:
          "Markdown content with 11ty-compatible frontmatter and data cascade.",
      },
      {
        icon: "🤖",
        title: "AI Agents",
        description:
          "Filesystem-first agent endpoints whose tools return server-rendered UI — the model sees data, users see components. Durable and resumable.",
      },
    ],
    seoHead,
  } satisfies SplashData;
});

export const routeMeta = {
  head: starlightHead,
  title: "Litro — Fullstack Web Component Framework",
};

@customElement("page-home")
export class SplashPage extends LitroPage {
  static override styles = css`
    .cta-btn {
      display: inline-flex;
      align-items: center;
      padding: 0.5rem 1.125rem;
      border-radius: 0.375rem;
      font-size: 0.875rem;
      font-weight: 600;
      text-decoration: none;
      line-height: 1.5;
      transition: filter 0.15s, background 0.15s;
      cursor: pointer;
      white-space: nowrap;
    }
    .cta-btn-primary {
      background: var(--sl-color-primary-600, #ea580c);
      color: #fff;
      border: 1px solid transparent;
    }
    .cta-btn-primary:hover {
      filter: brightness(1.08);
    }
    .cta-btn-default {
      background: transparent;
      color: var(--sl-color-text, #23262f);
      border: 1px solid var(--sl-color-border, #e8e8e8);
    }
    .cta-btn-default:hover {
      background: var(--sl-color-gray-2, #e8e8e8);
    }
  `;

  override render() {
    const data = this.serverData as SplashData | null;
    const {
      siteTitle = "Litro",
      description = "",
      nav = [],
      features = [],
    } = data ?? {};

    return html`
      <div style="min-height:100vh;display:flex;flex-direction:column;">
        <starlight-header
          siteTitle="${siteTitle}"
          .nav="${nav}"
          currentPath="/"
          .spaNav="${true}"
        ></starlight-header>

        <section
          style="
          position:relative;
          text-align:center;
          padding:5rem 1.5rem 5rem;
          overflow:hidden;
          background:
            radial-gradient(ellipse 80% 50% at 50% -10%, color-mix(in srgb, var(--sl-color-accent) 18%, transparent), transparent),
            var(--sl-color-bg);
        "
        >
          <!-- dot texture overlay -->
          <div
            style="
            position:absolute;
            inset:0;
            background-image:radial-gradient(circle, color-mix(in srgb, var(--sl-color-accent) 25%, transparent) 1px, transparent 1px);
            background-size:20px 20px;
            opacity:0.5;
            pointer-events:none;
          "
          ></div>

          <!-- pill badge -->
          <div
            style="
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
          "
          >
            Fullstack Web Framework
          </div>

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
            <h1
              style="
              font-size:clamp(2.5rem,6vw,4rem);
              font-weight:800;
              margin:0 0 1.25rem;
              line-height:1.05;
              background:linear-gradient(135deg, var(--sl-color-accent) 0%, color-mix(in srgb, var(--sl-color-accent) 60%, #38bdf8) 100%);
              -webkit-background-clip:text;
              -webkit-text-fill-color:transparent;
              background-clip:text;
            "
            >
              ${siteTitle}
            </h1>
            ${description
              ? html`
                  <p
                    style="
                font-size:var(--sl-text-xl);
                color:var(--sl-color-gray-5);
                max-width:40rem;
                margin:0 auto 2.5rem;
                line-height:1.6;
              "
                  >
                    The fullstack web component framework — SSR, static generation, and your choice of
                    <span style="display:inline-flex;align-items:center;gap:0.25rem;vertical-align:bottom;">
                      <img src="/logos/lit-flame.svg" alt="" aria-hidden="true" style="width:0.95em;height:0.95em;" />Lit</span>,
                    <span style="display:inline-flex;align-items:center;gap:0.25rem;vertical-align:bottom;">
                      <img src="/logos/fast.svg" alt="" aria-hidden="true" style="width:0.95em;height:0.95em;" />FAST</span>, or
                    <span style="display:inline-flex;align-items:center;gap:0.25rem;vertical-align:bottom;">
                      <img src="/logos/elena.svg" alt="" aria-hidden="true" style="width:0.95em;height:0.95em;" />Elena</span>.
                  </p>
                `
              : ""}
            <div
              style="display:flex;gap:1rem;justify-content:center;flex-wrap:wrap;"
            >
              <litro-link href="/docs/introduction" class="cta-btn cta-btn-primary">Get Started</litro-link>
              <litro-link href="/blog" class="cta-btn cta-btn-default">Blog</litro-link>
            </div>
          </div>
        </section>

        <main
          style="
          flex:1;
          max-width:56rem;
          margin:0 auto;
          padding:3rem 0 4rem;
          width:100%;
        "
        >
          <litro-card-grid style="margin: 0 1.5rem">
            ${features.map(
              (f) => html`
                <litro-card
                  icon="${f.icon ?? ""}"
                  iconSrc="${f.iconSrc ?? ""}"
                  title="${f.title}"
                  description="${f.description}"
                ></litro-card>
              `,
            )}
          </litro-card-grid>

          <!-- Why Web Components blurb -->
          <div
            style="
            margin:3rem 1.5rem 0;
            padding:2rem;
            border-radius:0.75rem;
            border:1px solid var(--sl-color-hairline);
            background:color-mix(in srgb, var(--sl-color-accent) 4%, var(--sl-color-bg));
            text-align:center;
          "
          >
            <p
              style="
              font-size:var(--sl-text-sm);
              font-weight:600;
              text-transform:uppercase;
              letter-spacing:0.08em;
              color:var(--sl-color-accent);
              margin:0 0 0.5rem;
            "
            >
              Built on the Web Platform
            </p>
            <h2
              style="
              font-size:clamp(1.25rem,3vw,1.75rem);
              font-weight:700;
              margin:0 0 0.75rem;
              color:var(--sl-color-text);
            "
            >
              Why Web Components?
            </h2>
            <p
              style="
              font-size:var(--sl-text-base);
              color:var(--sl-color-gray-5);
              max-width:32rem;
              margin:0 auto 1.5rem;
              line-height:1.6;
            "
            >
              Custom Elements, Shadow DOM, and slots are W3C specifications native to every
              major browser — the same layer as <code style="font-size:0.9em;">&lt;video&gt;</code>,
              CSS Grid, and Fetch. Standards that get added to the platform stay there.
            </p>
            <litro-link
              href="/why-web-components"
              style="
              display:inline-flex;align-items:center;gap:0.375rem;
              font-size:var(--sl-text-sm);font-weight:600;
              color:var(--sl-color-accent);text-decoration:none;
            "
            >
              Learn more about web standards longevity
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path fill-rule="evenodd" d="M1 8a.5.5 0 0 1 .5-.5h11.793l-3.147-3.146a.5.5 0 0 1 .708-.708l4 4a.5.5 0 0 1 0 .708l-4 4a.5.5 0 0 1-.708-.708L13.293 8.5H1.5A.5.5 0 0 1 1 8z"/>
              </svg>
            </litro-link>
          </div>

          <!-- vs comparison widget -->
          <div
            style="
            margin:2rem 1.5rem 0;
            padding:2rem;
            border-radius:0.75rem;
            border:1px solid var(--sl-color-hairline);
            background:var(--sl-color-bg-nav);
          "
          >
            <p
              style="
              text-align:center;
              font-size:var(--sl-text-sm);
              font-weight:600;
              text-transform:uppercase;
              letter-spacing:0.08em;
              color:var(--sl-color-gray-5);
              margin:0 0 1.5rem;
            "
            >
              How Litro Compares
            </p>
            <div
              style="
              display:flex;
              align-items:center;
              justify-content:center;
              gap:2rem;
              flex-wrap:wrap;
            "
            >
              <!-- Litro side -->
              <div style="display:flex;flex-direction:column;align-items:center;gap:0.5rem;min-width:6rem;">
                <img
                  src="/logo.png"
                  alt="Litro"
                  style="width:3.5rem;height:3.5rem;object-fit:contain;filter:drop-shadow(0 0 12px color-mix(in srgb, var(--sl-color-accent) 50%, transparent));"
                />
                <span style="font-size:var(--sl-text-sm);font-weight:700;color:var(--sl-color-text);">Litro</span>
              </div>

              <!-- vs divider -->
              <div
                style="
                display:flex;align-items:center;justify-content:center;
                width:2.5rem;height:2.5rem;
                border-radius:50%;
                border:2px solid var(--sl-color-hairline);
                background:var(--sl-color-bg);
                font-size:var(--sl-text-sm);font-weight:700;
                color:var(--sl-color-gray-5);
                flex-shrink:0;
              "
              >
                vs
              </div>

              <!-- Frameworks side -->
              <div style="display:flex;flex-direction:column;gap:0.5rem;min-width:10rem;">
                <litro-link
                  href="/compare/nextjs"
                  style="
                  display:flex;align-items:center;justify-content:space-between;
                  padding:0.6rem 0.875rem;
                  border-radius:0.5rem;
                  border:1px solid var(--sl-color-hairline);
                  background:var(--sl-color-bg);
                  text-decoration:none;
                  color:var(--sl-color-text);
                  font-size:var(--sl-text-sm);font-weight:500;
                  transition:border-color 0.15s,background 0.15s;
                "
                >
                  <span>Next.js</span>
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" style="color:var(--sl-color-gray-5);">
                    <path fill-rule="evenodd" d="M1 8a.5.5 0 0 1 .5-.5h11.793l-3.147-3.146a.5.5 0 0 1 .708-.708l4 4a.5.5 0 0 1 0 .708l-4 4a.5.5 0 0 1-.708-.708L13.293 8.5H1.5A.5.5 0 0 1 1 8z"/>
                  </svg>
                </litro-link>
                <litro-link
                  href="/compare/nuxt"
                  style="
                  display:flex;align-items:center;justify-content:space-between;
                  padding:0.6rem 0.875rem;
                  border-radius:0.5rem;
                  border:1px solid var(--sl-color-hairline);
                  background:var(--sl-color-bg);
                  text-decoration:none;
                  color:var(--sl-color-text);
                  font-size:var(--sl-text-sm);font-weight:500;
                  transition:border-color 0.15s,background 0.15s;
                "
                >
                  <span>Nuxt.js</span>
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" style="color:var(--sl-color-gray-5);">
                    <path fill-rule="evenodd" d="M1 8a.5.5 0 0 1 .5-.5h11.793l-3.147-3.146a.5.5 0 0 1 .708-.708l4 4a.5.5 0 0 1 0 .708l-4 4a.5.5 0 0 1-.708-.708L13.293 8.5H1.5A.5.5 0 0 1 1 8z"/>
                  </svg>
                </litro-link>
                <litro-link
                  href="/compare/enhance"
                  style="
                  display:flex;align-items:center;justify-content:space-between;
                  padding:0.6rem 0.875rem;
                  border-radius:0.5rem;
                  border:1px solid var(--sl-color-hairline);
                  background:var(--sl-color-bg);
                  text-decoration:none;
                  color:var(--sl-color-text);
                  font-size:var(--sl-text-sm);font-weight:500;
                  transition:border-color 0.15s,background 0.15s;
                "
                >
                  <span>Enhance</span>
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" style="color:var(--sl-color-gray-5);">
                    <path fill-rule="evenodd" d="M1 8a.5.5 0 0 1 .5-.5h11.793l-3.147-3.146a.5.5 0 0 1 .708-.708l4 4a.5.5 0 0 1 0 .708l-4 4a.5.5 0 0 1-.708-.708L13.293 8.5H1.5A.5.5 0 0 1 1 8z"/>
                  </svg>
                </litro-link>
              </div>
            </div>
          </div>
        </main>
      </div>
    `;
  }
}

export default SplashPage;
