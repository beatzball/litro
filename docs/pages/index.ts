import { html, css } from "lit";
import { customElement } from "lit/decorators.js";
import { LitroPage, pageReset } from "@beatzball/litro/runtime";
import { definePageData } from "@beatzball/litro";
import { getGlobalData } from "litro:content";
import { siteConfig } from "../server/starlight.config.js";
import { starlightHead } from "@beatzball/litro-docs-ui/src/route-meta.js";
import { buildSeoHead, buildJsonLd } from "@beatzball/litro-docs-ui/src/seo.js";
import { getPackageInfo } from "@beatzball/litro-docs-ui/src/packages.js";
import { statusLineChrome } from "@beatzball/litro-docs-ui/src/status-line-chrome.js";

// Register components used in render(). The landing page's own parts first...
import "@beatzball/litro-docs-ui/src/components/starlight-header.js";
import "@beatzball/litro-docs-ui/src/components/litro-status-line.js";
import "@beatzball/litro-docs-ui/src/components/litro-pane.js";
import "@beatzball/litro-docs-ui/src/components/litro-pane-grid.js";
import "@beatzball/litro-docs-ui/src/components/litro-site-footer.js";
import "@beatzball/litro-docs-ui/src/components/litro-hero-nova.js";
import "@beatzball/litro-docs-ui/src/components/litro-install-command.js";
import "@beatzball/litro-docs-ui/src/components/litro-feature-row.js";
import "@beatzball/litro-docs-ui/src/components/litro-steps.js";
import "@beatzball/litro-docs-ui/src/components/litro-term-window.js";

// litro-card and litro-card-grid still serve the docs pages; this page no
// longer uses them. Its feature block is panes sharing hairlines, which is
// what both of the sites this page is measured against do.

import type { StepItem } from "@beatzball/litro-docs-ui/src/components/litro-steps.js";
import type { StatusCell } from "@beatzball/litro-docs-ui/src/components/litro-status-line.js";
import type { FooterColumn } from "@beatzball/litro-docs-ui/src/components/litro-site-footer.js";

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

/**
/**
 * ── SECTION · The showcase ─────────────────────────────────────────────
 *
 * WHAT THIS SECTION CLAIMS, AND WHAT IT DOES NOT. Each row is a STARTING
 * POINT — a recipe — and the pictures show the shape that starting point
 * gives you, drawn from real sites built with Litro. It is not a per-site
 * statement about which recipe each one runs, and it must never become one:
 * roost is the site supernova's look was modeled on and is moving onto the
 * recipe, but it does not run it today. Written this way the page stays true
 * before and after that migration, with nothing to change either side of it.
 *
 * Every picture is a real screenshot taken from the running site, lazy-loaded
 * and small. Litro's own site is the only one that ships them; the recipe's
 * page keeps the slots empty, like its logo wall.
 */
const SHOWCASE: Array<{
  name: string;
  meta: string;
  description: string;
  href: string;
  shots: Array<{ src: string; alt: string; site: string; siteHref: string }>;
}> = [
  {
    name: "supernova",
    meta: "landing",
    description:
      "A product landing page in front of a starlight docs site. This page is one.",
    href: "/docs/recipes/supernova",
    shots: [
      {
        src: "/showcase/roost.jpg",
        site: "roost",
        siteHref: "https://roosting.dev",
        alt:
          "The roost home page: a dark landing page with a terminal status bar " +
          "across the top, a large monospaced headline reading “See what every " +
          "agent is doing.”, and a copyable install command.",
      },
      {
        src: "/showcase/litro.jpg",
        site: "litro.dev",
        siteHref: "https://litro.dev",
        alt:
          "The Litro home page: a dark landing page with the Litro wordmark in " +
          "a monospaced face, the flame mark cropped against the right edge, a " +
          "copyable install command, and a terminal status line at the foot.",
      },
    ],
  },
  {
    name: "starlight",
    meta: "docs",
    description:
      "A documentation site with a sidebar, a table of contents and search.",
    href: "/docs/recipes/starlight",
    shots: [
      {
        src: "/showcase/preen.jpg",
        site: "preen",
        siteHref: "https://github.com/beatzball/preen",
        alt:
          "The preen documentation site: a dark page with a left sidebar of " +
          "documentation links and a prose column beside it.",
      },
    ],
  },
  {
    name: "fullstack",
    meta: "app",
    description: "A server-rendered app with API routes and a client router.",
    href: "/docs/recipes/fullstack",
    shots: [
      {
        src: "/showcase/qdoku.jpg",
        site: "qdoku",
        siteHref: "https://qdoku.com",
        alt:
          "The Qdoku puzzle game part way through a round, in its Gem theme: a " +
          "five by five grid of blue, red, green and purple tiles with three " +
          "diamonds placed and nine cells crossed out, a three of five counter " +
          "and three lives above it, and Hint, Undo and Menu buttons below.",
      },
    ],
  },
  {
    name: "11ty-blog",
    meta: "content",
    description: "A Markdown blog on the content layer, with tags and feeds.",
    href: "/docs/recipes/11ty-blog",
    shots: [],
  },
];


