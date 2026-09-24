import type { LitroRecipe } from '../../src/types.js';

/**
 * supernova — the starlight docs site, with a product landing page in front.
 *
 * `extends: 'starlight'` means this recipe's template holds ONLY what differs.
 * The docs half, the blog and the shared components are copied in first, from
 * the starlight recipe, and this template overwrites the home page on top.
 * Nothing that starlight already ships is committed here a second time.
 */
const recipe: LitroRecipe = {
  name: 'supernova',
  displayName: 'Supernova (landing page + docs + blog)',
  description: 'A product landing page and a docs site, built from web components',
  mode: 'ssg',
  contentLayer: 'content',

  /**
   * Lit only, until phase 7 of design/specs/2026-09-17-supernova-recipe.md
   * adds this recipe's own FAST and Elena overlays.
   *
   * The starlight overlays in the lineage are NOT enough. They swap the docs
   * half over, then this recipe's template puts its Lit landing page and its
   * nine Lit components back on top. When the overlays land here, add the
   * adapter names to this list and nothing else.
   */
  adapters: ['lit'],

  extends: 'starlight',
  options: [
    { key: 'blog', prompt: 'Include a blog?', type: 'confirm', default: true },
  ],
};

export default recipe;
