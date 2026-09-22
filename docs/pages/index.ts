import { html, css } from "lit";
import { customElement } from "lit/decorators.js";
import { LitroPage } from "@beatzball/litro/runtime";
import { definePageData } from "@beatzball/litro";
import { getGlobalData } from "litro:content";
import { siteConfig } from "../server/starlight.config.js";
import { starlightHead } from "@beatzball/litro-docs-ui/src/route-meta.js";
import { buildSeoHead, buildJsonLd } from "@beatzball/litro-docs-ui/src/seo.js";

// Register components used in render(). The landing page's own parts first...
import "@beatzball/litro-docs-ui/src/components/litro-status-bar.js";
import "@beatzball/litro-docs-ui/src/components/litro-hero-nova.js";
import "@beatzball/litro-docs-ui/src/components/litro-install-command.js";
import "@beatzball/litro-docs-ui/src/components/litro-feature-row.js";
import "@beatzball/litro-docs-ui/src/components/litro-steps.js";
import "@beatzball/litro-docs-ui/src/components/litro-term-window.js";

// ...then the ones shared with the docs pages.
import "@beatzball/litro-docs-ui/src/components/litro-card.js";
import "@beatzball/litro-docs-ui/src/components/litro-card-grid.js";

import type { StepItem } from "@beatzball/litro-docs-ui/src/components/litro-steps.js";
import type { StatusTab } from "@beatzball/litro-docs-ui/src/components/litro-status-bar.js";

/**
 * The home page, built on the supernova recipe's landing-page components.
 *
 * WHY THESE COMPONENTS. `supernova` is the recipe litro ships for exactly this
 * page: a product landing page in front of a starlight docs site. Litro's own
 * site is its first real user, so the components below are the recipe's, copied
 * into `packages/docs-ui` and pinned byte for byte against the recipe by
 * `packages/create-litro/src/supernova-copies.test.ts`.
 *
 * WHAT IS DIFFERENT FROM THE RECIPE. The recipe's page carries placeholder
 * copy. This one carries litro's, and it keeps two sections the recipe has no
 * component for: the feature cards, and the comparison widget.
 *
 * `docs-ssr/pages/index.ts` is this file's server-rendered twin. The two differ
 * only where `.agents/rules/content-docs-site.md` (CONTENT-007) says they may:
 * `<litro-link>` in place of `<a>`, and the search control in the status bar.
 */

/** The command a reader copies to start a project. From `/docs/getting-started`. */
const INSTALL_COMMAND = "pnpm create @beatzball/litro my-app";

/**
 * The tabs in the status bar, left to right.
 *
 * They are a picture of litro's three framework adapters, not live data: every
 * badge settles from `from` to `state` after `delay` seconds, with a CSS
 * animation and no script, and `prefers-reduced-motion` shows them settled from
 * the first frame. TABS_LABEL is the only thing a screen reader gets.
 */
const TABS: StatusTab[] = [
  { name: "lit", state: "done", from: "working", delay: 0.8, current: true },
  { name: "fast", state: "done", from: "working", delay: 1.6 },
  { name: "elena", state: "done", from: "working", delay: 2.4 },
];

/** What the tab row shows, in one sentence, for a reader who cannot see it. */
const TABS_LABEL =
  "Three framework adapters, all ready: Lit, FAST Element and Elena.";

/** What a reader does, in order, to get from nothing to a running project. */
const STEPS: StepItem[] = [
  {
    title: "Create a project",
    description:
      "The scaffolding CLI asks for a recipe, a rendering mode and a framework adapter, then writes the project.",
  },
  {
    title: "Start the dev server",
    description:
      "pnpm install, then pnpm dev. The server starts on port 3000 and increments if that port is taken.",
  },
  {
    title: "Build for production",
    description:
      "pnpm build writes the Vite client bundle, and either a Nitro server or a fully prerendered static site.",
  },
];

/** The shell transcript drawn in the terminal picture beside the steps. */
const TRANSCRIPT = `$ pnpm create @beatzball/litro my-app
$ cd my-app && pnpm install
$ pnpm dev
  litro dev  http://localhost:3000`;

