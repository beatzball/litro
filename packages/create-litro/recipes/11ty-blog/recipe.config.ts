import type { LitroRecipe } from '../../src/types.js';

const recipe: LitroRecipe = {
  name: '11ty-blog',
  displayName: 'Blog (11ty-compatible content)',
  description: '11ty-compatible Markdown blog with frontmatter, tags, and directory data',
  mode: 'both',
  contentLayer: 'content/blog',

  // No adapter overlay of its own, so Lit is all it can produce.
  adapters: ['lit'],
};

export default recipe;
