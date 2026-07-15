/**
 * FAST renderer for `ui()`: server-renders an HTML tag string to DSD via
 * `@microsoft/fast-ssr`'s `templateRenderer`.
 *
 * Per the Task 1 spike (docs/superpowers/specs/2026-07-07-litro-agent-v0-design.md
 * section 10, Q1): a standalone, independently-constructed `templateRenderer`
 * (via `@beatzball/litro/adapter/fast/ssr-init`) renders byte-identical DSD
 * output to the page pipeline's singleton — custom-element registration lives
 * on the global `customElements` registry, not the renderer instance — so
 * this module can safely init its own renderer regardless of whether the page
 * pipeline already ran. Double-init is safe (idempotent enough).
 *
 * Danger: rendering an UNREGISTERED tag does not throw — it silently
 * round-trips as a plain element with no effect. We guard against this
 * explicitly below, since a silent no-op render is a much worse failure mode
 * for a tool author than an error.
 *
 * Registration is checked directly against the DOM shim's global
 * `customElements` registry (populated once the renderer/ssr-init module
 * above has resolved) rather than inferred from DSD presence in the output.
 * A legitimately-registered light-DOM component (`shadowOptions: null`, e.g.
 * `packages/framework/src/adapter/fast/runtime/LitroOutlet.ts`) renders no
 * shadow root at all, so `shadowrootmode` presence/absence is not a valid
 * proxy for "is this registered" — it produced both false positives (valid
 * light-DOM tags flagged as unregistered) and false negatives (checking the
 * whole output for `shadowrootmode` anywhere lets one registered tag's DSD
 * mask a sibling unregistered tag). The tag-name scan of the INPUT template
 * string below is a best-effort lint: it only sees tag names that appear
 * literally in the template, so dynamically-constructed tag names bypass it
 * — acceptable, since the registry check inside the render call itself is
 * not observable from here without deeper renderer integration.
 */
import type { UIResult, UiOpts } from './index.js';
import { AgentError } from '../errors.js';

interface TemplateRenderer {
  render(template: string): AsyncIterable<unknown>;
}

async function getTemplateRenderer(): Promise<TemplateRenderer> {
  const shared = (globalThis as Record<string, unknown>).__litro_fast_template_renderer__;
  if (shared) return shared as TemplateRenderer;
  const mod = await import('@beatzball/litro/adapter/fast/ssr-init');
  return mod.templateRenderer as unknown as TemplateRenderer;
}

function customElementTagNames(template: string): string[] {
  const tags = new Set<string>();
  const re = /<([a-z][a-z0-9]*-[a-z0-9-]*)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(template))) {
    tags.add(match[1]);
  }
  return [...tags];
}

export async function uiFast(template: string, opts: UiOpts = {}): Promise<UIResult> {
  const templateRenderer = await getTemplateRenderer();

  const registry = (globalThis as Record<string, unknown>).customElements as
    | { get(tag: string): unknown }
    | undefined;
  if (registry) {
    for (const tag of customElementTagNames(template)) {
      if (!registry.get(tag)) {
        throw new AgentError(
          `uiFast(): <${tag}> is not registered on the server. Import the component module before ` +
            'calling uiFast() so its @customElement definition runs.',
          { status: 500 },
        );
      }
    }
  }

  const result = templateRenderer.render(template);

  let html = '';
  for await (const chunk of result) {
    if (typeof chunk === 'string') html += chunk;
  }

  return {
    type: 'ui',
    html,
    ...(opts.data !== undefined ? { data: opts.data } : {}),
    ...(opts.hydrate !== undefined ? { hydrate: opts.hydrate } : {}),
  };
}
