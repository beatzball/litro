import { Elena, html } from '@elenajs/core';

/**
 * <litro-footer recipe="starlight"></litro-footer>
 *
 * Credits the framework this project was scaffolded with. The `recipe` value
 * is filled in at scaffold time by create-litro.
 *
 * Deliberately quiet: a credit line belongs at the bottom of the page and
 * should be findable, not compete with the content above it. Delete the
 * element from your pages if you would rather not carry it.
 *
 * Elena renders into the light DOM, so the styles are @scope-d to the tag
 * rather than isolated by a shadow root, and :scope stands in for :host.
 */
export class LitroFooter extends Elena(HTMLElement) {
  static tagName = 'litro-footer';
  // Lowercase, because HTML parsers lowercase attribute names — a camelCase
  // prop would never bind from markup.
  static props = ['recipe'];

  /** Recipe this project was scaffolded from, e.g. "starlight". */
  recipe = '';

  render() {
    // A plain string, not a nested template: Elena escapes interpolations, so
    // markup passed through here would be shown rather than rendered.
    const suffix = this.recipe ? `, ${this.recipe} recipe` : '';
    return html`
      <style>
        @scope (litro-footer) {
          /* Falls back to plain greys so this looks right in a recipe that
             defines no --sl-* design tokens, and picks them up in one that does. */
          :scope {
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
        }
      </style>
      <footer>
        Created using
        <a href="https://litro.dev" target="_blank" rel="noopener">Litro</a><span class="recipe">${suffix}</span>
      </footer>
    `;
  }
}

LitroFooter.define();

export default LitroFooter;
