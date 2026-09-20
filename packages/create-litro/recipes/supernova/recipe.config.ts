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
  extends: 'starlight',
  options: [
    { key: 'blog', prompt: 'Include a blog?', type: 'confirm', default: true },
  ],
};

export default recipe;
