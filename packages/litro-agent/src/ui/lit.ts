/**
 * Lit renderer for `ui()`: server-renders a `TemplateResult` to a DSD HTML
 * string via `@lit-labs/ssr`. `collectResult` is only available via the
 * deep import below — it's not re-exported from the package root.
 */
import type { TemplateResult } from 'lit';
import { render } from '@lit-labs/ssr';
import { collectResult } from '@lit-labs/ssr/lib/render-result.js';
import type { UIResult, UiOpts } from './index.js';

export async function uiLit(template: TemplateResult, opts: UiOpts = {}): Promise<UIResult> {
  const result = render(template);
  const html = await collectResult(result);
  return {
    type: 'ui',
    html,
    ...(opts.data !== undefined ? { data: opts.data } : {}),
    ...(opts.hydrate !== undefined ? { hydrate: opts.hydrate } : {}),
  };
}