/**
 * ── SECTION 7 · Deploy anywhere ────────────────────────────────────────
 *
 * Nitro's deployment presets, which litro inherits whole. Every one of these
 * is a target Nitro documents, not a target litro wrote an adapter for — that
 * is the claim, and it is why the list is this long.
 */
const DEPLOY_TARGETS: Array<{ name: string; icon?: string }> = [
  // A MARK ONLY WHERE A REAL ONE EXISTS. These three come from the icon set
  // the site already serves at /shoelace/assets/icons/ — no new file and no
  // new dependency. The other seven have no mark in anything this site ships,
  // so they are text, because a stand-in glyph would say less than the name
  // already does.
  { name: "Node.js" },
  { name: "Cloudflare Workers" },
  { name: "Vercel" },
  { name: "Netlify" },
  { name: "Deno Deploy" },
  { name: "AWS Lambda", icon: "/shoelace/assets/icons/amazon.svg" },
  { name: "Azure", icon: "/shoelace/assets/icons/microsoft.svg" },
  { name: "Docker" },
  { name: "GitHub Pages", icon: "/shoelace/assets/icons/github.svg" },
  { name: "any static CDN" },
];

/**
 * ── SECTION · Performance ──────────────────────────────────────────────
 *
 * Build time and output size, against Next and Nuxt.
 *
 * EVERY FIGURE IS READ FROM benchmarks/results/latest.json. Nothing here is
 * typed into the page, and a figure the file does not carry is left out
 * rather than guessed — which is why each cell is built from a lookup that
 * can return nothing.
 *
 * The numbers come from the CROSS-FRAMEWORK run, which builds the same
 * minimal site in each framework. The realistic-app run in the same file
 * compares a Hacker News clone, and litro loses output size to Nuxt there;
 * this section does not claim otherwise, it simply is not that measurement.
 * Both are on the benchmarks page, which every figure here links to.
 *
 * PAGE WEIGHT IS DELIBERATELY ABSENT. Litro does not win it today.
 */
interface FrameworkFigure {
  name: string;
  buildMs: number | null;
  outputBytes: number | null;
}

/**
 * ── SECTION 9 · Footer ─────────────────────────────────────────────────
 *
 * The map of everything the page did not cover.
 */
