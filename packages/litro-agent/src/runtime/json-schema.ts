/**
 * Standard Schema -> JSON Schema, for anything that has to describe a tool's
 * input to someone other than the validator: the agent loop's provider tool
 * list today, an MCP server's `tools/list` `inputSchema` later.
 *
 * There is no library call here. The Standard JSON Schema interface
 * (https://standardschema.dev, `@standard-schema/spec`) lets a vendor put a
 * `jsonSchema` converter next to `validate` on the same `~standard` object.
 * A schema whose vendor implements it converts; one that does not falls back
 * to the permissive object schema v0 sent for every tool.
 */
import type { StandardSchemaV1 } from '@beatzball/litro/actions';

/**
 * Vendored from the Standard JSON Schema spec (`@standard-schema/spec`,
 * `StandardJSONSchemaV1`), as `StandardSchemaV1` is vendored in the framework.
 * Only the converter half is copied: the part this module calls.
 */
export declare namespace StandardJSONSchemaV1 {
  export interface Converter {
    readonly input: (options: Options) => Record<string, unknown>;
    readonly output: (options: Options) => Record<string, unknown>;
  }
  export type Target = 'draft-2020-12' | 'draft-07' | 'openapi-3.0' | ({} & string);
  export interface Options {
    readonly target: Target;
    readonly libraryOptions?: Record<string, unknown> | undefined;
  }
}

/** What a tool gets when its vendor cannot describe it. Every provider and
 *  the MCP spec accept it; it tells the model nothing. */
export const PERMISSIVE_OBJECT_SCHEMA: Readonly<Record<string, unknown>> = Object.freeze({ type: 'object' });

export interface ToolInputJSONSchemaOptions {
  /** JSON Schema dialect to ask the vendor for. Default `draft-2020-12`, the
   *  dialect MCP assumes when a schema carries no `$schema`. */
  target?: StandardJSONSchemaV1.Target;
}

/**
 * The JSON Schema for a tool's INPUT (what the model sends, before
 * validation transforms it), or `{ type: 'object' }` when there is none.
 *
 * Falls back, and never throws, when:
 * - the vendor has no `~standard.jsonSchema.input` converter;
 * - the converter throws (the spec says it may, e.g. for an unsupported
 *   target or a type JSON Schema cannot express);
 * - the result is not an object schema. Tool arguments are always an
 *   object, and both providers and MCP reject any other top-level type.
 *
 * Returns a fresh object every call, so a caller may mutate it.
 */
export function toolInputJSONSchema(
  schema: StandardSchemaV1<unknown, unknown>,
  options: ToolInputJSONSchemaOptions = {},
): Record<string, unknown> {
  const props = schema['~standard'] as StandardSchemaV1.Props & { jsonSchema?: Partial<StandardJSONSchemaV1.Converter> };
  const convert = props.jsonSchema?.input;
  if (typeof convert !== 'function') return { ...PERMISSIVE_OBJECT_SCHEMA };

  let out: unknown;
  try {
    out = convert({ target: options.target ?? 'draft-2020-12' });
  } catch {
    return { ...PERMISSIVE_OBJECT_SCHEMA };
  }
  if (out === null || typeof out !== 'object' || Array.isArray(out)) return { ...PERMISSIVE_OBJECT_SCHEMA };
  if ((out as Record<string, unknown>).type !== 'object') return { ...PERMISSIVE_OBJECT_SCHEMA };
  return { ...(out as Record<string, unknown>) };
}
