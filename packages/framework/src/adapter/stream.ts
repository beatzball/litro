/**
 * adapter/stream.ts — Framework-agnostic stream utilities
 *
 * Converts an AsyncIterable<string> (the common output of all adapter
 * renderPage() implementations) into a Node.js Readable stream for use
 * with Nitro's sendStream().
 *
 * This replaces the direct dependency on @lit-labs/ssr's RenderResultReadable,
 * which was Lit-specific. The adapter now returns a standard AsyncIterable
 * and this utility handles the Node.js stream plumbing.
 */

import { Readable } from 'node:stream';

/**
 * Converts an AsyncIterable<string> into a Node.js Readable stream.
 *
 * Respects backpressure: pauses iteration when the consumer signals it
 * can't accept more data (highWaterMark reached), and resumes when drained.
 *
 * @param iterable - Async iterable of HTML string chunks.
 * @returns A Node.js Readable that yields the same chunks.
 */
export function iterableToReadable(iterable: AsyncIterable<string>): Readable {
  const iterator = iterable[Symbol.asyncIterator]();
  return new Readable({
    encoding: 'utf-8',
    async read() {
      try {
        const { value, done } = await iterator.next();
        if (done) {
          this.push(null);
        } else {
          this.push(value);
        }
      } catch (err) {
        this.destroy(err as Error);
      }
    },
  });
}