const FOOTER_COLUMNS: FooterColumn[] = [
  {
    heading: "Start",
    links: [
      { label: "Introduction", href: "/docs/introduction" },
      { label: "Getting started", href: "/docs/getting-started" },
      { label: "Configuration", href: "/docs/configuration" },
      { label: "Upgrading", href: "/docs/upgrading" },
    ],
  },
  {
    heading: "Learn",
    links: [
      { label: "Routing", href: "/docs/core-concepts/routing" },
      { label: "SSR", href: "/docs/core-concepts/ssr" },
      { label: "Static generation", href: "/docs/ssg" },
      { label: "Content layer", href: "/docs/content-layer" },
    ],
  },
  {
    heading: "Adapters",
    links: [
      { label: "Overview", href: "/docs/adapters/overview" },
      { label: "Lit", href: "/docs/adapters/lit" },
      { label: "FAST Element", href: "/docs/adapters/fast" },
      { label: "Elena", href: "/docs/adapters/elena" },
    ],
  },
  {
    heading: "Project",
    links: [
      { label: "Blog", href: "/blog" },
      { label: "Compare", href: "/compare" },
      { label: "Benchmarks", href: "/benchmarks" },
      { label: "GitHub", href: "https://github.com/beatzball/litro" },
    ],
  },
];

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
    /** A real mark, where one exists. There is no placeholder icon. */
    iconSrc?: string;
    /** The short note at the right end of the pane's strip. */
    meta?: string;
    /** How many of the grid's six columns the pane takes. */
    span?: number;
  }>;
  seoHead: string;
  statusCells: StatusCell[];
  benchmark: { frameworks: FrameworkFigure[]; ranAt: string | null };
}

/**
 * The three formatters the performance section uses.
 *
 * They are plain functions rather than Intl calls with options because the
 * server renders this page and the client hydrates it, and a number formatted
 * differently in the two places is a hydration mismatch. Fixed rules, same
 * answer everywhere.
 */
