/**
 * Tool and app fixtures the MCP server's tests share.
 *
 * A file rather than a block in one test, because three suites need the same
 * ones and the hygiene cases (a tool that throws, one that returns a string,
 * one that returns something enormous, one that hangs) are the rows of section
 * 14 — they belong in one place so a row cannot be tested in one suite and
 * forgotten in another.
 */
import { defineTool } from '../index.js';
import type { StandardSchemaV1, ToolDefinition } from '../index.js';
import type { PackedApp } from './apps.js';

/** A schema with NO JSON Schema converter — the shape the repo's own demo tool
 *  has, and the one that publishes `{ type: 'object' }`. */
export function handRolledSchema<T>(validate: (v: unknown) => { value: T } | { issues: { message: string }[] }): StandardSchemaV1<unknown, T> {
  return {
    '~standard': { version: 1, vendor: 'litro-test', validate: validate as never },
  } as StandardSchemaV1<unknown, T>;
}

/** A schema that DOES convert, so `tools/list` publishes a real `inputSchema`.
 *  Hand-written rather than pulled from zod: the point under test is that this
 *  server reads `~standard.jsonSchema.input`, not that zod implements it. */
export function convertingSchema(): StandardSchemaV1<unknown, { city: string }> {
  const schema = handRolledSchema<{ city: string }>((v) => {
    const o = v as Record<string, unknown> | null;
    if (!o || typeof o !== 'object' || typeof o.city !== 'string' || o.city === '') {
      return { issues: [{ message: 'city is required' }] };
    }
    return { value: { city: o.city } };
  });
  (schema['~standard'] as unknown as Record<string, unknown>).jsonSchema = {
    input: (options: { target: string }) => ({
      $schema:
        options.target === 'draft-07'
          ? 'http://json-schema.org/draft-07/schema#'
          : 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      properties: { city: { type: 'string', description: 'City name', maxLength: 80 } },
      required: ['city'],
    }),
    output: () => ({ type: 'object' }),
  };
  return schema;
}

const anything = handRolledSchema<Record<string, unknown>>((v) => ({
  value: (v ?? {}) as Record<string, unknown>,
}));

export const HUGE_FIELD_BYTES = 4096;

/** The html a UIResult fixture carries. Asserted ABSENT from every wire
 *  message, which is AGENT-002 and the thing most likely to go wrong quietly. */
export const FIXTURE_UI_HTML = '<demo-card><template shadowrootmode="open">SECRET-MARKUP</template></demo-card>';

export function fixtureTools(): Map<string, ToolDefinition> {
  return new Map<string, ToolDefinition>([
    [
      'get-weather',
      defineTool({
        description: 'Current weather for a city.',
        input: convertingSchema(),
        app: 'weather-card',
        execute: ({ city }) => ({ city, tempC: 21, summary: 'sunny' }),
      }),
    ],
    [
      'hidden-from-model',
      defineTool({
        description: 'Callable only by the app.',
        input: anything,
        app: { name: 'weather-card', visibility: ['app'] },
        execute: () => ({ ok: true }),
      }),
    ],
    [
      'no-converter',
      defineTool({
        description: 'A tool whose schema vendor cannot describe it.',
        input: anything,
        execute: () => ({ ok: true }),
      }),
    ],
    [
      'renders-ui',
      defineTool({
        description: 'Returns a UIResult.',
        input: anything,
        app: 'weather-card',
        execute: () => ({ type: 'ui' as const, html: FIXTURE_UI_HTML, data: { city: 'Lisbon', tempC: 21 } }),
      }),
    ],
    [
      'throws',
      defineTool({
        description: 'Throws.',
        input: anything,
        execute: () => {
          throw new Error('upstream is down');
        },
      }),
    ],
    [
      'returns-a-string',
      defineTool({
        description: 'Returns a bare string.',
        input: anything,
        execute: () => 'ok',
      }),
    ],
    [
      'returns-an-array',
      defineTool({
        description: 'Returns a bare array.',
        input: anything,
        execute: () => [1, 2, 3],
      }),
    ],
    [
      'returns-something-enormous',
      defineTool({
        description: 'Returns far more than any host wants.',
        input: anything,
        execute: () => ({ blob: 'x'.repeat(HUGE_FIELD_BYTES) }),
      }),
    ],
    [
      'hangs',
      defineTool({
        description: 'Never finishes.',
        input: anything,
        // Unref'd so a test that gives up does not hold vitest open.
        execute: () =>
          new Promise(() => {
            const t = setTimeout(() => {}, 60_000);
            (t as { unref?: () => void }).unref?.();
          }),
      }),
    ],
    [
      'nests-a-ui-result',
      defineTool({
        description: 'Buries a UIResult inside a plain object.',
        input: anything,
        execute: () => ({ card: { type: 'ui' as const, html: FIXTURE_UI_HTML, data: { a: 1 } } }),
      }),
    ],
    [
      'streams',
      defineTool({
        description: 'An async generator tool; only its final value is the result.',
        input: anything,
        execute: async function* () {
          yield { progress: 1 };
          yield { progress: 2 };
          return { done: true };
        },
      }),
    ],
  ]);
}

/** One packed app, in the shape `litro mcp-app build` writes. */
export function fixtureApps(): PackedApp[] {
  return [
    {
      name: 'weather-card',
      html: '<!doctype html><html><body>PACKED-DOCUMENT-BYTES</body></html>\n',
      descriptor: {
        uri: 'ui://fixture/weather-card',
        name: 'weather-card',
        mimeType: 'text/html;profile=mcp-app',
        _meta: { ui: { prefersBorder: true } },
      },
    },
  ];
}
