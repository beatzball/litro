import { describe, it, expect } from 'vitest';
import type { StandardSchemaV1 } from '@beatzball/litro/actions';
import { toolInputJSONSchema } from './json-schema.js';

const validate = (value: unknown) => ({ value });

/** A vendor that implements the Standard JSON Schema converter. */
function converting(input: (options: { target: string }) => unknown): StandardSchemaV1 {
  return {
    '~standard': { version: 1, vendor: 'converting', validate, jsonSchema: { input, output: input } },
  } as StandardSchemaV1;
}

/** A vendor that only validates. */
const plain: StandardSchemaV1 = { '~standard': { version: 1, vendor: 'plain', validate } };

const objectSchema = {
  type: 'object',
  properties: { city: { type: 'string' }, days: { type: 'integer', minimum: 1 } },
  required: ['city'],
  additionalProperties: false,
};

describe('toolInputJSONSchema', () => {
  it('returns the input schema a converting vendor produces', () => {
    expect(toolInputJSONSchema(converting(() => objectSchema))).toEqual(objectSchema);
  });

  it('asks for draft-2020-12 by default and passes a chosen target through', () => {
    const seen: string[] = [];
    const schema = converting((o) => {
      seen.push(o.target);
      return objectSchema;
    });
    toolInputJSONSchema(schema);
    toolInputJSONSchema(schema, { target: 'draft-07' });
    expect(seen).toEqual(['draft-2020-12', 'draft-07']);
  });

  it('calls the input converter, not the output one', () => {
    const schema = {
      '~standard': {
        version: 1,
        vendor: 'split',
        validate,
        jsonSchema: { input: () => objectSchema, output: () => ({ type: 'object', properties: {} }) },
      },
    } as StandardSchemaV1;
    expect(toolInputJSONSchema(schema)).toEqual(objectSchema);
  });

  it('falls back to { type: object } for a vendor with no converter', () => {
    expect(toolInputJSONSchema(plain)).toEqual({ type: 'object' });
  });

  it('falls back when the converter throws', () => {
    const schema = converting(() => {
      throw new Error('target not supported');
    });
    expect(toolInputJSONSchema(schema)).toEqual({ type: 'object' });
  });

  it('falls back when the result is not an object schema', () => {
    expect(toolInputJSONSchema(converting(() => ({ type: 'string' })))).toEqual({ type: 'object' });
    expect(toolInputJSONSchema(converting(() => ({ anyOf: [objectSchema] })))).toEqual({ type: 'object' });
    expect(toolInputJSONSchema(converting(() => null))).toEqual({ type: 'object' });
    expect(toolInputJSONSchema(converting(() => [objectSchema]))).toEqual({ type: 'object' });
  });

  it('returns a fresh object, so mutating it cannot change the fallback or the vendor copy', () => {
    const a = toolInputJSONSchema(plain);
    a.properties = {};
    expect(toolInputJSONSchema(plain)).toEqual({ type: 'object' });

    const b = toolInputJSONSchema(converting(() => objectSchema));
    b.title = 'changed';
    expect(objectSchema).not.toHaveProperty('title');
  });
});
