import { html, css } from "lit";
import { customElement } from "lit/decorators.js";
import { LitroPage } from "@beatzball/litro/runtime";
import { definePageData } from "@beatzball/litro";
import { getGlobalData } from "litro:content";
import { siteConfig } from "../server/starlight.config.js";
import { starlightHead } from "@beatzball/litro-docs-ui/src/route-meta.js";
import { buildSeoHead, buildJsonLd } from "@beatzball/litro-docs-ui/src/seo.js";
import { getPackageInfo } from "@beatzball/litro-docs-ui/src/packages.js";

// Register components used in render(). The landing page's own parts first...
import "@beatzball/litro-docs-ui/src/components/starlight-header.js";
import "@beatzball/litro-docs-ui/src/components/litro-status-line.js";
import "@beatzball/litro-docs-ui/src/components/litro-hero-nova.js";
import "@beatzball/litro-docs-ui/src/components/litro-install-command.js";
import "@beatzball/litro-docs-ui/src/components/litro-feature-row.js";
import "@beatzball/litro-docs-ui/src/components/litro-steps.js";
import "@beatzball/litro-docs-ui/src/components/litro-term-window.js";

// ...then the ones shared with the docs pages.
import "@beatzball/litro-docs-ui/src/components/litro-card.js";
import "@beatzball/litro-docs-ui/src/components/litro-card-grid.js";

import type { StepItem } from "@beatzball/litro-docs-ui/src/components/litro-steps.js";
import type { StatusCell } from "@beatzball/litro-docs-ui/src/components/litro-status-line.js";

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
 * What Node this needs. The repository's own `engines.node` is
 * `^20.19.0 || >=22.12.0`; this is that, said the way a reader says it.
 *
 * It is one constant because it appears twice — in the small print under the
 * install command, and in the status line at the foot — and two copies of a
 * version number drift.
 */
const NODE_REQUIREMENT = "20.19+";

/** The three framework adapters, in the order the docs list them. */
const ADAPTERS = "lit \u00b7 fast \u00b7 elena";

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
  statusCells: StatusCell[];
}

