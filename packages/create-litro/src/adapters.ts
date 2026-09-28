/**
 * adapters.ts — which adapters a recipe can really produce, and the refusal
 * when a user asks for one it cannot.
 *
 * A recipe DECLARES its adapters in `recipe.config.ts`. This module never
 * looks at which `template-<adapter>/` directories are on disk, because a
 * recipe that extends another inherits its base's overlays: supernova has
 * starlight's FAST overlay in its lineage while having no FAST landing page of
 * its own, and scaffolding that combination produced a mixed app with exit 0.
 *
 * No external dependencies — uses Node.js built-ins only.
 */
import type { LitroAdapter, LitroRecipe } from './types.js';

/** Every adapter the CLI knows, in the order the prompt offers them. */
export const ADAPTERS: readonly LitroAdapter[] = ['lit', 'fast', 'elena'];

/**
 * Adapters that still work but are no longer offered.
 *
 * Deprecated is not removed. `--adapter elena` still resolves through
 * `supportedAdapters()`, still scaffolds, and still builds — a project someone
 * already has must not change. What deprecation costs is the prompt: a user
 * who has not asked for it is never offered it.
 */
export const DEPRECATED_ADAPTERS: readonly LitroAdapter[] = ['elena'];

/** The release that removes the adapters in `DEPRECATED_ADAPTERS`. */
export const REMOVED_IN = 'v1';

/** How each adapter is described in the interactive prompt. */
const ADAPTER_LABELS: Record<LitroAdapter, string> = {
  lit: 'lit — Lit (default)',
  fast: 'fast — Microsoft FAST Element',
  elena: 'elena — Elena (light DOM, deprecated)',
};

/**
 * The adapters `recipe` supports, in prompt order.
 *
 * A recipe config with no `adapters` field falls back to `['lit']` rather than
 * to every adapter. `adapters` is required by the type, so only a hand-written
 * config can reach this, and the quiet answer for one is the default adapter —
 * not permission to build the three combinations nobody checked.
 */
export function supportedAdapters(recipe: LitroRecipe): LitroAdapter[] {
  const declared = recipe.adapters;
  if (!Array.isArray(declared) || declared.length === 0) return ['lit'];
  return ADAPTERS.filter((a) => declared.includes(a));
}

/** True when `recipe` declares `adapter`. */
export function supportsAdapter(recipe: LitroRecipe, adapter: LitroAdapter): boolean {
  return supportedAdapters(recipe).includes(adapter);
}

/** True when `adapter` is deprecated. */
export function isDeprecatedAdapter(adapter: LitroAdapter): boolean {
  return DEPRECATED_ADAPTERS.includes(adapter);
}

/**
 * The adapters `recipe` OFFERS — what it supports, minus what is deprecated.
 *
 * Separate from `supportedAdapters()` on purpose. That function answers "can
 * this recipe produce it", which a deprecated adapter still can, and
 * `assertAdapterSupported()` reads it so `--adapter elena` keeps working. This
 * one answers "should we suggest it", which is the only thing deprecation
 * changes.
 *
 * A recipe whose every adapter is deprecated falls back to the supported list:
 * an empty prompt is worse than a deprecated default.
 */
export function offeredAdapters(recipe: LitroRecipe): LitroAdapter[] {
  const supported = supportedAdapters(recipe);
  const offered = supported.filter((a) => !isDeprecatedAdapter(a));
  return offered.length > 0 ? offered : supported;
}

/** The prompt choices for `recipe`, in the order `ADAPTERS` lists them. */
export function adapterChoices(recipe: LitroRecipe): string[] {
  return offeredAdapters(recipe).map((a) => ADAPTER_LABELS[a]);
}

/**
 * The one-line notice for a deprecated adapter, or `null` for a live one.
 *
 * Printed on stdout, not stderr, and worded as information rather than a
 * failure: the scaffold succeeded, and the app it wrote works.
 */
export function deprecationNotice(adapter: LitroAdapter): string | null {
  if (!isDeprecatedAdapter(adapter)) return null;
  const live = ADAPTERS.filter((a) => !isDeprecatedAdapter(a));
  return (
    `Note: the '${adapter}' adapter is deprecated and will be removed at ${REMOVED_IN}. ` +
    `It still works and existing projects keep working — ${quoteList(live)} are the supported choices.`
  );
}

/** Turn a choice line from `adapterChoices` back into its adapter name. */
export function adapterFromChoice(choice: string): LitroAdapter {
  return ADAPTERS.find((a) => choice.startsWith(a)) ?? 'lit';
}

/** "'lit'", "'lit' and 'elena'", "'lit', 'fast' and 'elena'". */
function quoteList(names: readonly string[]): string {
  const quoted = names.map((n) => `'${n}'`);
  if (quoted.length <= 1) return quoted.join('');
  return `${quoted.slice(0, -1).join(', ')} and ${quoted[quoted.length - 1]}`;
}

/**
 * Refuse an adapter the chosen recipe cannot produce.
 *
 * Scaffolding it anyway is the bug: the user gets an app whose config names
 * one framework and whose first page is written in another, and nothing says
 * so. The message names the recipe, what it does support, and the adapter that
 * was asked for, so the next command is obvious.
 */
export function assertAdapterSupported(recipe: LitroRecipe, adapter: LitroAdapter): void {
  if (supportsAdapter(recipe, adapter)) return;
  const supported = supportedAdapters(recipe);
  const noun = supported.length === 1 ? 'adapter' : 'adapters';
  throw new Error(
    `The '${recipe.name}' recipe supports the ${quoteList(supported)} ${noun} today. ` +
      `Re-run without --adapter, or pick a recipe that supports '${adapter}'.`,
  );
}
