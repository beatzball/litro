// The shape of a recipe definition
export interface LitroRecipe {
  name: string;                        // CLI identifier, e.g. "11ty-blog"
  displayName: string;                 // Shown in prompt list
  description: string;
  mode: 'ssg' | 'ssr' | 'both';       // "both" = user is prompted to choose
  options?: RecipeOption[];
  contentLayer?: string;               // Relative path to content-layer entry, if any

  /**
   * Name of another recipe whose templates are copied in first.
   *
   * A recipe that extends another owns only what differs from its base, so a
   * shared half (the starlight docs site, say) is never committed twice and
   * cannot drift. Copy order is base `template/`, base `template-<adapter>/`,
   * own `template/`, own `template-<adapter>/` — later layers overwrite
   * earlier ones.
   *
   * ONE LEVEL ONLY. The base must not itself extend a recipe; the scaffolder
   * refuses a deeper chain rather than resolving it, because a three-deep
   * override order is a thing nobody can hold in their head while editing a
   * template.
   */
  extends?: string;
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
