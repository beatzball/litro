import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';

/**
 * <litro-footer recipe="starlight"></litro-footer>
 *
 * Credits the framework this project was scaffolded with. The `recipe` value
 * is filled in at scaffold time by create-litro.
 *
 * Deliberately quiet: a credit line belongs at the bottom of the page and
 * should be findable, not compete with the content above it. Delete the
 * element from your pages if you would rather not carry it.
 */
@customElement('litro-footer')
export class LitroFooter extends LitElement {
  static override properties = {
    recipe: { type: String },
  };

  /* Falls back to plain greys so this looks right in a recipe that defines no
     --sl-* design tokens, and picks them up automatically in one that does. */
  static override styles = css`
    :host {
      display: block;
    }

    footer {
      border-top: 1px solid var(--sl-color-border, #e5e5e5);
      padding: 1.5rem;
      text-align: center;
      font-size: var(--sl-text-sm, 0.875rem);
      color: var(--sl-color-gray-4, #6b7280);
    }

    a {
      color: inherit;
      text-decoration: underline;
      text-underline-offset: 2px;
    }

    a:hover {
      color: var(--sl-color-accent, #7c3aed);
    }

    .recipe {
      white-space: nowrap;
    }
  `;

  /** Recipe this project was scaffolded from, e.g. "starlight". */
  recipe = '';

  override render() {
    return html`
      <footer>
        Created using
        <a href="https://litro.dev" target="_blank" rel="noopener">Litro</a>${this
          .recipe
          ? html`<span class="recipe">, ${this.recipe} recipe</span>`
          : ''}
      </footer>
    `;
  }
}

export default LitroFooter;
