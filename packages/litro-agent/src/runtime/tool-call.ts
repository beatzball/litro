/**
 * The pure half of one tool call: look the tool up, validate its input,
 * execute it, drain a generator to its final value, and classify what came
 * back — including splitting a `UIResult` into the `data` half the model may
 * see and the `html` half it may not (AGENT-002).
 *
 * WHY THIS IS A MODULE OF ITS OWN
 *
 * Two callers need exactly these steps and nothing else around them: the chat
 * loop (`./loop.ts`), which appends a session event and closes a span at every
 * branch, and the MCP server (`../mcp-server/`), which has neither a store nor
 * a span and answers `tools/call` from the same outcome.
 *
 * Nothing here appends, emits, or traces. Every `appendEmit` and every span
 * call stays in `loop.ts` where the store's ordering rule lives (AGENT-001) —
 * this function only decides WHAT happened, and the caller decides what to
 * record about it. `onProgress` is the one callback, because a generator's
 * intermediate values have to reach the caller while the drain is still
 * running, and the loop awaits it so the append order is unchanged.
 */
import { isAsyncIterable } from '@beatzball/litro/stream';
import type { ToolConfig, ToolContext } from '../index.js';
import { isUIResult, type UIResult } from '../ui/index.js';

/** Semconv `error.type`: the exception's class name where there is one,
 *  otherwise a generic marker. Never a stack. */
export function errorType(err: unknown): string {
  return err instanceof Error ? err.name : 'error';
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Cycle-safe, depth-capped (~8) walk over a plain object/array result
 *  looking for a UIResult NESTED inside it (e.g. `{ card: await ui(...) }`).
 *  Only descends into the *children* of `value` -- the caller is expected to
 *  have already ruled out `value` itself being a top-level UIResult, since
 *  that is handled (and allowed) separately. */
export function containsNestedUIResult(value: unknown, depth = 0, seen: Set<unknown> = new Set()): boolean {
  if (depth > 8 || value === null || typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);

  const children = Array.isArray(value) ? value : Object.values(value as Record<string, unknown>);
  for (const child of children) {
    if (isUIResult(child)) return true;
    if (child !== null && typeof child === 'object' && containsNestedUIResult(child, depth + 1, seen)) return true;
  }
  return false;
}

/**
 * What one tool call turned out to be. Five failures and two successes, each
 * carrying the `type` string the chat loop already reports as its semconv
 * `error.type` so neither caller has to reinvent the vocabulary.
 *
 * `ui` keeps the whole `UIResult` because the chat loop streams it to the
 * surface; every caller that feeds a model or a wire reads `data` instead.
 */
export type ToolCallOutcome =
  | { kind: 'unknown-tool'; type: 'unknown_tool'; message: string }
  | { kind: 'validation-error'; type: 'validation_error'; message: string }
  | { kind: 'execute-error'; type: string; message: string }
  | { kind: 'nested-ui'; type: 'nested_ui_result'; message: string }
  | { kind: 'ui'; result: UIResult; data: unknown }
  | { kind: 'value'; value: unknown };

export interface RunToolOptions {
  /**
   * Wraps the call to `execute()` only — not the validation and not the
   * generator drain. The chat loop makes its tool span ambient here so any
   * instrumentation inside the tool nests under it.
   */
  around?: <T>(fn: () => T | Promise<T>) => T | Promise<T>;
  /**
   * Called once per value an async-generator tool yields, in order, and
   * awaited before the drain continues. The chat loop appends a
   * `tool-progress` event here; the MCP server has nowhere to send one in v1
   * and omits it.
   */
  onProgress?: (value: unknown) => void | Promise<void>;
}

/** The message a missing tool produces. One string, because the loop's
 *  wording is asserted by its tests and the server answers with the same
 *  text in a protocol error. */
export function unknownToolMessage(toolName: string): string {
  return `Unknown tool: "${toolName}"`;
}

export function validationMessage(toolName: string, detail: string): string {
  return `Validation failed for tool "${toolName}": ${detail}`;
}

export function nestedUIMessage(toolName: string): string {
  return (
    `Tool "${toolName}" returned a nested UIResult — return the UIResult directly from ` +
    `execute() so its html stays out of the model channel.`
  );
}

/**
 * A throwing `execute()` becomes an `execute-error` outcome, which is what
 * lets the chat loop hand the model a message and the MCP server answer
 * `isError: true` rather than a protocol error (section 14 of the spec).
 *
 * Three things still throw, because they did before the extraction and the
 * chat loop's behavior must not change: a schema whose `validate` throws, a
 * generator that throws mid-drain, and a failing `onProgress` (a failing store
 * append, in the loop's case). Those are machinery failing, not the tool.
 */
export async function runTool(
  toolCfg: ToolConfig<unknown> | undefined,
  toolName: string,
  input: unknown,
  ctx: ToolContext,
  options: RunToolOptions = {},
): Promise<ToolCallOutcome> {
  if (!toolCfg) {
    return { kind: 'unknown-tool', type: 'unknown_tool', message: unknownToolMessage(toolName) };
  }

  const validation = await toolCfg.input['~standard'].validate(input);
  if (validation.issues) {
    const detail = validation.issues.map((i) => i.message).join('; ');
    return { kind: 'validation-error', type: 'validation_error', message: validationMessage(toolName, detail) };
  }

  const invoke = options.around ?? (<T>(fn: () => T | Promise<T>) => fn());

  let result: unknown;
  try {
    result = await invoke(() => toolCfg.execute(validation.value, ctx));
  } catch (err) {
    return { kind: 'execute-error', type: errorType(err), message: errorMessage(err) };
  }

  if (isAsyncIterable(result)) {
    const iterator = (result as AsyncIterable<unknown>)[Symbol.asyncIterator]();
    let final: unknown;
    for (;;) {
      // NOT caught. A generator that throws part-way through, and a failing
      // `onProgress`, both propagate exactly as they did before this function
      // was extracted — the chat loop closes its span and ends the turn on
      // them. The MCP server wraps the whole call instead. Swallowing them
      // here would quietly change the loop's behavior.
      const next = await iterator.next();
      if (next.done) {
        final = next.value;
        break;
      }
      await options.onProgress?.(next.value);
    }
    return classify(toolName, final ?? null);
  }

  return classify(toolName, result);
}

/** Splits a finished tool value into the outcome the callers act on. The
 *  `html` half of a UIResult -- wherever it appears in the shape -- never
 *  reaches `data` or `value`. */
function classify(toolName: string, result: unknown): ToolCallOutcome {
  if (isUIResult(result)) {
    return { kind: 'ui', result, data: result.data ?? null };
  }
  if (containsNestedUIResult(result)) {
    // A UIResult buried inside a plain object/array would otherwise be
    // serialized whole (html included) into the model's channel. Reject
    // loudly instead of leaking it -- this is a tool-author bug.
    return { kind: 'nested-ui', type: 'nested_ui_result', message: nestedUIMessage(toolName) };
  }
  return { kind: 'value', value: result };
}
