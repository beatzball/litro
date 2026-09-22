import { html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import { LitroPage } from '@beatzball/litro/runtime';
import { definePageData } from '@beatzball/litro';
import { getGlobalData } from 'litro:content';
import { siteConfig } from '../server/starlight.config.js';
import { starlightHead } from '../src/route-meta.js';

// Register the components used in render(). The landing page's own first...
import '../src/components/litro-hero-nova.js';
import '../src/components/litro-install-command.js';
import '../src/components/litro-feature-row.js';
import '../src/components/litro-steps.js';
import '../src/components/litro-key-hints.js';
import '../src/components/litro-state-badge.js';
import '../src/components/litro-status-bar.js';
import '../src/components/litro-term-window.js';

// ...then the ones shared with the docs half of this site.
import '../src/components/litro-card.js';
import '../src/components/litro-card-grid.js';
import '../src/components/litro-footer.js';

import type { StepItem } from '../src/components/litro-steps.js';
import type { KeyHint } from '../src/components/litro-key-hints.js';
import type { StatusTab } from '../src/components/litro-status-bar.js';
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
const INSTALL_COMMAND = 'npm install {{projectName}}';

/**
 * The tabs in the status bar, left to right.
 *
 * They are a picture of your project at work, not live data: every badge
 * settles from `from` to `state` after `delay` seconds, with a CSS animation
 * and no script, and `prefers-reduced-motion` shows them settled from the
 * first frame. Say what the row shows in TABS_LABEL — that sentence is the
 * only thing a screen reader gets.
 *
 * Delete both and the bar renders with no tab row at all.
 */
const TABS: StatusTab[] = [
  { name: 'build', state: 'done', from: 'working', delay: 1.6, current: true },
  { name: 'test', state: 'working' },
  { name: 'deploy', state: 'blocked', from: 'working', delay: 1.0 },
  { name: 'docs', state: 'idle', from: 'working', delay: 2.6 },
];

/** What the tab row shows, in one sentence, for a reader who cannot see it. */
const TABS_LABEL =
  'Four tasks: build is done, test is working, deploy is blocked, docs is idle.';

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
    commands: ['{{projectName}} init', '{{projectName}} run'],
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
    commands: ['{{projectName}} build'],
    figure: {
      label: 'A shell session: the build runs, prints two lines, and passes.',
      shell: `$ {{projectName}} build
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
    commands: ['{{projectName}} deploy --help'],
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

export interface SupernovaData {
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
      // The Blog card. create-litro removes this card when the blog is
      // declined, and it finds the card by the exact object shape below: an
      // `icon` field, then a `title` field whose value is the word Blog. The
      // match lives in create-litro's own blog.ts. Keep the shape if you edit
      // the card.
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
  } satisfies SupernovaData;
});

export const routeMeta = {
  head: starlightHead,
  title: '{{projectName}}',
};

@customElement('page-home')
export class SupernovaPage extends LitroPage {
  static override styles = css`
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
     * The landing page is dark whatever the reader's light or dark choice is,
     * the way a product page usually is, while the docs follow that choice. To
     * make the landing page follow it too, delete the color-scheme line
     * below and point the surface and text tokens at the --sl-* names.
     */
    :host {
      color-scheme: dark;

      /* surfaces */
      --nova-bg: var(--brand-bg, #08090f);
      --nova-surface: var(--brand-surface, #12141f);
      --nova-border: var(--brand-border, #262a3d);

      /* text */
      --nova-text: var(--brand-text, #e9ecfa);
      --nova-text-dim: var(--brand-text-dim, #979db8);

      /* accent */
      --nova-accent: var(--brand-accent, #7c3aed);
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
      --nova-font-mono: var(
        --brand-font-mono,
        ui-monospace,
        'Cascadia Code',
        'Fira Code',
        monospace
      );
    }

    /* ── Dressing the docs components for a dark page ──────────────────
     *
     * The cards and the credit line are the DOCS site's components. They read
     * the --sl-* tokens, and those follow the reader's light or dark choice,
     * while this page is dark either way. Left alone, the cards are white
     * boxes on a black page.
     *
     * So the --sl-* tokens are set HERE, ON THOSE ELEMENTS. That dresses them
     * for this page only: the docs pages are untouched, the tokens keep their
     * global meaning, and neither component's own file changes.
     *
     * The header is no longer in this list. This page has litro-status-bar,
     * which reads the --nova-* tokens directly and needs no dressing.
     */

    /* The credit line reads four tokens, and these are the three that carry a
       color. --sl-text-sm is a size and is right as it stands. */
    litro-footer {
      --sl-color-gray-4: var(--nova-text-dim);
      --sl-color-border: var(--nova-border);
      --sl-color-accent: var(--nova-accent);
    }

    /* A card is a raised pane, so it takes the surface token, not the page
       background. Its four rotating top borders take the state colors. */
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

    /* ── The status bar's slotted links ────────────────────────────────
     *
     * The bar's navigation is a slot, so the links below are written by this
     * page and keep this page's styles. litro-status-bar sizes and colors
     * them with ::slotted(); there is nothing left for the page to do, and
     * this comment is here so the next editor knows where to look.
     */

    /* ── Hero ──────────────────────────────────────────────────────────── */

    .hero {
      text-align: center;
      padding: 5rem 0 4.5rem;
    }

    .hero h1 {
      font-size: clamp(2rem, 5vw, 3.5rem);
      font-weight: 800;
      line-height: 1.1;
      margin: 0 0 1rem;
    }

    .lede {
      font-size: 1.15rem;
      color: var(--nova-text-dim);
      max-width: 38rem;
      margin: 0 auto 2rem;
      line-height: 1.6;
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
      padding: 4rem 0;
    }

    /* Shadow DOM styles stop at a slot, so the paragraph handed to a row is
       styled here, by the page, and not inside litro-feature-row. */
    .rows p {
      color: var(--nova-text-dim);
      line-height: 1.7;
      margin: 0;
    }

    /* ── Get running ───────────────────────────────────────────────────── */

    .start {
      display: grid;
      grid-template-columns: 1fr;
      gap: 2.5rem;
      padding: 1rem 0 4rem;
    }

    @media (min-width: 48rem) {
      .start {
        grid-template-columns: 1fr 1fr;
        gap: 4rem;
      }
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
      padding: 4rem 0 5rem;
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
    const data = this.serverData as SupernovaData | null;
    const {
      siteTitle = '{{projectName}}',
      description = '',
      nav = [],
      features = [],
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
        <!-- The landing page's own header, in place of the docs site's
             starlight-header. It takes the SAME title and the SAME links the
             docs header shows, from the same place — server/starlight.config.js,
             through pageData below — so a reader moving between the landing
             page and the docs sees one site. -->
        <litro-status-bar
          siteTitle="${siteTitle}"
          .tabs="${TABS}"
          tabsLabel="${TABS_LABEL}"
        >
          <!-- The same mark as the hero's, drawn small. One symbol, twice. -->
          <svg slot="mark" viewBox="0 0 64 64" aria-hidden="true">
            <circle cx="32" cy="32" r="18" fill="none" stroke="currentColor" stroke-width="5" />
            <circle cx="32" cy="32" r="7" fill="currentColor" />
          </svg>
          ${nav.map(
            (item) => html`<a slot="nav" href="${item.href}">${item.label}</a>`,
          )}
        </litro-status-bar>

        <main>
          <litro-hero-nova>
            <!-- Your mark goes here. It is drawn faded and centered behind
                 the words. Drop in your own SVG, or delete the element. -->
            <svg slot="mark" viewBox="0 0 64 64" role="img" aria-label="">
              <circle cx="32" cy="32" r="18" fill="none" stroke="currentColor" stroke-width="3" />
              <circle cx="32" cy="32" r="5" fill="currentColor" />
            </svg>

            <section class="hero shell">
              <h1>Say what your product does, in one line.</h1>
              <p class="lede">
                ${description ||
                'Two sentences on who it is for and why it is worth their time. ' +
                  'Keep it concrete: this is the only paragraph most readers finish.'}
              </p>
              <litro-install-command
                command="${INSTALL_COMMAND}"
              ></litro-install-command>
              <div class="actions">
                <a href="/docs/getting-started" class="button primary">Get Started</a>
                ${blogButton}
              </div>
            </section>
          </litro-hero-nova>

          ${
            // Video section. The component ships in the next phase as <litro-hero-video>.
            // Drop your own clip in, then uncomment:
            // <litro-hero-video poster="/demo/poster.jpg" label="What the tool does, in 15 seconds">
            //   <span slot="caption">A short caption.</span>
            // </litro-hero-video>
            ''
          }

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

          <section class="cards shell" aria-label="What you get">
            <h2 class="section-title">What ${siteTitle} ships with</h2>
            <litro-card-grid>
              ${features.map(
                (f) => html`
                  <litro-card
                    icon="${f.icon ?? ''}"
                    title="${f.title}"
                    description="${f.description}"
                  ></litro-card>
                `,
              )}
            </litro-card-grid>
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

        <!-- Credit line. Delete this element if you would rather not carry it. -->
        <litro-footer recipe="{{recipe}}"></litro-footer>
      </div>
    `;
  }
}

export default SupernovaPage;
