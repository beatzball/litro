/** The component frameworks a scaffolded app can be built with. */
export type LitroAdapter = 'lit' | 'fast' | 'elena';

// The shape of a recipe definition
export interface LitroRecipe {
  name: string;                        // CLI identifier, e.g. "11ty-blog"
  displayName: string;                 // Shown in prompt list
  description: string;
  mode: 'ssg' | 'ssr' | 'both';       // "both" = user is prompted to choose
  options?: RecipeOption[];
  contentLayer?: string;               // Relative path to content-layer entry, if any

  /**
   * The adapters this recipe can really produce an app for.
   *
   * DECLARED, NEVER INFERRED. Inferring support from which `template-<adapter>/`
   * directories exist is what produced the bug this field was added for: a
   * recipe that extends another inherits the base's overlays, so supernova
   * looked like it supported FAST because starlight's overlay sat in the
   * lineage. The scaffold that came out was configured for FAST with a Lit
   * landing page on top, and exited 0.
   *
   * Asking for an adapter that is not in this list is refused before anything
   * is written. When a recipe gains an overlay, adding the adapter here is the
   * only change needed to lift that refusal.
   */
  adapters: LitroAdapter[];

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