export const pageData = definePageData(async (_event) => {
  const metadata = await getGlobalData();
  const siteTitle = String(metadata.title ?? siteConfig.title);
  const description = String(metadata.description ?? siteConfig.description);

  // The version the status line shows, read from the package itself rather
  // than written down here — a number typed into a page is wrong the day
  // after a release. `getPackageInfo` is stubbed out of the browser bundle
  // (CONTENT-008), and the stub returns null, so the cell is simply left out
  // there rather than showing a guess.
  const pkg = await getPackageInfo("litro");
  const version = pkg?.version ?? null;

  // The repository link the site navigation already carries. If the nav has
  // no external entry, the cell is left out.
  const repo = siteConfig.nav.find((item) => !item.href.startsWith("/"));

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
    // ── The status line at the foot ───────────────────────────────────
    //
    // EVERY CELL IS A FACT THE PAGE CAN PROVE. The version comes from the
    // package manifest, the adapter names are the three the docs document,
    // the Node requirement is the repository's own `engines`, and the link is
    // the one already in the site navigation. A cell whose fact is missing is
    // not rendered, and with no cells at all the line renders nothing.
    //
    // This is what the old status bar's tab row should have been. That row
    // showed `lit`, `fast` and `elena` settling from working to done, which
    // looked like live state and was a drawing.
    statusCells: [
      ...(version
        ? [{ state: "done" as const, value: `v${version}` }]
        : []),
      { label: "adapters", value: ADAPTERS, optional: true },
      { label: "node", value: NODE_REQUIREMENT, optional: true },
      ...(repo
        ? [{ value: repo.label.toLowerCase(), href: repo.href, right: true }]
        : []),
    ],
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
     * THE VALUES LIVE IN public/styles/starlight.css, as --brand-* names, in
     * the same light and dark blocks the --sl-* tokens live in. That is what
     * makes this page follow the theme toggle and the system preference — and
     * it is why the toggle works here at all. It used to hard-code a dark
     * palette and a dark color-scheme, so switching to light left the landing
     * page dark while the docs pages changed around it.
     *
     * Every line below is var(--brand-…, <a dark fallback>), so a page that
     * somehow loads without the stylesheet still renders, and a project can
     * override one value without touching this file.
     *
     * THE ACCENT IS NOT WRITTEN HERE. --brand-accent reads --sl-color-accent,
     * which is litro's one orange, so this page and the docs pages cannot
     * drift apart — they did, because this block had #ea580c typed into it
     * while the docs switch to a lighter orange in dark mode.
     */
    :host {
      /* surfaces — the dark ground is TINTED, not flat black; the light one
         is a warm off-white rather than pure white, because the hero is a
         large field of one color and pure white under a wash reads as a
         blown-out photograph. */
      --nova-bg: var(--brand-bg, #0d0e1a);
      --nova-surface: var(--brand-surface, #171a2b);
      --nova-border: var(--brand-border, #2a2e45);

      /* text */
      --nova-text: var(--brand-text, #e9ecfa);
      --nova-text-dim: var(--brand-text-dim, #9aa1bd);

      /* accent — the two sides of the flame.
       *
       * TWO ORANGES, and the reason is contrast. --nova-accent is the site's
       * own, and it is chosen to read as text against the page. It is NOT
       * dark enough to carry white text ON it: white on #ea580c is 3.5:1,
       * under the 4.5:1 a body-sized word needs. So anything that puts words
       * on an orange FIELD — the status line's mode segment, the primary
       * button — takes --nova-accent-high, which the stylesheet derives from
       * the same accent and which clears the ratio in both themes.
       */
      --nova-accent: var(--brand-accent, #ea580c);
      --nova-accent-high: var(--brand-accent-high, #9a3412);
      /* And a third: the accent as small TEXT on the page. On a light ground
         the brand orange reads at about 3.5:1, so the stylesheet darkens it
         there and leaves it alone on a dark one. */
      --nova-accent-text: var(--brand-accent-text, #ea580c);
      --nova-accent-2: var(--brand-accent-2, #38bdf8);

      /* states */
      --nova-error: var(--brand-error, #f87171);
      --nova-blocked: var(--brand-blocked, #fbbf24);
      --nova-working: var(--brand-working, #38bdf8);
      --nova-done: var(--brand-done, #4ade80);
      --nova-idle: var(--brand-idle, #64748b);

      /* layout — 56rem is the width the docs home page has always used */
      --nova-measure: 56rem;
      --nova-gutter: 1.5rem;
      --nova-radius: 0.375rem;
      /* How tall the hero pane is before its content makes it taller. The
         3rem is the status bar above it, so the hero fills exactly what is
         left of the first screen. */
      /* The header above and the status line below both come out of the
         first screen, so the hero fills exactly what is left of it. */
      --nova-hero-min: calc(100svh - 3.5rem - 1.75rem);
      /* The flame is drawn much larger than the recipe's default, because it
         has to HOLD the right of the pane rather than sit near its edge.
         Most of that width is off the edge and cropped away; what is left is
         a shape filling the side, which is the whole point of the crop. */
      --nova-mark-size: clamp(26rem, 62vw, 56rem);
      --nova-mark-size-narrow: clamp(18rem, 86vw, 30rem);
      /* How solid the flame is. A light ground shows far less of a faint
         shape than a dark one, so the value is per theme. */
      --nova-mark-opacity: var(--brand-mark-opacity, 0.11);
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
    /* ── The status line is fixed dark chrome ──────────────────────────
     *
     * The line does NOT follow the reader's light or dark choice, and neither
     * do the docs pages' copies of it: a status line is chrome, not content,
     * and keeping it the same color on every page and in both themes is what
     * makes a reader recognize it as the same object. So the dark set it
     * reads is given to it here, on the element, rather than inherited from a
     * page that now changes with the theme.
     *
     * The accent still comes from the site's own, mixed toward black far
     * enough to carry white text: the mode segment is a white word on it and
     * an accent picked to sit under a page gives about 3.5:1. */
    litro-status-line {
      --nova-bg: #0d0e1a;
      --nova-surface: #171a2b;
      --nova-border: #2a2e45;
      --nova-text: #e9ecfa;
      --nova-text-dim: #9aa1bd;
      --nova-accent: color-mix(in srgb, var(--sl-color-accent) 62%, #000);
      --nova-error: #f87171;
      --nova-blocked: #fbbf24;
      --nova-working: #38bdf8;
      --nova-done: #4ade80;
      --nova-idle: #64748b;
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

    /* The status line at the foot is FIXED, so the page has to leave room for
       it by hand or the closing section sits under it — and the screen it
       fills is that much shorter. */
    .page {
      --status-height: var(--nova-status-height, 1.75rem);
      min-height: calc(100vh - var(--status-height));
      min-height: calc(100svh - var(--status-height));
      padding-bottom: var(--status-height);
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

    /* ── The header ────────────────────────────────────────────────────
     *
     * starlight-header is the DOCS site's header, and it reads the --sl-*
     * tokens, which follow the reader's light or dark choice while this page
     * is dark either way. So the set it needs is given to it here, on the
     * element, exactly as litro-card is dressed above: the docs pages are
     * untouched, the tokens keep their global meaning, and the component's
     * own file does not change.
     *
     * --sl-font-brand is the one token that is not a dressing. It is the
     * header's brand face, and setting it to the mono is what carries the
     * terminal character into a header that is otherwise the docs header,
     * unchanged.
     */
    starlight-header {
      --sl-font-brand: var(--nova-font-mono);
      --sl-color-bg: var(--nova-bg);
      --sl-color-bg-nav: var(--nova-bg);
      --sl-color-text: var(--nova-text);
      --sl-color-gray-2: var(--nova-surface);
      --sl-color-gray-4: var(--nova-text-dim);
      --sl-color-gray-5: var(--nova-text-dim);
      --sl-color-border: var(--nova-border);
      --sl-color-accent: var(--nova-accent);
      --sl-color-accent-low: color-mix(
        in srgb,
        var(--nova-accent) 18%,
        transparent
      );
    }

    /* ── Hero ──────────────────────────────────────────────────────────
     *
     * LEFT, ON A COLUMN. Everything in the hero starts on one line down the
     * left — eyebrow, headline, lede, slab, small print, buttons — so the eye
     * has a spine to run down. The old hero centered all six, which gave
     * every line a different starting point and led nowhere.
     *
     * The column stops well short of the measure, which is what leaves the
     * right of the pane to litro's flame, cropped by the hero's edge.
     */

    /* padding-top and padding-bottom, never the two-value padding shorthand:
       every section below also carries .shell, whose HORIZONTAL padding is
       the page's gutter. A rule like "padding: 4rem 0" is later in this sheet
       at the same specificity, so it would quietly set that gutter to zero
       and let the section run to the edge of a phone. */

    .hero {
      padding-top: 4rem;
      padding-bottom: 4rem;
    }

    .hero-copy {
      max-width: 46rem;
    }

    .eyebrow-pill {
      display: inline-block;
      margin: 0 0 1.5rem;
      padding: 0.3rem 0.9rem;
      border: 1px solid color-mix(in srgb, var(--nova-accent) 50%, transparent);
      border-radius: 9999px;
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--nova-accent-text);
      background: color-mix(in srgb, var(--nova-accent) 10%, transparent);
    }

    /* THE HEADLINE IS SET IN THE MONO FACE — the same one the status bar, the
       state badges, the terminal picture and the command below are set in.
       That is the type idea of this page: it speaks in one voice, and the
       voice is the terminal's. The sans is kept for prose, where it is easier
       to read, and for nothing else.

       It is also a flat color. The gradient fill this heading used to carry
       needed a drop-shadow under it to stay legible over the old hero's
       bright center; with the art quiet and the type doing the work, plain
       --nova-text is both cleaner and higher contrast. */
    .hero h1 {
      font-family: var(--nova-font-mono);
      font-size: clamp(2.75rem, 7vw, 5.5rem);
      font-weight: 700;
      line-height: 1.02;
      letter-spacing: -0.02em;
      margin: 0 0 1.5rem;
      color: var(--nova-text);
    }

    /* The lede keeps its own, narrower measure. The slab below it does not:
       a command has to be read in one piece, so it takes the whole column. */
    .lede {
      font-size: clamp(1.1rem, 1.5vw, 1.3rem);
      color: var(--nova-text-dim);
      max-width: 34rem;
      margin: 0 0 2.5rem;
      line-height: 1.75;
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
      display: block;
      margin: 0 0 2.5rem;
    }

    /* ── Buttons ───────────────────────────────────────────────────────── */

    .actions {
      display: flex;
      gap: 1rem;
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

    .cards {      padding-top: 3rem;
      padding-bottom: 1rem;
    }

    /* ── Feature rows ──────────────────────────────────────────────────── */

    .rows {
      display: flex;
      flex-direction: column;
      gap: 3.5rem;
      padding-top: 3rem;
      padding-bottom: 1rem;
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
      color: var(--nova-accent-text);
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
      color: var(--nova-accent-text);
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
      padding-top: 3rem;
      padding-bottom: 1rem;
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
      padding-top: 4rem;
      padding-bottom: 5rem;
      margin-top: 4rem;
      border-top: 1px solid var(--nova-border);
    }

    .closing h2 {
      font-size: clamp(1.6rem, 4vw, 2.5rem);
      font-weight: 800;
      margin: 0 0 1.5rem;
    }

    .closing litro-install-command {
      display: block;
      max-width: 34rem;
      margin: 0 auto 2rem;
    }

    .closing .actions {
      justify-content: center;
    }
  `;

  override render() {
    const data = this.serverData as SplashData | null;
    const {
      siteTitle = "Litro",
      description = "",
      nav = [],
      features = [],
      statusCells = [],
    } = data ?? {};

    return html`
      <div class="page">
        <!-- THE SAME HEADER THE DOCS PAGES HAVE. The landing page used to
             carry a terminal bar of its own here, which meant a reader met
             two different headers on one site. The terminal character did not
             go away: it moved to the status line at the foot of the window,
             where a status line belongs and where it has a page to describe.

             The wordmark and the links are set in the mono through
             --sl-font-brand, set in the token block above. -->
        <starlight-header
          siteTitle="${siteTitle}"
          .nav="${nav}"
          currentPath="/"
        ></starlight-header>

        <main>
          <litro-hero-nova>
            <!-- Litro's flame, cropped by the hero's right edge and drawn
                 dark. It is atmosphere, not a badge: the page already says
                 the name in the status bar and in the headline. -->
            <img slot="mark" src="/logo.png" alt="" aria-hidden="true" />

            <section class="hero shell">
              <div class="hero-copy">
                <p class="eyebrow-pill">Fullstack Web Framework</p>
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
                <litro-install-command command="${INSTALL_COMMAND}">
                  <span slot="note"
                    >Needs Node 20.19 or newer. Pick a recipe, a rendering mode
                    and an adapter as it runs.</span
                  >
                </litro-install-command>
                <div class="actions">
                  <a href="/docs/introduction" class="button primary"
                    >Get Started</a
                  >
                  <a href="/blog" class="button ghost">Blog</a>
                </div>
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

        <!-- The status line. It is fixed to the foot of the window, so it is
             the last thing in the page and the page carries the padding that
             keeps the closing section clear of it. -->
        <litro-status-line
          siteTitle="${siteTitle}"
          .cells="${statusCells}"
          label="Project status"
        ></litro-status-line>
      </div>
    `;
  }
}

export default SplashPage;
