import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';

/** One link in a footer column. */
export interface FooterLink {
  label: string;
  href: string;
}

/** A column of links, under a heading. */
export interface FooterColumn {
  heading: string;
  links: FooterLink[];
}

/**
 * <litro-site-footer
 *   siteTitle="my-product"
 *   .columns="${COLUMNS}"
 *   credit="Built with Litro"
 *   creditHref="https://litro.dev"
 * ></litro-site-footer>
 *
 * The footer: link columns, then a rule, then the fine print. It replaced a
 * single credit line, which is not a footer — it is a signature.
 *
 * A FOOTER IS THE MAP OF WHAT THE PAGE DID NOT COVER. Both of the sites this
 * page is measured against end with columns of links for exactly that reason:
 * a reader who got to the bottom without finding what they wanted has one more
 * place to look. Build the columns from the same config the navigation comes
 * from, so a link added to the site appears in both.
 *
 * PASS NO COLUMNS AND NO COLUMNS ARE DRAWN — the credit line stands on its
 * own, which is where this started. A project with nothing to list is not made
 * to invent headings.
 *
 * COLORS come from the landing page's token block. This component defines none
 * of its own. Used outside that page, define the `--nova-*` tokens it reads on
 * any ancestor: `--nova-bg`, `--nova-border`, `--nova-text`,
 * `--nova-text-dim`, `--nova-accent`, `--nova-measure`, `--nova-gutter` and
 * `--nova-font-mono`.
 */
@customElement('litro-site-footer')
export class LitroSiteFooter extends LitElement {
  static override properties = {
    siteTitle: { type: String },
    columns: { type: Array },
    credit: { type: String },
    creditHref: { type: String },
    note: { type: String },
  };

  static override styles = css`
    :host {
      display: block;
      background: var(--nova-bg);
      border-top: 1px solid var(--nova-border);
    }

    .shell {
      max-width: var(--nova-measure);
      margin: 0 auto;
      padding: 3rem var(--nova-gutter) 2.5rem;
      box-sizing: border-box;
    }

    .columns {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
      gap: 2rem;
      margin: 0 0 2.5rem;
    }

    /* No columns, no gap above the fine print. An empty grid still has a
       margin; this takes it away rather than leaving a hole. */
    .columns:empty {
      display: none;
    }

    h2 {
      margin: 0 0 0.75rem;
      font-family: var(--nova-font-mono);
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--nova-text);
    }

    ul {
      margin: 0;
      padding: 0;
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    a {
      color: var(--nova-text-dim);
      text-decoration: none;
      font-size: 0.9375rem;
    }

    a:hover {
      color: var(--nova-text);
      text-decoration: underline;
    }

    a:focus-visible {
      outline: 2px solid var(--nova-accent);
      outline-offset: 2px;
      border-radius: 2px;
    }

    .fine {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 1rem;
      flex-wrap: wrap;
      padding-top: 1.5rem;
      border-top: 1px solid var(--nova-border);
      color: var(--nova-text-dim);
      font-size: 0.875rem;
    }

    .name {
      font-family: var(--nova-font-mono);
      font-weight: 700;
      color: var(--nova-text);
    }
  `;

  /** The project's name, in the fine print. */
  siteTitle = '';

  /** The link columns. Empty means none are drawn. */
  columns: FooterColumn[] = [];

  /** The credit line's text, e.g. "Built with Litro". */
  credit = '';

  /** Where the credit links to. */
  creditHref = '';

  /** One more line of fine print: a license, a copyright. */
  note = '';

  override render() {
    const columns = this.columns ?? [];

    return html`
      <footer>
        <div class="shell">
          <div class="columns">
            ${columns.map(
              (column) => html`
                <div>
                  <h2>${column.heading}</h2>
                  <ul>
                    ${column.links.map(
                      (link) =>
                        html`<li><a href="${link.href}">${link.label}</a></li>`,
                    )}
                  </ul>
                </div>
              `,
            )}
          </div>
          <div class="fine">
            <span
              >${this.siteTitle
                ? html`<span class="name">${this.siteTitle}</span>`
                : ''}${this.note ? html` ${this.note}` : ''}</span
            >
            ${this.credit
              ? html`<span
                  >${this.creditHref
                    ? html`<a href="${this.creditHref}">${this.credit}</a>`
                    : this.credit}</span
                >`
              : ''}
          </div>
        </div>
      </footer>
    `;
  }
}

export default LitroSiteFooter;