function formatSeconds(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

/** The run date, so a reader can tell how old the figures are. */
function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${months[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
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

  // ── The performance figures ──────────────────────────────────────────
  //
  // Read from the benchmark file the benchmarks page reads, by the same
  // route: a dynamic import, so the Node built-ins never reach the browser
  // bundle (CONTENT-008). A missing or unreadable file leaves every figure
  // null and the section renders nothing, which is the right answer — a
  // number this page cannot prove is one it must not show.
  let benchmark: {
    frameworks: FrameworkFigure[];
    ranAt: string | null;
  } = { frameworks: [], ranAt: null };

  try {
    const { readFile } = await import("node:fs/promises");
    const { resolve } = await import("node:path");
    const raw = await readFile(
      resolve(process.cwd(), "..", "benchmarks", "results", "latest.json"),
      "utf-8",
    );
    const parsed = JSON.parse(raw) as {
      meta?: { timestamp?: string };
      crossFramework?: Array<{
        name?: string;
        buildTime?: { median?: number };
        outputSize?: number;
      }>;
    };

    // The order the page shows, not the order the file happens to hold.
    const order = ["litro", "nuxt", "nextjs"];
    const label: Record<string, string> = {
      litro: "Litro",
      nuxt: "Nuxt",
      nextjs: "Next.js",
    };

    benchmark = {
      ranAt: parsed.meta?.timestamp ?? null,
      frameworks: order
        .map((key) => {
          const entry = parsed.crossFramework?.find((f) => f.name === key);
          if (!entry) return null;
          return {
            name: label[key] ?? key,
            buildMs: typeof entry.buildTime?.median === "number"
              ? entry.buildTime.median
              : null,
            outputBytes: typeof entry.outputSize === "number"
              ? entry.outputSize
              : null,
          };
        })
        .filter((f): f is FrameworkFigure => f !== null),
    };
  } catch {
    // No file, or a file this page cannot read. Every figure stays null and
    // the section is not rendered.
  }

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
    // ── Capabilities ────────────────────────────────────────────────
    //
    // Seven panes. The emoji went with the card kit, and the [+] glyph went
    // with them: it reports a STATE, which is what it does in the status line
    // and the terminal windows, and on a wall of capabilities there is no
    // state to report.
    //
    // A pane carries `iconSrc` only where litro has a real mark. Three do —
    // web components, Nitro, and the adapter trio through the Lit flame — and
    // four carry nothing rather than a stand-in.
    //
    // THE "BUILT ON" ROW IS FOLDED IN HERE. It was three thin panels saying
    // what litro stands on, which is not a footnote to the capabilities: it
    // IS one. Web Components and Nitro now carry the sentence that row
    // carried, and Vite, which had no mark and no separate claim, is named in
    // the build pane where a reader meets it.
    //
    // `span` is out of six, so a row is two halves or three thirds. Seven
    // items fill three rows with no orphan.
    features: [
      {
        iconSrc: "/logos/webcomponents.svg",
        title: "Web Components",
        meta: "the standard",
        span: 3,
        description:
          "Custom Elements, Shadow DOM and slots are W3C specifications native to every major browser — the same layer as video, CSS Grid and Fetch. Pick Lit, FAST or Elena on top; the components underneath work anywhere the browser does.",
      },
      {
        iconSrc: "/logos/nitro.svg",
        title: "Nitro Server",
        meta: "the server",
        span: 3,
        description:
          "The same server engine that powers Nuxt. API routes, middleware and every Nitro deployment target, with no Litro adapter in between — and Vite underneath for the client bundle and hot reload.",
      },
      {
        iconSrc: "/logos/lit-flame.svg",
        title: "Adapters",
        meta: "lit · fast · elena",
        span: 2,
        description:
          "Same routing, same data layer, same deployment. Choose the component model and change nothing else.",
      },
      {
        title: "Streaming SSR",
        meta: "dsd",
        span: 2,
        description:
          "Declarative Shadow DOM or light-DOM SSR — each adapter picks the fastest path to first paint.",
      },
      {
        title: "File-System Routing",
        meta: "pages/",
        span: 2,
        description:
          "Pages folder maps directly to URLs. Dynamic segments, catch-alls, nested routes.",
      },
      {
        title: "Content Layer",
        meta: "markdown",
        span: 3,
        description:
          "Markdown content with 11ty-compatible frontmatter and data cascade, prerendered to plain HTML for any CDN.",
      },
      {
        title: "AI Agents",
        meta: "mcp",
        span: 3,
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
    benchmark,
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
  static override styles = [
    pageReset,
    statusLineChrome,
    css`
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
     * makes a reader recognize it as the same object.
     *
     * Its palette is statusLineChrome, imported above and first in this
     * class's style list, so this page and every docs page read one set of
     * values. They used to be typed out in each place and drifted apart. */

    /* ── Page frame ────────────────────────────────────────────────────── */

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

    /* ── Section heads ─────────────────────────────────────────────────
     *
     * A claim and one supporting sentence. Both references open a capability
     * block this way and neither opens one with a label, because a reader who
     * has just left the hero wants to know what they are looking at before
     * they look at it.
     */

    .section-head {
      max-width: 42rem;
      margin: 0 0 1.75rem;
    }

    .section-head .section-title {
      margin: 0 0 0.6rem;
      font-size: clamp(1.4rem, 2.6vw, 2rem);
      line-height: 1.2;
      letter-spacing: -0.01em;
    }

    .section-head p {
      margin: 0;
      color: var(--nova-text-dim);
      line-height: 1.7;
    }

    /* ── Performance ───────────────────────────────────────────────────── */

    .stats {
      padding-top: 3rem;
      padding-bottom: 1rem;
    }

    .stats dl {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
      gap: 1px;
      margin: 0;
      background: var(--nova-border);
      border: 1px solid var(--nova-border);
    }

    .stat {
      padding: 1.25rem 1.25rem 1.5rem;
      background: var(--nova-bg);
    }

    /* Litro's own column is the one the block is about, so it is the one that
       is lit. It is the same move the status line's mode segment makes. */
    .stat-ours {
      background: color-mix(in srgb, var(--nova-accent) 8%, var(--nova-bg));
    }

    .stat dt {
      font-family: var(--nova-font-mono);
      font-size: 0.75rem;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--nova-text-dim);
    }

    .stat-ours dt {
      color: var(--nova-accent-text);
    }

    .stat dd {
      display: grid;
      grid-template-columns: auto 1fr;
      align-items: baseline;
      gap: 0.25rem 0.6rem;
      margin: 0.75rem 0 0;
    }

    .stat .figure {
      font-family: var(--nova-font-mono);
      font-size: clamp(1.5rem, 3vw, 2rem);
      font-weight: 700;
      line-height: 1.1;
      color: var(--nova-text);
    }

    .stat .unit {
      font-size: 0.8125rem;
      color: var(--nova-text-dim);
    }

    .stats-note {
      margin: 1rem 0 0;
      font-size: 0.875rem;
      color: var(--nova-text-dim);
    }

    .stats-note a {
      color: var(--nova-accent-text);
      text-underline-offset: 0.2em;
    }

    /* ── The showcase ──────────────────────────────────────────────────── */

    .showcase {
      padding-top: 3rem;
      padding-bottom: 1rem;
    }

    .showcase-copy {
      margin: 0 0 1rem;
    }

    /* UNDERLINED, not just colored. A link sitting inside a paragraph has to
       be told apart from the words around it by something other than color —
       axe-core reports link-in-text-block when it is not, and a reader who
       cannot see the color has nothing else to go on. The links that stand
       alone, like the ones in the footer columns, do not need this. */
    .showcase-copy a {
      color: var(--nova-accent-text);
      text-decoration: underline;
      text-underline-offset: 0.2em;
      white-space: nowrap;
    }

    .showcase-copy a:hover {
      text-decoration-thickness: 2px;
    }

    /* TWO COLUMNS, ALWAYS — not auto-fit. With auto-fit a row holding one
       screenshot stretched it across the whole pane while a row holding two
       split the same space between them, so the same 800x500 file came out at
       two different sizes and the section read as a collage. A fixed column
       count gives every frame in the block one width, and the fixed aspect
       ratio below gives them all one height.

       On a phone the panes are full width and one column is the readable
       choice; every frame is still the same size as every other. */
    .shots {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.75rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    @media (max-width: 52rem) {
      .shots {
        grid-template-columns: minmax(0, 1fr);
      }
    }

    .shots a {
      display: block;
      color: var(--nova-text-dim);
      text-decoration: none;
    }

    .shots a:focus-visible {
      outline: 2px solid var(--nova-accent);
      outline-offset: 3px;
    }

    /* A small browser frame, drawn in CSS: a bar with three dots and the
       picture under it. It is what makes a screenshot read as a site rather
       than as a rectangle of pixels on the page. */
    .frame {
      display: block;
      border: 1px solid var(--nova-border);
      border-radius: var(--nova-radius);
      overflow: hidden;
      background: var(--nova-surface);
    }

    .frame-bar {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.35rem 0.5rem;
      border-bottom: 1px solid var(--nova-border);
    }

    .frame-bar span {
      width: 0.4rem;
      height: 0.4rem;
      border-radius: 50%;
      background: var(--nova-border);
    }

    .frame img {
      display: block;
      width: 100%;
      height: auto;
      /* The intrinsic size is on the element too, so the row does not jump
         when a lazy-loaded picture arrives. */
      aspect-ratio: 8 / 5;
      object-fit: cover;
    }

    .shots a:hover .frame {
      border-color: var(--nova-accent);
    }

    .shots .site {
      display: block;
      margin-top: 0.4rem;
      font-family: var(--nova-font-mono);
      font-size: 0.75rem;
    }

    /* ── The pane blocks ──────────────────────────────────────────────── */

    .panes {
      padding-top: 3rem;
      padding-bottom: 1rem;
    }

    /* ── SECTION 7 · Deploy anywhere ───────────────────────────────────── */

    .deploy {
      padding-top: 3rem;
      padding-bottom: 1rem;
    }

    .deploy p {
      max-width: 38rem;
      margin: 0 0 1.5rem;
      color: var(--nova-text-dim);
      line-height: 1.7;
    }

    .targets {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .targets li {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.35rem 0.75rem;
      border: 1px solid var(--nova-border);
      border-radius: var(--nova-radius);
      background: var(--nova-surface);
      font-family: var(--nova-font-mono);
      font-size: 0.8125rem;
      color: var(--nova-text);
    }

    /* A MASK, NOT AN IMAGE. These marks are single-path SVGs whose fill is
       currentColor, and an image element gives an external SVG no context to
       resolve that against — it paints black, which on a dark page is
       nothing at all. Painted as a mask over the chip's own color, each mark
       is the chip's text color in either theme and stays one file. */
    .targets .mark {
      width: 0.9rem;
      height: 0.9rem;
      flex-shrink: 0;
      background: currentColor;
      opacity: 0.75;
      -webkit-mask: var(--mark) center / contain no-repeat;
      mask: var(--mark) center / contain no-repeat;
    }

    /* ── SECTION 9 · The footer ────────────────────────────────────────── */

    litro-site-footer {
      margin-top: 4rem;
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
      /* minmax(0, 1fr), not 1fr. A bare 1fr is minmax(auto, 1fr), so the
         track never shrinks below its widest item's content — a long
         transcript line then pushes the column past a phone's screen and the
         page scrolls sideways at the 320px WCAG 1.4.10 reflow width. The 0
         lets the track shrink and the item scroll inside itself instead. */
      grid-template-columns: minmax(0, 1fr);
      gap: 2.5rem;
      padding-top: 3rem;
      padding-bottom: 1rem;
    }

    @media (min-width: 48rem) {
      .start {
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
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
  `,
  ];

  override render() {
    const data = this.serverData as SplashData | null;
    const {
      siteTitle = "Litro",
      description = "",
      nav = [],
      features = [],
      statusCells = [],
      // No data at all means no figures, which the section reads as nothing
      // to show. A missing default here would throw and the page would stream
      // out half-finished.
      benchmark = { frameworks: [], ranAt: null },
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

          <!-- ── Capabilities ─────────────────────────────────────────
               The block opens with a CLAIM, not a label, because a reader who
               has just read the hero wants to know what they are looking at
               before they look at it.

               The panes carry a mark where litro has a real one and nothing
               where it does not — no placeholder glyph. They used to lead with
               [+], which earns its place in the status line and the terminal
               windows, where it reports a state; on a wall of capabilities it
               reported nothing.

               The separate "Built on" row was folded in here: what litro
               stands on and why that matters is a capability, not a footnote,
               and it was too thin to hold a section of its own. -->
          <section class="panes shell" aria-label="What you get">
            <div class="section-head">
              <h2 class="section-title">The web platform, with a server attached.</h2>
              <p>
                Standard custom elements on the front, Nitro on the back, and a
                build that stays out of the way. Nothing here is a Litro
                invention you would have to unlearn somewhere else.
              </p>
            </div>
            <litro-pane-grid>
              ${features.map(
                (f) => html`
                  <litro-pane
                    name="${f.title}"
                    meta="${f.meta ?? ""}"
                    span="${f.span ?? 3}"
                  >
                    ${f.iconSrc
                      ? html`<img
                          slot="icon"
                          src="${f.iconSrc}"
                          alt=""
                          aria-hidden="true"
                        />`
                      : ""}
                    ${f.description}
                  </litro-pane>
                `,
              )}
            </litro-pane-grid>
          </section>

          <!-- ── Performance ──────────────────────────────────────────
               Build time and output size against Next and Nuxt, every figure
               read from benchmarks/results/latest.json. See the note beside
               the loader in pageData: nothing is typed in, a missing figure is
               left out, and with no figures at all the section is not
               rendered. -->
          ${benchmark.frameworks.length > 0
            ? html`
                <section class="stats shell" aria-label="How Litro performs">
                  <div class="section-head">
                    <h2 class="section-title">Faster to build, smaller to ship.</h2>
                    <p>
                      The same minimal site, built in each framework on the same
                      machine. Median of three runs.
                    </p>
                  </div>
                  <dl>
                    ${benchmark.frameworks.map(
                      (fw) => html`
                        <div class="stat${fw.name === "Litro" ? " stat-ours" : ""}">
                          <dt>${fw.name}</dt>
                          <dd>
                            ${fw.buildMs !== null
                              ? html`<span class="figure"
                                    >${formatSeconds(fw.buildMs)}</span
                                  ><span class="unit">build</span>`
                              : ""}
                            ${fw.outputBytes !== null
                              ? html`<span class="figure"
                                    >${formatBytes(fw.outputBytes)}</span
                                  ><span class="unit">output</span>`
                              : ""}
                          </dd>
                        </div>
                      `,
                    )}
                  </dl>
                  <p class="stats-note">
                    ${benchmark.ranAt
                      ? html`Measured ${formatDate(benchmark.ranAt)}. `
                      : ""}<a href="/benchmarks"
                      >Every run, and the ones Litro does not win</a
                    >.
                  </p>
                </section>
              `
            : ""}

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


          <!-- ── The showcase ─────────────────────────────────────────
               Each row is a STARTING POINT and the pictures show the shape it
               gives you, taken from real sites built with Litro. It is not a
               per-site claim about which recipe each one runs — see the note
               beside SHOWCASE for why that distinction is the whole point.

               Every picture is lazy-loaded and carries a real description, so
               the section costs nothing above the fold and reads the same to
               somebody who cannot see it. -->
          <section class="showcase shell" aria-label="Recipes">
            <div class="section-head">
              <h2 class="section-title">Start from a recipe.</h2>
              <!-- ONE LINE AT 1280px, and it has to stay one: the column is
                   capped at 42rem, so a wider screen never rescues it. Every
                   word here is load-bearing — "real Litro sites" is what says
                   the pictures are genuine without claiming which recipe any
                   one of them runs. -->
              <p>
                Four starting points. Screenshots of real Litro sites show each
                shape.
              </p>
            </div>
            <litro-pane-grid>
              ${SHOWCASE.map(
                (item) => html`
                  <litro-pane name="${item.name}" meta="${item.meta}" span="3">
                    <p class="showcase-copy">
                      ${item.description}
                      <a href="${item.href}">Read the recipe</a>
                    </p>
                    ${item.shots.length > 0
                      ? html`
                          <ul class="shots">
                            ${item.shots.map(
                              (shot) => html`
                                <li>
                                  <a href="${shot.siteHref}">
                                    <span class="frame">
                                      <span class="frame-bar" aria-hidden="true">
                                        <span></span><span></span><span></span>
                                      </span>
                                      <img
                                        src="${shot.src}"
                                        alt="${shot.alt}"
                                        width="800"
                                        height="500"
                                        loading="lazy"
                                        decoding="async"
                                      />
                                    </span>
                                    <span class="site">${shot.site}</span>
                                  </a>
                                </li>
                              `,
                            )}
                          </ul>
                        `
                      : ""}
                  </litro-pane>
                `,
              )}
            </litro-pane-grid>
          </section>

          <!-- ── Deploy anywhere ──────────────────────────────────────
               Nitro's deployment presets, which litro inherits whole. A chip
               carries a mark only where a real one exists; see the note beside
               DEPLOY_TARGETS. -->
          <section class="deploy shell" aria-label="Where it runs">
            <h2 class="section-title">Deploy anywhere</h2>
            <p>
              The server is Nitro, so every target Nitro supports is a target
              Litro supports — with no adapter of our own in between. Build for
              one with a single preset, or prerender the whole site and put it
              on a CDN.
            </p>
            <ul class="targets">
              ${DEPLOY_TARGETS.map(
                (target) => html`
                  <li>
                    ${target.icon
                      ? html`<span
                          class="mark"
                          style="--mark: url('${target.icon}')"
                          aria-hidden="true"
                        ></span>`
                      : ""}${target.name}
                  </li>
                `,
              )}
            </ul>
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

        <!-- ── SECTION 9 · Footer ───────────────────────────────────────
             The map of everything the page did not cover. -->
        <litro-site-footer
          siteTitle="${siteTitle}"
          .columns="${FOOTER_COLUMNS}"
          credit="Apache-2.0"
          creditHref="https://github.com/beatzball/litro/blob/main/LICENSE"
          note="— a beatzball project"
        ></litro-site-footer>

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
