/**
 * ssr.ts — thin abstraction over @lit-labs/ssr
 *
 * Single responsibility: this is the ONLY file in the entire Litro codebase
 * that imports from @lit-labs/ssr. Isolating the import here means:
 *   1. A single place to update if the @lit-labs/ssr API changes.
 *   2. Easier mocking in tests — stub renderToStream, not the entire package.
 *   3. Clear boundary: nothing else needs to know about @lit-labs/ssr internals.
 *
 * The render() function from @lit-labs/ssr returns an AsyncIterable<string>
 * (backed by an async generator). Chunks are yielded progressively as the
 * template tree is traversed depth-first — naturally streaming-compatible.
 *
 * IMPORTANT: The async generator output is a one-shot stream. It cannot be
 * consumed more than once. Every request must call renderToStream() fresh.
 */

import { render } from '@lit-labs/ssr';
import type { RenderResult } from '@lit-labs/ssr';
import type { TemplateResult } from 'lit';

/**
 * Renders a Lit TemplateResult to a streaming AsyncIterable<string>.
 *
 * The returned iterable yields HTML string chunks that together form the
 * fully-rendered Declarative Shadow DOM output for the given template.
 *
 * Usage:
 *   const stream = renderToStream(html`<my-page></my-page>`);
 *   for await (const chunk of stream) { res.write(chunk); }
 *
 * @param template - A Lit TemplateResult produced by the html`` tagged template.
 * @returns An AsyncIterable<string> of HTML chunks.
 */
export function renderToStream(template: TemplateResult): RenderResult {
  return render(template);
}
