// The shape of a recipe definition
export interface LitroRecipe {
  name: string;                        // CLI identifier, e.g. "11ty-blog"
  displayName: string;                 // Shown in prompt list
  description: string;
  mode: 'ssg' | 'ssr' | 'both';       // "both" = user is prompted to choose
  options?: RecipeOption[];
  contentLayer?: string;               // Relative path to content-layer entry, if any
}

export interface RecipeOption {
  key: string;
  prompt: string;
  type: 'select' | 'confirm' | 'text';
  choices?: string[];
  default?: unknown;
}

// Written to the root of every scaffolded project
export interface LitroRecipeManifest {
  recipe: string;                      // e.g. "11ty-blog"
  version: string;                     // recipe semver at time of scaffold
  mode: 'ssg' | 'ssr';
  contentDir?: string;                 // e.g. "content/blog" — configurable
  options: Record<string, unknown>;    // resolved recipe option values
}
