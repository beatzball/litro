import { FASTElement, html, css, when } from '@microsoft/fast-element';

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
export class LitroFooter extends FASTElement {
  /** Recipe this project was scaffolded from, e.g. "starlight". */
  recipe = '';
}

// when() rather than a ternary. Both render correctly under fast-ssr; this is
// the form the other components in this template use, so it stays consistent.
const template = html<LitroFooter>`
  <footer>
    Created using
    <a href="https://litro.dev" target="_blank" rel="noopener">Litro</a>${when(
      x => x.recipe,
      html<LitroFooter>`<span class="recipe">, ${x => x.recipe} recipe</span>`,
    )}
  </footer>
`;

/* Falls back to plain greys so this looks right in a recipe that defines no
   --sl-* design tokens, and picks them up automatically in one that does. */
const styles = css`
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

// `attributes` declares `recipe` as a real HTML attribute, which also makes it
// observable — so no separate Observable.defineProperty is needed.
//
// It does NOT make `recipe="..."` work during SSR: fast-ssr does not map
// attributes onto properties, so the pages bind the property directly
// (:recipe="${() => '...'}"). Measured — with a plain attribute the credit
// renders without the recipe name. The declaration is still worth having: it
// makes the element behave as expected if someone hand-writes it in a browser.
//
// Declared here rather than with @attr, because this file is loaded by jiti
// during the page scan, where the decorator does not apply.
LitroFooter.define({ name: 'litro-footer', template, styles, attributes: ['recipe'] });

export default LitroFooter;
