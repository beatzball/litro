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
 * round-trips as a plain element with no DSD (no `shadowrootmode`). We guard
 * against this explicitly below, since a silent no-op render is a much worse
 * failure mode for a tool author than an error.
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

function firstTagName(template: string): string | undefined {
  const match = /^\s*<([a-zA-Z][a-zA-Z0-9-]*)/.exec(template);
  return match?.[1];
}

export async function uiFast(template: string, opts: UiOpts = {}): Promise<UIResult> {
  const templateRenderer = await getTemplateRenderer();
  const result = templateRenderer.render(template);

  let html = '';
  for await (const chunk of result) {
    if (typeof chunk === 'string') html += chunk;
  }

  const tag = firstTagName(template);
  if (tag && html.includes(`<${tag}`) && !html.includes('shadowrootmode')) {
    throw new AgentError(
      `uiFast(): <${tag}> rendered without a declarative shadow root — it is not registered on the ` +
        'server. Import the component module before calling uiFast() so its @customElement definition runs.',
      { status: 500 },
    );
  }

  return {
    type: 'ui',
    html,
    ...(opts.data !== undefined ? { data: opts.data } : {}),
    ...(opts.hydrate !== undefined ? { hydrate: opts.hydrate } : {}),
  };
}
