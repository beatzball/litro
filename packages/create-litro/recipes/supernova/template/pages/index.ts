import { html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import { LitroPage } from '@beatzball/litro/runtime';
import { definePageData } from '@beatzball/litro';
import { getGlobalData } from 'litro:content';
import { siteConfig } from '../server/starlight.config.js';
import { starlightHead } from '../src/route-meta.js';

// Register the components used in render(). The landing page's own first...
import '../src/components/litro-hero-nova.js';
import '../src/components/litro-status-line.js';
import '../src/components/litro-install-command.js';
import '../src/components/litro-feature-row.js';
import '../src/components/litro-steps.js';
import '../src/components/litro-key-hints.js';
import '../src/components/litro-state-badge.js';
import '../src/components/litro-term-window.js';

// ...then the ones shared with the docs half of this site.
import '../src/components/starlight-header.js';
import '../src/components/litro-card.js';
import '../src/components/litro-card-grid.js';
import '../src/components/litro-footer.js';

import type { StepItem } from '../src/components/litro-steps.js';
import type { KeyHint } from '../src/components/litro-key-hints.js';
import type { StatusCell } from '../src/components/litro-status-line.js';
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

      /* surfaces — the ground is TINTED, not flat black. A near-black page
         reads as an absence; a deep blue-violet reads as a choice, and it is
         what lets a dark mark bleeding in from the edge still be seen. */
      --nova-bg: var(--brand-bg, #0d0e1a);
      --nova-surface: var(--brand-surface, #171a2b);
      --nova-border: var(--brand-border, #2a2e45);

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
      /* How tall the hero pane is before its content makes it taller. The
         3rem is the status bar above it, so the hero fills exactly what is
         left of the first screen. */
      /* The header above and the status line below both come out of the
         first screen, so the hero fills exactly what is left of it. */
      --nova-hero-min: var(--brand-hero-min, calc(100svh - 3.5rem - 1.75rem));
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

    /* ── Get running ───────────────────────────────────────────────────── */

    .start {
      display: grid;
      grid-template-columns: 1fr;
      gap: 2.5rem;      padding-top: 1rem;
      padding-bottom: 4rem;
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

                 The recipe ships without one on purpose. The hero wants a
                 real logo at a real size; a placeholder shape would only be
                 a smudge on the page of somebody who never replaced it. With
                 nothing slotted the hero is the ground and the wash, and it
                 is finished. -->

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
