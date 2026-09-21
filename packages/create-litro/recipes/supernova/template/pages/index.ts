import { html, css, type TemplateResult } from 'lit';
import { customElement } from 'lit/decorators.js';
import { LitroPage } from '@beatzball/litro/runtime';
import { definePageData } from '@beatzball/litro';
import { getGlobalData } from 'litro:content';
import { siteConfig } from '../server/starlight.config.js';
import { starlightHead } from '../src/route-meta.js';

// Register components used in render()
import '../src/components/starlight-header.js';
import '../src/components/litro-footer.js';
import '../src/components/litro-card.js';
import '../src/components/litro-card-grid.js';

/**
 * The landing page.
 *
 * Every string on this page is a placeholder. Replace them with your own
 * words — the headings tell you what each one is for. The page renders fully
 * on the server, so all of this copy is readable with JavaScript turned off.
 *
 * This is the first phase of the supernova recipe: it is built only from the
 * components the starlight recipe already ships. The dedicated landing-page
 * components (an install command with a copy button, feature rows, numbered
 * steps, key hints and the hero art) arrive in a later release, and this page
 * is rewritten on top of them then.
 */

/** The command a reader copies to install your project. */
const INSTALL_COMMAND = 'npm install {{projectName}}';

/**
 * The "what it does" rows. Keep the copy here, at the top of the file, so a
 * writer edits one list instead of hunting through the markup below.
 */
const HIGHLIGHTS: Array<{
  title: string;
  description: string;
  commands: string[];
}> = [
  {
    title: 'Name the first thing it does',
    description:
      'One short paragraph on the problem this solves and what a reader gets ' +
      'out of it. Write it for somebody who has never heard of the project.',
    commands: ['{{projectName}} init', '{{projectName}} run'],
  },
  {
    title: 'Name the second thing it does',
    description:
      'A second capability, described the same way. Three or four rows is ' +
      'usually enough for a landing page; delete the ones you do not need.',
    commands: ['{{projectName}} build'],
  },
  {
    title: 'Name the third thing it does',
    description:
      'The last row is a good place for the thing people ask about most. ' +
      'Link it to the page in the docs that answers the question in full.',
    commands: ['{{projectName}} deploy --help'],
  },
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
    :host {
      display: block;
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
      max-width: 64rem;
      margin: 0 auto;
      padding: 0 1.5rem;
      width: 100%;
    }

    /* ── Hero ──────────────────────────────────────────────────────────── */

    .hero {
      text-align: center;
      padding: 5rem 0 4rem;
    }

    .hero h1 {
      font-size: clamp(2rem, 5vw, 3.5rem);
      font-weight: 800;
      line-height: 1.1;
      color: var(--sl-color-text);
      margin: 0 0 1rem;
    }

    .lede {
      font-size: var(--sl-text-xl, 1.25rem);
      color: var(--sl-color-gray-4, #6b7280);
      max-width: 38rem;
      margin: 0 auto 2rem;
      line-height: 1.6;
    }

    /* ── Install command ───────────────────────────────────────────────── */

    .install {
      display: inline-flex;
      align-items: center;
      gap: 0.6rem;
      max-width: 100%;
      overflow-x: auto;
      padding: 0.7rem 1.1rem;
      margin: 0 0 2rem;
      border: 1px solid var(--sl-color-border, #e8e8e8);
      border-radius: var(--sl-border-radius, 0.375rem);
      background: var(--sl-color-bg-nav, #f6f6f7);
      font-family: var(--sl-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
      font-size: var(--sl-text-sm, 0.875rem);
      text-align: left;
    }

    .install .prompt {
      color: var(--sl-color-accent, #7c3aed);
      user-select: none;
    }

    .install code {
      white-space: nowrap;
      color: var(--sl-color-text);
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
      border-radius: var(--sl-border-radius, 0.375rem);
      font-weight: 600;
      font-size: var(--sl-text-base, 1rem);
      text-decoration: none;
      border: 1px solid transparent;
    }

    .button.primary {
      background: var(--sl-color-accent, #7c3aed);
      color: var(--sl-color-text-invert, #fff);
    }

    .button.ghost {
      border-color: var(--sl-color-border, #e8e8e8);
      color: var(--sl-color-text);
    }

    .button:focus-visible {
      outline: 2px solid var(--sl-color-accent, #7c3aed);
      outline-offset: 2px;
    }

    /* ── Feature rows ──────────────────────────────────────────────────── */

    .rows {
      display: flex;
      flex-direction: column;
      gap: 2.5rem;
      padding: 1rem 0 4rem;
    }

    .row h2 {
      font-size: var(--sl-text-2xl, 1.5rem);
      font-weight: 700;
      color: var(--sl-color-text);
      margin: 0 0 0.5rem;
    }

    .row p {
      color: var(--sl-color-gray-4, #6b7280);
      line-height: 1.7;
      margin: 0 0 0.9rem;
      max-width: 44rem;
    }

    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .chips li {
      padding: 0.25rem 0.6rem;
      border: 1px solid var(--sl-color-border, #e8e8e8);
      border-radius: var(--sl-border-radius, 0.375rem);
      background: var(--sl-color-bg-nav, #f6f6f7);
      font-family: var(--sl-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
      font-size: var(--sl-text-sm, 0.875rem);
      color: var(--sl-color-text);
    }

    /* ── Section headings and closing ──────────────────────────────────── */

    .section-title {
      font-size: var(--sl-text-2xl, 1.5rem);
      font-weight: 700;
      color: var(--sl-color-text);
      margin: 0 0 1.25rem;
    }

    .closing {
      text-align: center;
      padding: 4rem 0 5rem;
      border-top: 1px solid var(--sl-color-border, #e8e8e8);
      margin-top: 4rem;
    }

    .closing h2 {
      font-size: clamp(1.6rem, 4vw, 2.5rem);
      font-weight: 800;
      color: var(--sl-color-text);
      margin: 0 0 1.5rem;
    }
  `;

  private installCommand(): TemplateResult {
    return html`
      <p class="install">
        <span class="prompt" aria-hidden="true">$</span>
        <code>${INSTALL_COMMAND}</code>
      </p>
    `;
  }

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
    // Reading the page's links from the site navigation config instead — so
    // that dropping one entry removes every Blog link at once — arrives with
    // the landing-page components in a later release.
    const blogButton = html`<a href="/blog" class="button ghost">Blog</a>`;

    return html`
      <div class="page">
        <starlight-header
          siteTitle="${siteTitle}"
          .nav="${nav}"
          currentPath="/"
        ></starlight-header>

        <main>
          <section class="hero shell">
            <h1>Say what your product does, in one line.</h1>
            <p class="lede">
              ${description ||
              'Two sentences on who it is for and why it is worth their time. ' +
                'Keep it concrete: this is the only paragraph most readers finish.'}
            </p>
            ${this.installCommand()}
            <div class="actions">
              <a href="/docs/getting-started" class="button primary">Get Started</a>
              ${blogButton}
            </div>
          </section>

          <section class="rows shell" aria-label="What it does">
            ${HIGHLIGHTS.map(
              (row) => html`
                <article class="row">
                  <h2>${row.title}</h2>
                  <p>${row.description}</p>
                  <ul class="chips">
                    ${row.commands.map((command) => html`<li>${command}</li>`)}
                  </ul>
                </article>
              `,
            )}
          </section>

          <section class="shell" aria-label="What you get">
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
            ${this.installCommand()}
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
