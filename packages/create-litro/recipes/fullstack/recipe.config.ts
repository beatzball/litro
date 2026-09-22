import type { LitroRecipe } from '../../src/types.js';

const recipe: LitroRecipe = {
  name: 'fullstack',
  displayName: 'Fullstack App',
  description: 'Full-stack Lit + Nitro app with SSR and blog example pages',
  mode: 'both',

  // template/ (Lit) and template-elena/. There is no FAST overlay.
  adapters: ['lit', 'elena'],
};

export default recipe;