/** What a screen reader gets instead of that picture. */
const TRANSCRIPT_LABEL =
  "A shell session: create a project, install it, start the dev server, and it serves on localhost port 3000.";

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
    /* ── The token block ───────────────────────────────────────────────
     *
     * The landing page's own theme. Every component on this page reads these
     * tokens and defines no colors of its own, so this block is the one place
     * to retheme the page.
     *
     * The colors are litro's mark: orange and red on one side of the flame,
     * blue and cyan on the other. --nova-accent takes the orange the docs
     * already use as --sl-color-accent; --nova-accent-2 takes the cyan the old
     * hero gradient ended on.
     *
     * THE LANDING PAGE IS DARK WHATEVER THE READER'S LIGHT OR DARK CHOICE IS,
     * the way a product page usually is, while the docs pages follow that
     * choice. That is how the two are kept from fighting: this page never
     * redefines a --sl-* token at :host level, so the global light and dark
     * values keep their meaning everywhere else, and the toggle on the docs
     * pages still works. The only --sl-* values set here are set ON a docs
     * component, further down, to dress that one element for a dark page.
     */
    :host {
      color-scheme: dark;

      /* surfaces */
      --nova-bg: #0b0d14;
      --nova-surface: #13161f;
      --nova-border: #262a3d;

      /* text */
      --nova-text: #e9ecfa;
      --nova-text-dim: #9aa1bd;

      /* accent — the two sides of the flame.
       *
       * TWO ORANGES, and the reason is contrast. --nova-accent is the one the
       * docs already use, and it is bright enough to read as text on the dark
       * page. It is NOT dark enough to carry light text ON it: white on
       * #ea580c is 3.5:1, under the 4.5:1 a body-sized word needs. So
       * anything that puts words on an orange FIELD — the status bar's name
       * segment, the primary button — takes --nova-accent-high instead, which
       * is the docs' own --sl-color-accent-high and reads at 7:1.
       */
      --nova-accent: #ea580c;
      --nova-accent-high: #9a3412;
      --nova-accent-2: #38bdf8;

      /* states */
      --nova-error: #f87171;
      --nova-blocked: #fbbf24;
      --nova-working: #38bdf8;
      --nova-done: #4ade80;
      --nova-idle: #64748b;

      /* layout — 56rem is the width the docs home page has always used */
      --nova-measure: 56rem;
      --nova-gutter: 1.5rem;
      --nova-radius: 0.375rem;
      --nova-font-mono: var(
        --sl-font-mono,
        ui-monospace,
        "Cascadia Code",
        "Fira Code",
        monospace
      );
    }

    /* ── Dressing the docs components for a dark page ──────────────────
     *
     * litro-card is the DOCS site's component. It reads the --sl-* tokens, and
     * those follow the reader's light or dark choice, while this page is dark
     * either way. Left alone the cards are white boxes on a black page.
     *
     * So the --sl-* tokens are set HERE, ON THAT ELEMENT. That dresses it for
     * this page only: the docs pages are untouched, the tokens keep their
     * global meaning, and the component's own file does not change.
     */
    /* The bar draws the site name as light text on an accent field, so the
       accent it reads has to be the darker one. It also tints the focus ring,
       which stays well clear of the 3:1 a control outline needs. */
    litro-status-bar {
      --nova-accent: var(--nova-accent-high);
    }

    litro-card {
      --sl-color-bg: var(--nova-surface);
      --sl-color-text: var(--nova-text);
      --sl-color-gray-4: var(--nova-text-dim);
      --sl-color-border: var(--nova-border);
      --sl-color-accent: var(--nova-accent);
      --sl-color-note: var(--nova-working);
      --sl-color-tip: var(--nova-done);
      --sl-color-caution: var(--nova-blocked);
    }

    /* ── Page frame ────────────────────────────────────────────────────── */

    /* The global stylesheet's box-sizing reset stops at the shadow boundary,
       so it has to be repeated here. Without it every padded full-width block
       on this page — .shell most of all — is its width PLUS its gutters, and
       a phone-sized screen scrolls sideways by exactly the gutter. */
    *,
    *::before,
    *::after {
      box-sizing: border-box;
    }

    :host {
      display: block;
      background: var(--nova-bg);
      color: var(--nova-text);
    }

    .page {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    main {
      flex: 1;
      width: 100%;
    }

    .shell {
      max-width: var(--nova-measure);
      margin: 0 auto;
      padding: 0 var(--nova-gutter);
      width: 100%;
    }

    /* ── The status bar's slotted controls ─────────────────────────────
     *
     * The bar's navigation is a slot, so the links are written by this page.
     * litro-status-bar sizes and colors anything in that slot with
     * ::slotted([slot='nav']), so there is nothing left for the page to do.
     */

    /* ── Hero ──────────────────────────────────────────────────────────── */

    .hero {
      text-align: center;
      padding: 4.5rem 0 4rem;
    }

    .eyebrow-pill {
      display: inline-block;
      margin-bottom: 1.5rem;
      padding: 0.3rem 0.9rem;
      border: 1px solid color-mix(in srgb, var(--nova-accent) 50%, transparent);
      border-radius: 9999px;
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--nova-accent);
      background: color-mix(in srgb, var(--nova-accent) 10%, transparent);
    }

    .hero-logo {
      width: 7rem;
      height: 7rem;
      object-fit: contain;
      display: block;
      margin: 0 auto 1.25rem;
      filter: drop-shadow(
        0 0 24px color-mix(in srgb, var(--nova-accent) 60%, transparent)
      );
    }

    .hero h1 {
      font-size: clamp(2.5rem, 6vw, 4rem);
      font-weight: 800;
      /* fit-content, and it matters: the gradient is painted across the
         element's BOX, so a full-width heading puts the word in the middle of
         the ramp, where the two colors meet and cancel out to gray. Sized to
         the word, the name runs orange to cyan the way the mark does. */
      width: fit-content;
      margin: 0 auto 1.25rem;
      line-height: 1.05;
      /* Both stops are orange: the second is the accent mixed part of the way
         toward the cyan, which is the same ramp the page has always used. A
         gradient that ran the whole way to cyan would put the middle of the
         ramp — where the two cancel to gray — right under the word. */
      background: linear-gradient(
        135deg,
        var(--nova-accent) 0%,
        color-mix(in srgb, var(--nova-accent) 60%, var(--nova-accent-2)) 100%
      );
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      /* The name sits over the brightest part of the nova. drop-shadow, not
         text-shadow: it follows the gradient-clipped glyphs, where a
         text-shadow would paint through the transparent fill. */
      filter: drop-shadow(0 2px 14px rgba(0, 0, 0, 0.6));
    }

    .lede {
      font-size: 1.25rem;
      color: var(--nova-text-dim);
      max-width: 40rem;
      margin: 0 auto 2rem;
      line-height: 1.6;
    }

    /* Each adapter's name carries its own logo, so the three choices read as
       three products and not as three words. */
    .adapter {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      vertical-align: bottom;
    }

    .adapter img {
      width: 0.95em;
      height: 0.95em;
    }

    .hero litro-install-command {
      display: flex;
      justify-content: center;
      margin: 0 0 2rem;
    }

    /* ── Buttons ───────────────────────────────────────────────────────── */

    .actions {
      display: flex;
      gap: 1rem;
      justify-content: center;
      flex-wrap: wrap;
    }

    .button {
      display: inline-flex;
      align-items: center;
      padding: 0.5rem 1.125rem;
      border-radius: var(--nova-radius);
      font-size: 0.875rem;
      font-weight: 600;
      line-height: 1.5;
      text-decoration: none;
      white-space: nowrap;
      border: 1px solid transparent;
      cursor: pointer;
      transition: filter 0.15s, background 0.15s;
    }

    .button.primary {
      background: var(--nova-accent-high);
      color: #fff;
    }

    .button.primary:hover {
      filter: brightness(1.08);
    }

    .button.ghost {
      border-color: var(--nova-border);
      color: var(--nova-text);
    }

    .button.ghost:hover {
      background: var(--nova-surface);
    }

    .button:focus-visible {
      outline: 2px solid var(--nova-accent);
      outline-offset: 2px;
    }

    /* ── Cards ─────────────────────────────────────────────────────────── */

    .cards {
      padding: 3rem 0 1rem;
    }

    /* ── Feature rows ──────────────────────────────────────────────────── */

    .rows {
      display: flex;
      flex-direction: column;
      gap: 3.5rem;
      padding: 3rem 0 1rem;
    }

    /* Shadow DOM styles stop at a slot, so everything handed to a row is
       styled here, by the page, and not inside litro-feature-row. */
    .rows p {
      color: var(--nova-text-dim);
      line-height: 1.7;
      margin: 0 0 1rem;
    }

    .rows .eyebrow {
      font-size: 0.875rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--nova-accent);
      margin: 0 0 0.75rem;
    }

    .rows code {
      font-family: var(--nova-font-mono);
      font-size: 0.9em;
    }

    .learn-more {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--nova-accent);
      text-decoration: none;
    }

    .learn-more:hover {
      text-decoration: underline;
    }

    .learn-more:focus-visible {
      outline: 2px solid var(--nova-accent);
      outline-offset: 2px;
    }

    /* ── Get running ───────────────────────────────────────────────────── */

    .start {
      display: grid;
      grid-template-columns: 1fr;
      gap: 2.5rem;
      padding: 3rem 0 1rem;
    }

    @media (min-width: 48rem) {
      .start {
        grid-template-columns: 1fr 1fr;
        gap: 4rem;
        align-items: start;
      }
    }

    .start pre {
      margin: 0;
      color: var(--nova-text);
    }

    .section-title {
      font-size: 1.5rem;
      font-weight: 700;
      margin: 0 0 1.25rem;
    }

    /* ── How Litro compares ────────────────────────────────────────────── */

    .compare {
      margin: 3rem 0 0;
      padding: 2rem;
      border-radius: 0.75rem;
      border: 1px solid var(--nova-border);
      background: var(--nova-surface);
    }

    .compare-title {
      text-align: center;
      font-size: 0.875rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--nova-text-dim);
      margin: 0 0 1.5rem;
    }

    .compare-body {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 2rem;
      flex-wrap: wrap;
    }

    .compare-self {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      min-width: 6rem;
    }

    .compare-self img {
      width: 3.5rem;
      height: 3.5rem;
      object-fit: contain;
      filter: drop-shadow(
        0 0 12px color-mix(in srgb, var(--nova-accent) 50%, transparent)
      );
    }

    .compare-self span {
      font-size: 0.875rem;
      font-weight: 700;
      color: var(--nova-text);
    }

    .compare-vs {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 2.5rem;
      height: 2.5rem;
      border-radius: 50%;
      border: 2px solid var(--nova-border);
      background: var(--nova-bg);
      font-size: 0.875rem;
      font-weight: 700;
      color: var(--nova-text-dim);
      flex-shrink: 0;
    }

    .compare-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      min-width: 10rem;
    }

    .compare-link {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.6rem 0.875rem;
      border-radius: 0.5rem;
      border: 1px solid var(--nova-border);
      background: var(--nova-bg);
      text-decoration: none;
      color: var(--nova-text);
      font-size: 0.875rem;
      font-weight: 500;
      transition: border-color 0.15s, background 0.15s;
    }

    .compare-link:hover {
      border-color: var(--nova-accent);
    }

    .compare-link:focus-visible {
      outline: 2px solid var(--nova-accent);
      outline-offset: 2px;
    }

    .compare-link svg {
      color: var(--nova-text-dim);
    }

    /* On a phone the widget's three columns cannot all hold their minimum
       width, so the box grows past the screen and the whole page scrolls
       sideways. The minimums go, the padding shrinks, and the rows stack. */
    @media (max-width: 30rem) {
      .compare {
        padding: 1.25rem;
      }

      .compare-body {
        gap: 1.25rem;
      }

      .compare-self,
      .compare-list {
        min-width: 0;
      }

      .compare-list {
        width: 100%;
      }
    }

    /* ── Closing ───────────────────────────────────────────────────────── */

    .closing {
      text-align: center;
      padding: 4rem 0 5rem;
      margin-top: 4rem;
      border-top: 1px solid var(--nova-border);
    }

    .closing h2 {
      font-size: clamp(1.6rem, 4vw, 2.5rem);
      font-weight: 800;
      margin: 0 0 1.5rem;
    }

    .closing litro-install-command {
      display: flex;
      justify-content: center;
      margin: 0 0 2rem;
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
      <div class="page">
        <!-- The landing page's own header, in place of starlight-header. It
             takes the SAME title and the SAME links the docs header shows,
             from the same place — server/starlight.config.js — so a reader
             moving between the landing page and the docs sees one site. -->
        <litro-status-bar
          siteTitle="${siteTitle}"
          .tabs="${TABS}"
          tabsLabel="${TABS_LABEL}"
        >
          <!-- The same mark as the hero's, drawn small. One symbol, twice. -->
          <img slot="mark" src="/logo.png" alt="" aria-hidden="true" />
          ${nav.map(
            (item) => html`<a slot="nav" href="${item.href}">${item.label}</a>`,
          )}
        </litro-status-bar>

        <main>
          <litro-hero-nova>
            <!-- Litro's flame, drawn faded and centered behind the words. -->
            <img slot="mark" src="/logo.png" alt="" aria-hidden="true" />

            <section class="hero shell">
              <p class="eyebrow-pill">Fullstack Web Framework</p>
              <img class="hero-logo" src="/logo.png" alt="Litro logo" />
              <h1>${siteTitle}</h1>
              ${description
                ? html`
                    <p class="lede">
                      The fullstack web component framework — SSR, static
                      generation, and your choice of
                      <span class="adapter"
                        ><img
                          src="/logos/lit-flame.svg"
                          alt=""
                          aria-hidden="true"
                        />Lit</span
                      >,
                      <span class="adapter"
                        ><img
                          src="/logos/fast.svg"
                          alt=""
                          aria-hidden="true"
                        />FAST</span
                      >, or
                      <span class="adapter"
                        ><img
                          src="/logos/elena.svg"
                          alt=""
                          aria-hidden="true"
                        />Elena</span
                      >.
                    </p>
                  `
                : ""}
              <litro-install-command
                command="${INSTALL_COMMAND}"
              ></litro-install-command>
              <div class="actions">
                <a href="/docs/introduction" class="button primary"
                  >Get Started</a
                >
                <a href="/blog" class="button ghost">Blog</a>
              </div>
            </section>
          </litro-hero-nova>

          <section class="cards shell" aria-label="What you get">
            <litro-card-grid>
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
          </section>

          <section class="rows shell" aria-label="Why Litro">
            <litro-feature-row heading="Why Web Components?">
              <p class="eyebrow">Built on the Web Platform</p>
              <p>
                Custom Elements, Shadow DOM, and slots are W3C specifications
                native to every major browser — the same layer as
                <code>&lt;video&gt;</code>, CSS Grid, and Fetch. Standards that
                get added to the platform stay there.
              </p>
              <a href="/why-web-components" class="learn-more">
                Learn more about web standards longevity
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fill-rule="evenodd"
                    d="M1 8a.5.5 0 0 1 .5-.5h11.793l-3.147-3.146a.5.5 0 0 1 .708-.708l4 4a.5.5 0 0 1 0 .708l-4 4a.5.5 0 0 1-.708-.708L13.293 8.5H1.5A.5.5 0 0 1 1 8z"
                  />
                </svg>
              </a>
            </litro-feature-row>
          </section>

          <section class="start shell" aria-label="Get running">
            <div>
              <h2 class="section-title">Get running</h2>
              <litro-steps .steps="${STEPS}"></litro-steps>
            </div>
            <litro-term-window label="${TRANSCRIPT_LABEL}">
              <pre>${TRANSCRIPT}</pre>
            </litro-term-window>
          </section>

          <section class="shell" aria-label="How Litro compares">
            <div class="compare">
              <p class="compare-title">How Litro Compares</p>
              <div class="compare-body">
                <div class="compare-self">
                  <img src="/logo.png" alt="Litro" />
                  <span>Litro</span>
                </div>

                <div class="compare-vs" aria-hidden="true">vs</div>

                <div class="compare-list">
                  <a href="/compare/nextjs" class="compare-link">
                    <span>Next.js</span>
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 16 16"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        fill-rule="evenodd"
                        d="M1 8a.5.5 0 0 1 .5-.5h11.793l-3.147-3.146a.5.5 0 0 1 .708-.708l4 4a.5.5 0 0 1 0 .708l-4 4a.5.5 0 0 1-.708-.708L13.293 8.5H1.5A.5.5 0 0 1 1 8z"
                      />
                    </svg>
                  </a>
                  <a href="/compare/nuxt" class="compare-link">
                    <span>Nuxt.js</span>
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 16 16"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        fill-rule="evenodd"
                        d="M1 8a.5.5 0 0 1 .5-.5h11.793l-3.147-3.146a.5.5 0 0 1 .708-.708l4 4a.5.5 0 0 1 0 .708l-4 4a.5.5 0 0 1-.708-.708L13.293 8.5H1.5A.5.5 0 0 1 1 8z"
                      />
                    </svg>
                  </a>
                  <a href="/compare/enhance" class="compare-link">
                    <span>Enhance</span>
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 16 16"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        fill-rule="evenodd"
                        d="M1 8a.5.5 0 0 1 .5-.5h11.793l-3.147-3.146a.5.5 0 0 1 .708-.708l4 4a.5.5 0 0 1 0 .708l-4 4a.5.5 0 0 1-.708-.708L13.293 8.5H1.5A.5.5 0 0 1 1 8z"
                      />
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          </section>

          <section class="closing shell">
            <h2>Start with one command.</h2>
            <litro-install-command
              command="${INSTALL_COMMAND}"
            ></litro-install-command>
            <div class="actions">
              <a href="/docs/introduction" class="button primary"
                >Read the docs</a
              >
            </div>
          </section>
        </main>
      </div>
    `;
  }
}

export default SplashPage;
