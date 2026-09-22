import type { LitroRecipe } from '../../src/types.js';

const recipe: LitroRecipe = {
  name: 'starlight',
  displayName: 'Starlight (docs + blog)',
  description: 'Astro Starlight-inspired docs and blog site with Lit web components',
  mode: 'ssg',
  contentLayer: 'content',

  // template/ (Lit), template-fast/ and template-elena/ — all three.
  adapters: ['lit', 'fast', 'elena'],
};

export default recipe;
