import { html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { LitroPage, pageReset } from '@beatzball/litro/runtime';
import { definePageData } from '@beatzball/litro';
import { getGlobalData } from 'litro:content';
import { siteConfig } from '../server/starlight.config.js';
import { starlightHead } from '../src/route-meta.js';
// Ships with this template, and highlight.js is already in its package.json,
// so the section below adds no dependency a scaffolded app does not have.
import { applyHighlighting } from '../src/highlight.js';

// Register the components used in render(). The landing page's own first...
import '../src/components/litro-hero-nova.js';
import '../src/components/litro-status-line.js';
import '../src/components/litro-pane.js';
import '../src/components/litro-pane-grid.js';
import '../src/components/litro-site-footer.js';
import '../src/components/litro-install-command.js';
import '../src/components/litro-feature-row.js';
import '../src/components/litro-steps.js';
import '../src/components/litro-key-hints.js';
import '../src/components/litro-state-badge.js';
import '../src/components/litro-term-window.js';

// ...then the ones shared with the docs half of this site.
import '../src/components/starlight-header.js';
// litro-card, litro-card-grid and litro-footer are the docs half of this
// site's components and they still serve it; this page no longer uses any of
// them. The feature block is panes now, and the credit line grew into a
// footer with columns.

import type { StepItem } from '../src/components/litro-steps.js';
import type { KeyHint } from '../src/components/litro-key-hints.js';
import type { StatusCell } from '../src/components/litro-status-line.js';
import type { FooterColumn } from '../src/components/litro-site-footer.js';
import type { TermRow } from '../src/components/litro-term-window.js';

/**
 * The landing page.
 *
 * Every string on this page is a placeholder. Replace them with your own
 * words — the headings tell you what each one is for. The page renders fully
 * on the server, so all of this copy is readable with JavaScript turned off.
 *
 * The page itself is a thin layout. The parts that do something live in
 * `src/components/`, and they are yours: edit them, restyle them, or delete
 * the ones you do not want.
 */

/** The command a reader copies to install your project. */
const INSTALL_COMMAND = 'npm install playground-supernova';

/**
 * The cells in the status line at the foot of the window.
 *
 * EVERY CELL MUST BE A FACT YOUR PROJECT CAN PROVE. A status line is read as
 * live state, so anything invented in it is a lie told in the most credible
 * place on the page — which is why the row of settling tabs this page used to
 * show at the top is gone. Put in a version you actually publish, a path that
 * actually exists, a link your config actually has. If you have nothing true
 * for a cell, delete the cell; delete them all and the line is not rendered.
 *
 * The two below are true of the site you just scaffolded, and they are meant
 * to be replaced. To add the version, read it in pageData from your own
 * package.json and pass it through, the way `siteTitle` is passed:
 *
 *   { state: 'done', value: 'v' + version }
 *
 * `optional` drops a cell on a narrow screen. A phone has room for the
 * project's name, where you are, and one thing to click.
 */
const STATUS_CELLS: StatusCell[] = [
  { state: 'working', value: 'docs', trailing: '/getting-started', href: '/docs/getting-started' },
  { label: 'built with', value: 'litro', href: 'https://litro.dev', right: true },
];

/** What the line is, for a reader who cannot see it. */
const STATUS_LABEL = 'Project status';

/**
 * The "what it does" rows. Keep the copy here, at the top of the file, so a
 * writer edits one list instead of hunting through the markup below.
 *
 * `figure` is optional, and it fills the row's `figure` slot with a small
 * terminal picture. Give it `rows` for a list of state, age and name, or
 * `shell` for a transcript. `label` is the sentence a screen reader gets
 * instead of the picture, so write a real one. A row with no `figure` is
 * text across the full width.
 */
const HIGHLIGHTS: Array<{
  title: string;
  description: string;
  commands: string[];
  figure?: { label: string; rows?: TermRow[]; shell?: string };
}> = [
  {
    title: 'Name the first thing it does',
    description:
      'One short paragraph on the problem this solves and what a reader gets ' +
      'out of it. Write it for somebody who has never heard of the project.',
    commands: ['playground-supernova init', 'playground-supernova run'],
    figure: {
      label:
        'Three tasks listed by state. deploy is blocked and highlighted, ' +
        'test is working, build is done.',
      rows: [
        { state: 'blocked', age: '4m', name: 'deploy', hot: true },
        { state: 'working', age: '5m', name: 'test' },
        { state: 'done', age: '1m', name: 'build' },
      ],
    },
  },
  {
    title: 'Name the second thing it does',
    description:
      'A second capability, described the same way. Three or four rows is ' +
      'usually enough for a landing page; delete the ones you do not need.',
    commands: ['playground-supernova build'],
    figure: {
      label: 'A shell session: the build runs, prints two lines, and passes.',
      shell: `$ playground-supernova build
reading  12 files
writing  dist/
done in 1.4s`,
    },
  },
  {
    title: 'Name the third thing it does',
    description:
      'The last row is a good place for the thing people ask about most. ' +
      'Link it to the page in the docs that answers the question in full.',
    commands: ['playground-supernova deploy --help'],
  },
];

/** What a reader does, in order, to get from nothing to running. */
const STEPS: StepItem[] = [
  {
    title: 'Install it',
    description: 'One command. Say here what it needs first, if it needs anything.',
  },
  {
    title: 'Point it at your work',
    description: 'The smallest useful thing a reader can do on their own project.',
  },
  {
    title: 'Run it',
    description: 'What they should see when it works, so they know it worked.',
  },
];

/** The keys worth knowing on day one. Delete this list if yours has none. */
const KEY_HINTS: KeyHint[] = [
  { keys: '?', meaning: 'Show every key, without leaving what you are doing' },
  { keys: ['Ctrl', 'C'], meaning: 'Stop the current run' },
  { keys: 'Tab', meaning: 'Move to the next pane' },
  { keys: 'Enter', meaning: 'Accept what is selected' },
];

/**
 * ── SECTION 2 · Proof ──────────────────────────────────────────────────
 *
 * A row of logos: the people already using your project. It is the oldest
 * argument on a landing page and the strongest, which is exactly why it must
 * not be invented — a wall of names nobody agreed to is the one mistake a
 * reader cannot forgive.
 *
 * So this ships EMPTY, with slots that say what goes in them. Fill them with
 * real marks when you have real users, or DELETE THE WHOLE SECTION from
 * render() below. An empty logo wall on a live site says less than no logo
 * wall at all.
 */
const LOGOS = ['Your logo', 'Your logo', 'Your logo', 'Your logo', 'Your logo'];

/**
 * ── SECTION 4 · Built on ───────────────────────────────────────────────
 *
 * What your project stands on, in three panels. It turns "another dependency
 * to learn" into "parts you already know", and every project can fill it on
 * day one: you know what you built this with.
 */
const FOUNDATIONS: Array<{ name: string; meta: string; description: string }> = [
  {
    name: 'First dependency',
    meta: 'what it does',
    description:
      'Name the thing and say, in one sentence, what your project gets from ' +
      'it. A reader who already knows it has just learned half of what you do.',
  },
  {
    name: 'Second dependency',
    meta: 'what it does',
    description:
      'The same again. Three is the usual number: enough to place the ' +
      'project, few enough to read at a glance.',
  },
  {
    name: 'Third dependency',
    meta: 'what it does',
    description:
      'If you only have two, delete this panel and give the other two half ' +
      'the row each.',
  },
];

/**
 * ── SECTION 5 · Proof by number ────────────────────────────────────────
 *
 * Downloads, stars, contributors — whatever you can count. The values below
 * are DASHES on purpose: a number you have not measured is a lie with a
 * decimal point, and a reader who checks one and finds it wrong stops
 * believing the rest of the page.
 *
 * Put real figures in, or delete the section. Do not ship the dashes.
 */
const STATS: Array<{ value: string; label: string }> = [
  { value: '—', label: 'downloads' },
  { value: '—', label: 'stars' },
  { value: '—', label: 'contributors' },
  { value: '—', label: 'releases' },
];

/**
 * ── SECTION 6 · Ecosystem ──────────────────────────────────────────────
 *
 * What your project extends with: templates, plugins, modules, presets. It
 * answers "can I make it do MY thing" without a paragraph.
 */
const ECOSYSTEM: Array<{ name: string; meta: string; description: string; href: string }> = [
  {
    name: 'first-extension',
    meta: 'category',
    description: 'One line on what it adds and who would reach for it.',
    href: '/docs/getting-started',
  },
  {
    name: 'second-extension',
    meta: 'category',
    description: 'Point each of these at a real page in your docs.',
    href: '/docs/getting-started',
  },
  {
    name: 'third-extension',
    meta: 'category',
    description: 'Three is a sample, not a catalog. Link the catalog below.',
    href: '/docs/getting-started',
  },
];

/**
 * ── SECTION 7 · Deploy anywhere ────────────────────────────────────────
 *
 * Where it runs. One claim and a list, because "where does this have to live"
 * is the objection that stops an evaluation dead, and it answers in a glance.
 */
const DEPLOY_TARGETS = [
  'your platform',
  'your platform',
  'your platform',
  'your platform',
  'your platform',
  'your platform',
];

/**
 * ── SECTION 9 · Footer ─────────────────────────────────────────────────
 *
 * The map of everything the page did not cover. Build it from the same config
 * the navigation reads where you can, so a link added to the site turns up in
 * both places.
 */
const FOOTER_COLUMNS: FooterColumn[] = [
  {
    heading: 'Docs',
    links: [
      { label: 'Getting started', href: '/docs/getting-started' },
      { label: 'Installation', href: '/docs/installation' },
      { label: 'Configuration', href: '/docs/configuration' },
    ],
  },
  {
    heading: 'Guides',
    links: [
      { label: 'Your first page', href: '/docs/guides-first-page' },
      { label: 'Deploying', href: '/docs/guides-deploying' },
    ],
  },
  {
    heading: 'Project',
    links: [
      { label: 'Blog', href: '/blog' },
      { label: 'Built with Litro', href: 'https://litro.dev' },
    ],
  },
];

/**
 * ── SECTION 3b · One thing, proved ─────────────────────────────────────
 *
 * THE SECTION A FEATURE LIST CANNOT REPLACE. A list of capabilities tells a
 * reader what a project has. This shows one thing it DOES: a small piece of
 * real code, and the two things it produces — the value a program gets back,
 * and the thing a person sees.
 *
 * Everything below is placeholder, and the code really runs; paste it into a
 * file and call it. REPLACE IT with the smallest real example from your own
 * project. A reader believes a working example in a way they do not believe a
 * paragraph, so the one rule here is that whatever you put in this band has
 * to be true. If you have nothing small enough to show, delete the section
 * rather than inventing an example.
 */
const EXAMPLE_FILE = 'summary.ts';
const EXAMPLE_DIR = 'src/';

const EXAMPLE_SOURCE = `export function summary() {
  const data = {
    label: 'Open tasks',
    count: 12,
    note: '3 due today',
  };
  return {
    data,
    text: \`\${data.label}: \${data.count} (\${data.note})\`,
  };
}`;

/** What a screen reader gets instead of the code picture. */
const EXAMPLE_LABEL =
  'A source file. A summary function builds a plain data object and returns it together with a line of text built from the same fields.';

/** What the function returns, formatted one field to a line. */
const EXAMPLE_DATA = `{
  "label": "Open tasks",
  "count": 12,
  "note": "3 due today"
}`;

/** What a screen reader gets instead of the rendered card. */
const EXAMPLE_CARD_LABEL = 'A card: Open tasks, 12, 3 due today.';

/**
 * The two doors out of the section. Point each at a real page in your docs —
 * a pane whose link goes nowhere is worse than no pane.
 */
const EXAMPLE_DOORS: Array<{ name: string; meta: string; href: string; description: string }> = [
  {
    name: 'How it works',
    meta: 'concepts',
    href: '/docs/getting-started',
    description:
      'One pane for the reader who wants the idea behind the example before they try it. Link it at the page in your docs that explains the model.',
  },
  {
    name: 'Try it',
    meta: 'guide',
    href: '/docs/getting-started',
    description:
      'One pane for the reader who is already convinced. Link it at the shortest path from here to something running on their own machine.',
  },
];

/**
 * Highlights one block SERVER-SIDE, through this template's own
 * `src/highlight.ts` — the same pass the docs and blog pages use.
 *
 * It is called from `definePageData`, never at module scope. The page then
 * reads the same with JavaScript turned off, because the token markup is in
 * the prerendered HTML rather than produced in a browser, and highlight.js
 * stays out of the client bundle because the fetcher never reaches it.
 *
 * `applyHighlighting` takes and returns a whole `<pre><code>` block, so the
 * inner markup is unwrapped here: this page draws its own `<pre>`, which
 * carries the accessible name and the tab stop a scrolling box needs.
 */
function highlightBlock(code: string, lang: string): string {
  const escaped = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const out = applyHighlighting(
    `<pre><code class="language-${lang}">${escaped}</code></pre>`,
  );
  const inner = out.match(/<code class="hljs[^"]*">([\s\S]*)<\/code>/);
  return inner ? inner[1]! : escaped;
}

/** The card the example produces, drawn as a picture and read as one sentence. */
const exampleCard = () => html`
  <div class="ai-card" role="img" aria-label="${EXAMPLE_CARD_LABEL}">
    <span class="ai-card-label">Open tasks</span>
    <span class="ai-card-value">12</span>
    <span class="ai-card-note">3 due today</span>
  </div>
`;

export interface SupernovaData {
  siteTitle: string;
  description: string;
  nav: Array<{ label: string; href: string }>;
  features: Array<{ title: string; description: string; icon?: string }>;
  /** Highlighted server-side; see highlightBlock(). */
  code: { example: string; data: string };
}

export const pageData = definePageData(async (_event) => {
  const metadata = await getGlobalData();
  return {
    siteTitle: String(metadata.title ?? siteConfig.title),
    description: String(metadata.description ?? siteConfig.description),
    nav: siteConfig.nav,
    // ── SECTION 3 · Capabilities ────────────────────────────────────
    //
    // What the project does, one pane each. These are drawn as panes sharing
    // hairlines, not as floating cards, and they carry WORDS rather than
    // pictures: a scaffolded site has no icon that means anything yet, and a
    // decorative emoji beside "Docs" tells a reader nothing they did not
    // already know from the word.
    //
    // `icon` is a PATH, and it is empty on purpose. Put a real mark in it —
    // a dependency's logo, a language's mark — and the pane draws it small
    // before the name. Leave it empty and nothing is drawn; there is no
    // placeholder icon.
    features: [
      {
        icon: '',
        title: 'Docs',
        description: 'Structured documentation with sidebar, TOC, and prev/next navigation.',
      },
      // The Blog pane. create-litro removes it when the blog is declined, and
      // it finds it by the exact object shape below: an `icon` field, then a
      // `title` field whose value is the word Blog. The match lives in
      // create-litro's own blog.ts. Keep the shape if you edit this entry.
      {
        icon: '',
        title: 'Blog',
        description: 'Write posts in Markdown. Tags, dates, and listing pages auto-generated.',
      },
      {
        icon: '',
        title: 'Theming',
        description: 'Light and dark mode via CSS custom properties. Zero JavaScript required.',
      },
      {
        icon: '',
        title: 'Static',
        description: 'Pre-rendered to plain HTML. Deploy to any CDN with no server required.',
      },
    ],
    code: {
      example: highlightBlock(EXAMPLE_SOURCE, 'typescript'),
      data: highlightBlock(EXAMPLE_DATA, 'json'),
    },
  } satisfies SupernovaData;
});

export const routeMeta = {
  head: starlightHead,
  title: 'playground-supernova',
};

@customElement('page-home')
export class SupernovaPage extends LitroPage {
  static override styles = [
    pageReset,
    css`
    /* ── The token block ───────────────────────────────────────────────
     *
     * EDIT THIS BLOCK TO RETHEME THE WHOLE LANDING PAGE. The page and all of
     * its components read these tokens and define no colors of their own, so
     * nothing else has to change.
     *
     * Every value is var(--brand-…, fallback). Set a --brand-… property
     * anywhere above this element — :root in public/styles/starlight.css
     * is the usual place — and the page follows it. Leave it unset and the
     * fallback here applies.
     *
     * THE DOCS HALF OF THIS SITE HAS ITS OWN TOKENS, and they are not these.
     * They are named --sl-* and they are defined in
     * public/styles/starlight.css: --sl-color-bg, --sl-color-text,
     * --sl-color-accent, --sl-color-border, --sl-color-gray-1 to
     * --sl-color-gray-6, --sl-color-note, --sl-color-tip,
     * --sl-color-caution, --sl-color-danger, --sl-font-sans,
     * --sl-font-mono, --sl-text-xs to --sl-text-4xl, --sl-nav-height,
     * --sl-sidebar-width, --sl-toc-width, --sl-content-width,
     * --sl-shadow-sm, --sl-shadow-md, --sl-border-radius and
     * --sl-border-radius-sm. Do not redefine any of those here — the docs
     * pages read them too, and the header on this page is a docs component.
     *
     * THE PAGE FOLLOWS THE READER'S LIGHT OR DARK CHOICE, exactly as the docs
     * half does, because the --brand-* values it reads are defined in the
     * light and dark blocks of public/styles/starlight.css. Change them there
     * and both themes move together; there is no color-scheme declaration
     * here and no dark-only palette, which is what used to leave this page
     * dark when a reader switched to light.
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
      --nova-text-dim: var(--brand-text-dim, #979db8);

      /* accent — TWO of them, and the reason is contrast. --nova-accent is
         the one that reads as text against the page. It is not dark enough
         to carry WHITE text on it, so anything that puts words on an accent
         FIELD — the status line's mode segment, the primary button — takes
         --nova-accent-high, which the stylesheet derives from the same
         accent and which clears 4.5:1 in both themes. */
      --nova-accent: var(--brand-accent, #7c3aed);
      --nova-accent-high: var(--brand-accent-high, #4c1d95);
      /* And a third: the accent as small TEXT on the page. On a light ground
         a brand color usually reads under 4.5:1, so the stylesheet darkens it
         there and leaves it alone on a dark one. */
      --nova-accent-text: var(--brand-accent-text, #7c3aed);
      --nova-accent-2: var(--brand-accent-2, #22d3ee);

      /* states */
      --nova-error: var(--brand-error, #f87171);
      --nova-blocked: var(--brand-blocked, #fbbf24);
      --nova-working: var(--brand-working, #38bdf8);
      --nova-done: var(--brand-done, #4ade80);
      --nova-idle: var(--brand-idle, #64748b);

      /* layout */
      --nova-measure: var(--brand-measure, 64rem);
      --nova-gutter: var(--brand-gutter, 1.5rem);
      --nova-radius: var(--brand-radius, 0.375rem);
      /* How tall the hero pane is before its content makes it taller. The
         3rem is the status bar above it, so the hero fills exactly what is
         left of the first screen. */
      /* The header above and the status line below both come out of the
         first screen, so the hero fills exactly what is left of it. */
      --nova-hero-min: var(--brand-hero-min, calc(100svh - 3.5rem - 1.75rem));
      /* How solid the hero's mark is. A light ground shows far less of a
         faint shape than a dark one, so the value is per theme. */
      --nova-mark-opacity: var(--brand-mark-opacity, 0.11);
      --nova-font-mono: var(
        --brand-font-mono,
        ui-monospace,
        'Cascadia Code',
        'Fira Code',
        monospace
      );
    }


    /* ── Page frame ────────────────────────────────────────────────────── */

    :host {
      display: block;
      background: var(--nova-bg);
      color: var(--nova-text);
    }

    /* The status line at the foot is FIXED, so the page has to leave room for
       it by hand or the credit line sits under it — and the screen it fills
       is that much shorter. */
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
     * starlight-header is the DOCS half of this site's header, and it reads
     * the --sl-* tokens, which follow the reader's light or dark choice while
     * this page is dark either way. So the set it needs is given to it here,
     * on the element, exactly as litro-card is dressed above.
     *
     * --sl-font-brand is the one token that is not a dressing. It is the
     * header's brand face, and setting it to the mono is what carries the
     * terminal character into a header that is otherwise the docs header,
     * unchanged. Delete this one line and the header matches the docs pages'
     * exactly.
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
     * left, so the eye has a spine to run down: headline, lede, slab, small
     * print, buttons. A centered stack has no spine — every line starts
     * somewhere different and nothing leads anywhere.
     *
     * The column stops well short of the measure, which is what leaves the
     * right of the pane to the mark.
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

    /* THE HEADLINE IS SET IN THE MONO FACE — the same one the status bar, the
       badges, the terminal pictures and the command below are set in. That is
       the whole type idea of this page: it speaks in one voice, and the voice
       is the terminal's. The sans is kept for prose, where it is easier to
       read, and for nothing else. */
    .hero h1 {
      font-family: var(--nova-font-mono);
      /* The floor is what a phone gets, and a mono face is wide: at 2rem the
         word "product" alone is most of a 390px column and the headline runs
         off the side. 1.75rem is the largest floor that still lets this
         sentence wrap. */
      font-size: clamp(1.75rem, 5.6vw, 4.25rem);
      font-weight: 700;
      line-height: 1.04;
      letter-spacing: -0.02em;
      margin: 0 0 1.5rem;
      text-wrap: balance;
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
      display: inline-block;
      padding: 0.6rem 1.5rem;
      border-radius: var(--nova-radius);
      font-weight: 600;
      text-decoration: none;
      border: 1px solid transparent;
    }

    .button.primary {
      background: var(--nova-accent);
      color: var(--nova-text);
    }

    .button.ghost {
      border-color: var(--nova-border);
      color: var(--nova-text);
    }

    .button:focus-visible {
      outline: 2px solid var(--nova-accent);
      outline-offset: 2px;
    }

    /* ── Feature rows ──────────────────────────────────────────────────── */

    .rows {
      display: flex;
      flex-direction: column;
      gap: 3.5rem;
      padding-top: 4rem;
      padding-bottom: 4rem;
    }

    /* Shadow DOM styles stop at a slot, so the paragraph handed to a row is
       styled here, by the page, and not inside litro-feature-row. */
    .rows p {
      color: var(--nova-text-dim);
      line-height: 1.7;
      margin: 0;
    }

    /* ── One thing, proved ─────────────────────────────────────────────
     *
     * NO ACCENT IN THIS SECTION AT ALL. Do not add one. A dark panel crossed by one bright rule is a shape a generator
     * reaches for, and it was standing in for work the page's own vocabulary
     * already does.
     *
     * What holds the band together instead is the same thing that holds a
     * litro-pane-grid together — ONE outer rule and SHARED hairlines between
     * cells, so neighbors divide a single object rather than each drawing its
     * own box. The source cell takes the raised surface and the output cells
     * the page ground, which gives the band a lit side and a quiet side
     * without coloring anything.
     *
     * The two outputs are told apart by WHAT THEY ARE, not by a mark beside
     * them: the data is monospace, dim and wrapped in a code block; the card
     * is the real component, in the body face, on its own surface. A reader
     * can see which is which with the captions covered.
     */

    .ai {
      padding-top: 3rem;
      padding-bottom: 1rem;
    }

    .ai figcaption {
      margin: 0 0 0.75rem;
      font-family: var(--nova-font-mono);
      font-size: 0.75rem;
      color: var(--nova-text-dim);
    }

    .ai pre {
      margin: 0;
      font-family: var(--nova-font-mono);
      font-size: 0.8125rem;
      line-height: 1.7;
      color: var(--nova-text);
    }

    /* The card the example produces. Its own surface and its own type, on
       the page rather than inside a terminal, because a thing a person sees
       is the point being made. */
    .ai-card {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      max-width: 16rem;
      padding: 1rem;
      border: 1px solid var(--nova-border);
      border-radius: 0.5rem;
      background: var(--nova-surface);
      font-family: system-ui, sans-serif;
      line-height: 1.4;
    }

    .ai-card-label {
      font-weight: 600;
      color: var(--nova-text);
    }

    .ai-card-value {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--nova-text);
    }

    .ai-card-note {
      color: var(--nova-text-dim);
    }

    /* ── The band ─────────────────────────────────────────────────────── */

    .ai-band {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      border: 1px solid var(--nova-border);
      border-radius: var(--nova-radius);
      background: var(--nova-bg);
      overflow: hidden;
    }

    /* The cells SHARE a hairline: the source draws the rule on its own
       trailing edge and nothing else draws one, so the band is one object
       with divisions rather than boxes pushed together. */
    .ai-band-src {
      min-width: 0;
      background: var(--nova-surface);
      border-bottom: 1px solid var(--nova-border);
    }

    @media (min-width: 60rem) {
      .ai-band {
        grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
      }

      .ai-band-src {
        border-bottom: 0;
        border-right: 1px solid var(--nova-border);
      }
    }

    /* The strip is litro-pane's title strip, and it belongs to the BAND — it
       is inside the outer rule, on the source cell's own surface, divided
       from the code by a hairline. A label floating above the band would be
       the eyebrow this section is trying not to have. */
    .ai-strip-bar {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 1rem;
      padding: 0.55rem 1.2rem;
      border-bottom: 1px solid var(--nova-border);
      font-family: var(--nova-font-mono);
      font-size: 0.8125rem;
    }

    .ai-strip-name {
      font-weight: 700;
      color: var(--nova-text);
    }

    .ai-strip-meta {
      color: var(--nova-text-dim);
    }

    /* The source is the only box here that can outrun its cell, so it is the
       only one that scrolls — and a region that scrolls has to be reachable
       without a pointer (WCAG 2.1.1), which is what the tab stop and the
       accessible name on the <pre> are for. */
    .ai-band-src pre {
      padding: 1.1rem 1.2rem;
      overflow-x: auto;
    }

    .ai-band-src pre:focus-visible {
      outline: 2px solid var(--nova-text);
      outline-offset: -2px;
    }

    .ai-band-split {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
    }

    .ai-half {
      margin: 0;
      min-width: 0;
      padding: 1.25rem 1.2rem;
      border-top: 1px solid var(--nova-border);
    }

    .ai-half:first-child {
      border-top: 0;
    }

    /* NEVER WRAPS MID-TOKEN. The object is written one field to a line and
       the longest of them is twenty characters, so it fits at every width
       this page supports and the box never becomes a scroll region. */
    .ai-half-model pre {
      white-space: pre;
      color: var(--nova-text-dim);
    }

    .ai litro-pane-grid {
      display: block;
      margin-top: 2.5rem;
    }

    /* ── Syntax highlighting ───────────────────────────────────────────
     *
     * Produced on the SERVER by applyHighlighting() — the same highlight.js
     * pass the blog posts use — so the tokens are in the prerendered HTML and
     * a reader with JavaScript off sees exactly this.
     *
     * FOUR ROLES, and the rule behind them is: color marks a VALUE or a
     * KEYWORD, and a name stays plain. Strings take the page's second accent,
     * numbers and keywords its first, comments the dim text color, and
     * everything else — identifiers, property names, punctuation — is left
     * alone. A stock highlight.js theme paints a dozen roles in colors chosen
     * against some other palette; this is a landing page, and every color
     * here is a token this page already defines in both themes.
     */
    .hljs {
      background: transparent;
      color: var(--nova-text);
    }

    .hljs-comment,
    .hljs-quote {
      color: var(--nova-text-dim);
      font-style: italic;
    }

    .hljs-keyword,
    .hljs-literal,
    .hljs-number,
    .hljs-built_in {
      color: var(--nova-accent-text);
    }

    .hljs-string,
    .hljs-template-tag,
    .hljs-regexp,
    .hljs-symbol {
      color: var(--nova-accent-2);
    }

    /* A substitution inside a template literal is code again, not string, so
       it steps back out of the string color. Without this the whole html
       template reads as one flat block and the substitution disappears into it. */
    .hljs-subst {
      color: var(--nova-text);
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
      gap: 2.5rem;      padding-top: 1rem;
      padding-bottom: 4rem;
    }

    @media (min-width: 48rem) {
      .start {
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        gap: 4rem;
      }
    }

    /* ── SECTION 2 · The logo wall ──────────────────────────────────────
     *
     * Empty slots, drawn as dashed outlines so they read as places for
     * something rather than as content. They are text, not images: a
     * scaffolded site has no logo to show and a gray box pretending to be one
     * is worse than a sentence saying so.
     */

    .logos {
      padding-top: 3rem;
      padding-bottom: 1rem;
    }

    .eyebrow {
      margin: 0 0 1.25rem;
      font-family: var(--nova-font-mono);
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--nova-text-dim);
    }

    .logo-wall {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .logo-wall li {
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 8rem;
      height: 3rem;
      padding: 0 1rem;
      border: 1px dashed var(--nova-border);
      border-radius: var(--nova-radius);
      color: var(--nova-text-dim);
      font-size: 0.875rem;
    }

    /* ── SECTIONS 3, 4, 6 · The pane blocks ───────────────────────────── */

    .panes {
      padding-top: 3rem;
      padding-bottom: 1rem;
    }

    /* Shadow DOM styles stop at a slot, so a pane's body text is styled by
       the pane and the page needs nothing here. */

    /* ── SECTION 5 · The stats row ─────────────────────────────────────── */

    .stats {
      padding-top: 3rem;
      padding-bottom: 1rem;
    }

    .stats dl {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
      gap: 1px;
      margin: 0;
      background: var(--nova-border);
      border: 1px solid var(--nova-border);
    }

    .stat {
      display: flex;
      flex-direction: column-reverse;
      gap: 0.35rem;
      padding: 1.5rem 1rem;
      background: var(--nova-bg);
    }

    .stat dt {
      font-family: var(--nova-font-mono);
      font-size: 0.75rem;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--nova-text-dim);
    }

    .stat dd {
      margin: 0;
      font-family: var(--nova-font-mono);
      font-size: clamp(1.75rem, 4vw, 2.5rem);
      font-weight: 700;
      line-height: 1;
      color: var(--nova-text);
    }

    /* ── SECTION 6 · The showcase ──────────────────────────────────────
     *
     * The picture slots, drawn as dashed frames so they read as places for
     * something rather than as content — the same decision the logo wall
     * makes, for the same reason.
     */

    .showcase {
      padding-top: 3rem;
      padding-bottom: 1rem;
    }

    .showcase-copy {
      margin: 0 0 1rem;
    }

    /* UNDERLINED, not just colored. A link sitting inside a paragraph has to
       be told apart from the words around it by something other than color. */
    .showcase-copy a {
      color: var(--nova-accent-text);
      text-decoration: underline;
      text-underline-offset: 0.2em;
      white-space: nowrap;
    }

    .showcase-copy a:hover {
      text-decoration-thickness: 2px;
    }

    .shots {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
      gap: 0.75rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    /* A small browser frame. With a picture in it, put an img here and give
       the frame a bar of three dots, the way litro.dev's own page does. */
    .frame {
      display: flex;
      align-items: center;
      justify-content: center;
      aspect-ratio: 8 / 5;
      border: 1px dashed var(--nova-border);
      border-radius: var(--nova-radius);
      color: var(--nova-text-dim);
      font-size: 0.8125rem;
    }

    /* ── SECTION 7 · Deploy anywhere ───────────────────────────────────── */

    .deploy {
      padding-top: 3rem;
      padding-bottom: 1rem;
    }

    .deploy p {
      max-width: 34rem;
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
      padding: 0.35rem 0.75rem;
      border: 1px solid var(--nova-border);
      border-radius: var(--nova-radius);
      background: var(--nova-surface);
      font-family: var(--nova-font-mono);
      font-size: 0.8125rem;
      color: var(--nova-text);
    }

    /* ── SECTION 9 · The footer ────────────────────────────────────────── */

    litro-site-footer {
      margin-top: 4rem;
    }

    /* ── Section headings and closing ──────────────────────────────────── */

    .section-title {
      font-size: 1.5rem;
      font-weight: 700;
      margin: 0 0 1.25rem;
    }

    .cards {
      padding: 0 0 4rem;
    }

    .closing {
      text-align: center;
      padding-top: 4rem;
      padding-bottom: 5rem;
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
    const data = this.serverData as SupernovaData | null;
    const {
      siteTitle = 'playground-supernova',
      description = '',
      nav = [],
      features = [],
      // Highlighted on the server. With no page data there is no markup to
      // put in, and an empty block renders an empty box rather than throwing.
      code = { example: '', data: '' },
    } = data ?? {};

    // The Blog button. create-litro deletes it when the blog is declined, and
    // repoints it at the repository under `--for-repo`. It finds the button by
    // matching the anchor below exactly: the href it points at, and the word
    // Blog as its text. The match lives in create-litro's own blog.ts, so keep
    // the anchor's shape if you edit the button.
    //
    // It is held in its own binding for the same reason: deleting the anchor
    // then leaves an empty template rather than a hole in the markup.
    //
    // The status bar's Blog link is a different thing and needs no rule: it
    // is rendered from the site navigation, so dropping that entry from
    // server/starlight.config.js takes the link with it. This button is the
    // page's own call to action, written by hand, which is why it is matched
    // by hand.
    const blogButton = html`<a href="/blog" class="button ghost">Blog</a>`;

    return html`
      <div class="page">
        <!-- THE SAME HEADER THE DOCS HALF OF THIS SITE HAS. This page used
             to carry a terminal bar of its own here, and a reader met two
             different headers on one site. The terminal character did not go
             away: it moved to the status line at the foot of the window,
             where a status line belongs and where it has a page to describe.

             The wordmark and the links are set in the mono through
             --sl-font-brand, in the token block above. That is the whole of
             the difference between this header and the docs pages' one. -->
        <starlight-header
          siteTitle="${siteTitle}"
          .nav="${nav}"
          currentPath="/"
        ></starlight-header>

        <main>
          <litro-hero-nova>
            <!-- YOUR MARK GOES HERE. Put an element with slot="mark" on
                 this line — an inline SVG, or an image from public/ — and the
                 hero crops it against its right edge. Mark it aria-hidden:
                 it is atmosphere, and the page already says your project's
                 name in the status bar and in the headline. The component's
                 own file has the details.

                 Until you do, the hero draws the recipe's own mark: the
                 ejecta, a spray of shards thrown out of a point off the
                 right edge, in your accent. It is the slot's fallback, so
                 the moment you slot a mark of your own it goes away by
                 itself. There is nothing to delete here. -->

            <section class="hero shell">
              <div class="hero-copy">
                <h1>Say what your product does, in one line.</h1>
                <p class="lede">
                  ${description ||
                  'Two sentences on who it is for and why it is worth their time. ' +
                    'Keep it concrete: this is the only paragraph most readers finish.'}
                </p>
                <litro-install-command command="${INSTALL_COMMAND}">
                  <!-- One line of small print: what the command needs first,
                       or what it will not do. Delete it and the line goes. -->
                  <span slot="note"
                    >Say what it needs before it will run — a runtime, a
                    version, an account.</span
                  >
                </litro-install-command>
                <div class="actions">
                  <a href="/docs/getting-started" class="button primary">Get Started</a>
                  ${blogButton}
                </div>
              </div>
            </section>
          </litro-hero-nova>

          ${
            // Video section — a short recording of what the product does.
            //
            // This recipe ships no clip, so the section is left out rather
            // than pointing at a file that is not there. To turn it on: put
            // your recording and its poster frame in `public/demo/`, add the
            // import below to the TOP of this file next to the other
            // component imports, and uncomment the markup.
            //
            //   import '../src/components/litro-hero-video.js';
            //
            // `sources` is a property, not an attribute, so it is set with
            // `.sources` — a plain attribute would arrive as a string and the
            // element would show the poster and nothing else. List the
            // encodings you have; the browser takes the first it can play.
            //
            // <litro-hero-video
            //   poster="/demo/poster.jpg"
            //   label="What the tool does, in 15 seconds"
            //   .sources="${[
            //     { src: '/demo/clip.webm', type: 'video/webm' },
            //     { src: '/demo/clip.mp4', type: 'video/mp4' },
            //   ]}"
            // >
            //   <span slot="caption">A short caption.</span>
            // </litro-hero-video>
            ''
          }

          <!-- ── SECTION 2 · Proof ────────────────────────────────────
               The people already using your project, as a row of marks.

               IT SHIPS EMPTY, and the slots say so. Put real logos in — an
               image or an inline vector per slot — or DELETE THIS SECTION.
               Never put a name in here that did not agree to be here; a wall
               of borrowed logos is the one mistake a reader does not forgive.

               A COMMENT IN A LIT TEMPLATE IS RENDERED INTO THE PAGE, so this
               text ships to every visitor. That is why it names no tags: the
               words "less than i m g" in here would have made the recipe's
               own "asks for no image" test fail, which is how this was
               found. -->
          <section class="logos shell" aria-label="Who uses it">
            <p class="eyebrow">Used by</p>
            <ul class="logo-wall">
              ${LOGOS.map((label) => html`<li>${label}</li>`)}
            </ul>
          </section>

          <section class="rows shell" aria-label="What it does">
            ${HIGHLIGHTS.map(
              (row) => html`
                <litro-feature-row
                  class="row"
                  heading="${row.title}"
                  .commands="${row.commands}"
                >
                  <p>${row.description}</p>
                  <!-- The picture goes in the "figure" slot. A row whose
                       HIGHLIGHTS entry has no figure of its own gets none,
                       and lays itself out across the full width. -->
                  ${row.figure
                    ? html`
                        <litro-term-window
                          slot="figure"
                          label="${row.figure.label}"
                          .rows="${row.figure.rows ?? []}"
                        >
                          ${row.figure.shell
                            ? html`<pre>${row.figure.shell}</pre>`
                            : ''}
                        </litro-term-window>
                      `
                    : ''}
                </litro-feature-row>
              `,
            )}
          </section>

          <section class="start shell" aria-label="Get running">
            <div>
              <h2 class="section-title">Get running</h2>
              <litro-steps .steps="${STEPS}"></litro-steps>
            </div>
            <div>
              <h2 class="section-title">Keys worth knowing</h2>
              <litro-key-hints .hints="${KEY_HINTS}"></litro-key-hints>
            </div>
          </section>

          <!-- ── SECTION 3 · Capabilities ─────────────────────────────
               What the project does. Panes sharing hairlines, not cards: a
               block that reads as one object with divisions rather than a
               scatter of floating boxes.

               The panes are two per row on a wide screen and one per row on a
               phone. Change the span attribute to 3 for halves, 2 for thirds;
               the grid is six columns wide. -->
          <section class="panes shell" aria-label="What you get">
            <h2 class="section-title">What ${siteTitle} ships with</h2>
            <litro-pane-grid>
              ${features.map(
                (f) => html`
                  <litro-pane
                    name="${f.title}"
                    state="done"
                    span="3"
                  >
                    ${f.icon
                      ? html`<img slot="icon" src="${f.icon}" alt="" aria-hidden="true" />`
                      : ''}
                    ${f.description}
                  </litro-pane>
                `,
              )}
            </litro-pane-grid>
          </section>

          <!-- ── SECTION 3b · One thing, proved ───────────────────────
               ONE BAND, NOT THREE BOXES. The cells share hairlines and the
               block carries a single outer rule, the way litro-pane-grid
               draws a wall of panes; the source cell sits on the raised
               surface and the two output cells on the page ground, so the
               band has a lit side and a quiet side. There is no accent stripe
               and no eyebrow: a panel crossed by one bright rule is a shape
               every generated page reaches for, and the structure already
               says what it was saying.

               The strip is INSIDE the band and carries the file name, which
               is why the source does not repeat it as a comment.

               DELETE THIS SECTION if you have no small true example to put in
               it. An invented one costs more than an empty space. -->
          <section class="ai shell" aria-label="One thing it does">
            <div class="section-head">
              <h2 class="section-title">Name the thing only you do.</h2>
              <p>
                One claim, one small example, and what it produces. Swap the
                code below for something your project really runs — a working
                example persuades where a list of features does not.
              </p>
            </div>
            <div class="ai-band">
              <div class="ai-band-src">
                <div class="ai-strip-bar">
                  <span class="ai-strip-name">${EXAMPLE_FILE}</span>
                  <span class="ai-strip-meta">${EXAMPLE_DIR}</span>
                </div>
                <pre role="img" tabindex="0" aria-label="${EXAMPLE_LABEL}"><code class="hljs">${unsafeHTML(code.example)}</code></pre>
              </div>
              <div class="ai-band-split">
                <figure class="ai-half ai-half-model">
                  <figcaption>A program gets</figcaption>
                  <pre><code class="hljs">${unsafeHTML(code.data)}</code></pre>
                </figure>
                <figure class="ai-half ai-half-reader">
                  <figcaption>A reader sees</figcaption>
                  ${exampleCard()}
                </figure>
              </div>
            </div>
            <litro-pane-grid>
              ${EXAMPLE_DOORS.map(
                (d) => html`
                  <litro-pane
                    name="${d.name}"
                    meta="${d.meta}"
                    span="3"
                    href="${d.href}"
                    >${d.description}</litro-pane
                  >
                `,
              )}
            </litro-pane-grid>
          </section>

          <!-- ── SECTION 4 · Built on ─────────────────────────────────
               What the project stands on. Every project can fill this on the
               day it is scaffolded, which is why it ships with real structure
               and placeholder names rather than empty slots.

               DELETE THIS SECTION if you would rather not name your
               dependencies. -->
          <section class="panes shell" aria-label="What it is built on">
            <h2 class="section-title">Built on</h2>
            <litro-pane-grid>
              ${FOUNDATIONS.map(
                (item) => html`
                  <litro-pane
                    name="${item.name}"
                    meta="${item.meta}"
                    span="2"
                    >${item.description}</litro-pane
                  >
                `,
              )}
            </litro-pane-grid>
          </section>

          <!-- ── SECTION 5 · Proof by number ──────────────────────────
               Downloads, stars, contributors. The values are DASHES until you
               measure them — see the note beside STATS.

               DELETE THIS SECTION until you have numbers. A row of dashes on
               a live site says less than no row at all. -->
          <section class="stats shell" aria-label="The project in numbers">
            <dl>
              ${STATS.map(
                (stat) => html`
                  <div class="stat">
                    <dt>${stat.label}</dt>
                    <dd>${stat.value}</dd>
                  </div>
                `,
              )}
            </dl>
          </section>

          <!-- ── SECTION 6 · Ecosystem, and the showcase ──────────────
               What the project extends with, and what each one looks like.

               THE PICTURE SLOTS SHIP EMPTY, like the logo wall above. Drop a
               screenshot of a real site into each one — anything under
               public/ — or delete the list and keep the text. An empty frame
               on a live site says less than no frame at all.

               WHAT A ROW CLAIMS: it is a starting point, and the pictures
               show the shape it gives you. Keep it that way and you never
               have to argue about which site runs which version of what.

               DELETE THIS SECTION if your project has no extensions yet. -->
          <section class="showcase shell" aria-label="The ecosystem">
            <h2 class="section-title">Extend it</h2>
            <litro-pane-grid>
              ${ECOSYSTEM.map(
                (item) => html`
                  <litro-pane name="${item.name}" meta="${item.meta}" span="2">
                    <p class="showcase-copy">
                      ${item.description}
                      <a href="${item.href}">Read more</a>
                    </p>
                    <ul class="shots">
                      <li><span class="frame frame-empty">Your screenshot</span></li>
                    </ul>
                  </litro-pane>
                `,
              )}
            </litro-pane-grid>
          </section>

          <!-- ── SECTION 7 · Deploy anywhere ──────────────────────────
               Where it runs. One claim and a list, because "where does this
               have to live" is the objection that stops an evaluation dead.

               DELETE THIS SECTION if your project is not something a reader
               deploys. -->
          <section class="deploy shell" aria-label="Where it runs">
            <h2 class="section-title">Deploy anywhere</h2>
            <p>
              One sentence on where your project can run, and what it needs
              from the place it runs in.
            </p>
            <ul class="targets">
              ${DEPLOY_TARGETS.map((target) => html`<li>${target}</li>`)}
            </ul>
          </section>

          <section class="closing shell">
            <h2>One line that asks the reader to start.</h2>
            <litro-install-command
              command="${INSTALL_COMMAND}"
            ></litro-install-command>
            <div class="actions">
              <a href="/docs/getting-started" class="button primary">Read the docs</a>
            </div>
          </section>
        </main>

        <!-- ── SECTION 9 · Footer ───────────────────────────────────────
             The map of everything the page did not cover. Pass no columns and
             only the fine print is drawn, which is where this started: one
             credit line. -->
        <litro-site-footer
          siteTitle="${siteTitle}"
          .columns="${FOOTER_COLUMNS}"
          credit="Created using Litro"
          creditHref="https://litro.dev"
          note="— the supernova recipe"
        ></litro-site-footer>

        <!-- The status line. It is fixed to the foot of the window, so it is
             the last thing in the page and .page carries the padding that
             keeps the credit line clear of it. -->
        <litro-status-line
          siteTitle="${siteTitle}"
          .cells="${STATUS_CELLS}"
          label="${STATUS_LABEL}"
        ></litro-status-line>
      </div>
    `;
  }
}

export default SupernovaPage;
