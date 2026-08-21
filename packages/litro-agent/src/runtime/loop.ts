/**
 * The turn loop — the agent runtime's core. Consumes a user message, drives
 * the provider (and any tools it calls) to completion, and persists every
 * step as a `SessionEvent` before it is ever handed to the caller's `emit`
 * callback.
 *
 * Ordering rule (the keystone, see design doc 5.5): every event is appended
 * to the store *before* it is emitted to the wire. `appendEmit()` below is
 * the ONLY path that produces a `SessionEvent` in this module, specifically
 * to keep that invariant in one place: append, await it, THEN emit the
 * event the store handed back (which carries the assigned `seq`).
 */
import type { H3Event } from 'h3';
import { isAsyncIterable } from '@beatzball/litro/stream';
import type { AgentConfig, ToolConfig, ToolDefinition } from '../index.js';
import { TOOL_CONFIG } from '../index.js';
import { isUIResult } from '../ui/index.js';
import type { ChatMessage, ProviderRequest, ToolCallPart, ToolSpec } from '../providers/types.js';
import type { SessionEvent, SessionEventKind, SessionStore } from '../sessions/types.js';
import type { AgentSpan } from '../telemetry/types.js';
import { NOOP_TELEMETRY, type Telemetry, type Usage } from '../telemetry/runtime.js';

export interface TurnDeps {
  agent: { name: string; config: AgentConfig; tools: Map<string, ToolDefinition> };
  store: SessionStore;
  sessionId: string;
  event: H3Event | undefined;
  /** Wire callback -- called AFTER the corresponding append() resolves. */
  emit: (ev: SessionEvent) => void;
  /** Runaway guard: max number of PROVIDER CALLS in a single turn. Default 8. */
  maxToolRounds?: number;
  /** Span emitter. Omitted (or unconfigured) means the shared no-op — the
   *  loop's behaviour is identical either way; telemetry never changes what
   *  is appended to the store or written to the wire. */
  telemetry?: Telemetry;
}

const DEFAULT_MAX_TOOL_ROUNDS = 8;

/** Appends `{ kind, payload }` to the store, then emits the event the store
 *  returned (carrying its assigned `seq`). Every session event in this
 *  module goes through here so append-before-emit is structurally
 *  impossible to get wrong. */
async function appendEmit(deps: TurnDeps, kind: SessionEventKind, payload: unknown): Promise<SessionEvent> {
  const ev = await deps.store.append(deps.sessionId, { ts: Date.now(), kind, payload });
  deps.emit(ev);
  return ev;
}

/** Builds the provider-facing tool list. v0 uses a permissive `{ type:
 *  'object' }` JSON schema for every tool and lets `description` carry the
 *  contract -- converting the tool's Standard Schema into a real JSON
 *  Schema (where the vendor exposes one) is explicitly deferred past v0. */
function buildToolSpecs(tools: Map<string, ToolDefinition>): ToolSpec[] {
  const specs: ToolSpec[] = [];
  for (const [name, def] of tools) {
    const cfg = def[TOOL_CONFIG] as ToolConfig<unknown>;
    specs.push({ name, description: cfg.description, parameters: { type: 'object' } });
  }
  return specs;
}

/** Conversation memory is message-level only in v0: replays every `message`
 *  session event (user + assistant text) from prior turns AND the current
 *  turn's just-appended user message. Tool-call/tool-result/ui events from
 *  PAST turns are intentionally NOT replayed -- the model only ever sees
 *  the accumulated final text of past turns, never their tool exchanges. */
async function replayMessages(store: SessionStore, sessionId: string): Promise<ChatMessage[]> {
  const out: ChatMessage[] = [];
  for await (const ev of store.read(sessionId)) {
    if (ev.kind !== 'message') continue;
    const p = ev.payload as { role: 'user' | 'assistant'; text: string };
    out.push({ role: p.role, content: p.text });
  }
  return out;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Semconv `error.type`: the exception's class name where there is one,
 *  otherwise a generic marker. Never a stack. */
function errorType(err: unknown): string {
  return err instanceof Error ? err.name : 'error';
}

/** Cycle-safe, depth-capped (~8) walk over a plain object/array result
 *  looking for a UIResult NESTED inside it (e.g. `{ card: await ui(...) }`).
 *  Only descends into the *children* of `value` -- the caller is expected to
 *  have already ruled out `value` itself being a top-level UIResult, since
 *  that is handled (and allowed) separately. */
function containsNestedUIResult(value: unknown, depth = 0, seen: Set<unknown> = new Set()): boolean {
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

/** The outcome of one tool call: what goes back to the provider, plus the
 *  span-facing facts (did it produce UI, did it fail). `result` is the raw
 *  tool return — telemetry sanitizes it before capture; a UIResult's html
 *  never reaches a span, exactly as it never reaches `content`. */
interface ToolOutcome {
  content: string;
  ui: boolean;
  result: unknown;
  error?: { type: string; message: string };
}

/** Finalizes a tool's (non-progress) result: a direct UIResult, a plain
 *  value with a UIResult nested somewhere inside it, or an ordinary value.
 *  Persists the appropriate event and returns the string to feed back to
 *  the provider. The html half of a UIResult -- wherever it appears in the
 *  result shape -- never reaches that return value. */
async function finalizeToolResult(deps: TurnDeps, toolName: string, result: unknown): Promise<ToolOutcome> {
  if (isUIResult(result)) {
    // The model must NEVER see `html` -- only `data` is fed back into the
    // conversation. The full UIResult (html included) goes to the wire via
    // the `ui` event, not into any ChatMessage.
    await appendEmit(deps, 'ui', result);
    const data = result.data ?? null;
    return { content: JSON.stringify(data), ui: true, result };
  }

  if (containsNestedUIResult(result)) {
    // A UIResult buried inside a plain object/array would otherwise be
    // JSON.stringify'd whole (html included) into the provider's tool
    // message. Reject loudly instead of leaking it -- this is a tool-author
    // bug, not a session-ending error.
    const message =
      `Tool "${toolName}" returned a nested UIResult — return the UIResult directly from ` +
      `execute() so its html stays out of the model channel.`;
    await appendEmit(deps, 'tool-result', { error: { message } });
    return {
      content: JSON.stringify({ error: { message } }),
      ui: false,
      result: { error: { message } },
      error: { type: 'nested_ui_result', message },
    };
  }

  await appendEmit(deps, 'tool-result', result);
  return { content: JSON.stringify(result), ui: false, result };
}

/** Runs one tool call to completion: looks the tool up, validates input via
 *  its Standard Schema, executes it, persists the appropriate event(s), and
 *  returns the string to feed back to the provider as the `tool` message's
 *  `content`. The html half of a UIResult -- and any tool's raw internal
 *  error stack -- never reaches this return value.
 *
 *  Emits one `execute_tool` span parented to the TURN span, not to the
 *  `chat` round that happened to dispatch the call: the tool run is a
 *  sibling of the model call, not a child of it. */
async function runToolCall(
  deps: TurnDeps,
  tel: Telemetry,
  turnSpan: AgentSpan,
  callEvent: SessionEvent,
  call: { id: string; name: string; input: unknown },
): Promise<string> {
  const toolDef = deps.agent.tools.get(call.name);
  const toolCfg = toolDef ? (toolDef[TOOL_CONFIG] as ToolConfig<unknown>) : undefined;

  const span = tel.startTool(turnSpan, {
    name: call.name,
    callId: call.id,
    description: toolCfg?.description,
    input: call.input,
  });

  /** Single exit for every failure path: persist the tool-result error
   *  event, close the span with its semconv `error.type`, and hand the
   *  model the same message. */
  const fail = async (type: string, message: string): Promise<string> => {
    const payload = { error: { message } };
    await appendEmit(deps, 'tool-result', payload);
    tel.endTool(span, { ui: false, result: payload, error: { type, message } });
    return JSON.stringify(payload);
  };

  try {
    if (!toolCfg) return await fail('unknown_tool', `Unknown tool: "${call.name}"`);

    const validation = await toolCfg.input['~standard'].validate(call.input);
    if (validation.issues) {
      const detail = validation.issues.map((i) => i.message).join('; ');
      return await fail('validation_error', `Validation failed for tool "${call.name}": ${detail}`);
    }

    let result: unknown;
    try {
      // `withActiveSpan` makes the tool span ambient where the tracer can
      // do so, so any instrumentation inside execute() nests under it.
      result = await tel.withActiveSpan(span, () =>
        toolCfg.execute(validation.value, {
          event: deps.event,
          session: { id: deps.sessionId, seq: callEvent.seq },
        }),
      );
    } catch (err) {
      return await fail(errorType(err), errorMessage(err));
    }

    if (isAsyncIterable(result)) {
      const iterator = result[Symbol.asyncIterator]();
      let final: unknown;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const next = await iterator.next();
        if (next.done) {
          final = next.value;
          break;
        }
        await appendEmit(deps, 'tool-progress', next.value);
      }
      const outcome = await finalizeToolResult(deps, call.name, final ?? null);
      tel.endTool(span, outcome);
      return outcome.content;
    }

    const outcome = await finalizeToolResult(deps, call.name, result);
    tel.endTool(span, outcome);
    return outcome.content;
  } catch (err) {
    // A store append failing mid-tool would otherwise leave the span open.
    // Close it, then let the error propagate to the turn's own handler.
    tel.endTool(span, { ui: false, error: { type: errorType(err), message: errorMessage(err) } });
    throw err;
  }
}

/** Accumulates per-round token usage into the turn total. Absent counts
 *  stay absent — a provider that reports nothing produces no usage
 *  attributes rather than zeros. */
function addUsage(total: Usage, round: Usage): void {
  if (round.inputTokens !== undefined) total.inputTokens = (total.inputTokens ?? 0) + round.inputTokens;
  if (round.outputTokens !== undefined) total.outputTokens = (total.outputTokens ?? 0) + round.outputTokens;
}

/** The turn body. Returns the turn's terminal error (for the span), or
 *  undefined on a clean finish. Separated from `runTurn` purely so the
 *  `invoke_agent` span has exactly one place to close, whichever of the
 *  four exit paths the turn takes. */
async function runTurnBody(
  deps: TurnDeps,
  userText: string,
  tel: Telemetry,
  turnSpan: AgentSpan,
  usage: Usage,
  counters: { rounds: number },
): Promise<{ type: string; message: string } | undefined> {
  const maxToolRounds = deps.maxToolRounds ?? DEFAULT_MAX_TOOL_ROUNDS;
  const cfg = deps.agent.config;
  const providerInfo = cfg.model.info;

  // 1. Log the user's turn first -- everything below can see it via replay.
  await appendEmit(deps, 'message', { role: 'user', text: userText });

  const toolSpecs = buildToolSpecs(deps.agent.tools);
  const baseMessages = await replayMessages(deps.store, deps.sessionId);

  // In-memory only: the assistant-with-toolCalls + tool-result messages
  // built up across this turn's rounds. Never persisted as `message`
  // events -- only the turn's final accumulated assistant text is (step 6).
  const turnMessages: ChatMessage[] = [];

  // Each round's non-empty narration text (e.g. text emitted before a tool
  // call), collected across every provider round in this turn so it isn't
  // dropped from the durable assistant `message` -- only the LAST round's
  // text would otherwise survive into future turns' reconstructed memory.
  const roundTexts: string[] = [];

  let round = 0;
  for (;;) {
    round += 1;
    if (round > maxToolRounds) {
      const message = 'tool round limit exceeded';
      await appendEmit(deps, 'error', { message });
      await appendEmit(deps, 'turn-end', null);
      return { type: 'tool_round_limit_exceeded', message };
    }
    counters.rounds = round;

    const req: ProviderRequest = {
      system: cfg.instructions,
      messages: [...baseMessages, ...turnMessages],
      tools: toolSpecs,
    };

    let accumulatedText = '';
    const toolCallParts: ToolCallPart[] = [];
    const toolResultMessages: ChatMessage[] = [];
    let providerError: { message: string; status?: number } | undefined;
    const roundUsage: Usage = {};

    // One `chat` span per provider call. Tool spans dispatched from inside
    // this stream are parented to `turnSpan`, not to this one.
    const chatSpan = tel.startChat(turnSpan, {
      provider: providerInfo?.system,
      model: providerInfo?.model,
      round,
      request: req,
    });

    try {
      for await (const ev of cfg.model.stream(req)) {
        if (ev.type === 'text-delta') {
          accumulatedText += ev.text;
          await appendEmit(deps, 'text-delta', { text: ev.text });
        } else if (ev.type === 'tool-call') {
          const call = { id: ev.id, name: ev.name, input: ev.input };
          const callEvent = await appendEmit(deps, 'tool-call', call);
          toolCallParts.push(call);
          const content = await runToolCall(deps, tel, turnSpan, callEvent, call);
          toolResultMessages.push({ role: 'tool', toolCallId: ev.id, content });
        } else if (ev.type === 'provider-error') {
          providerError = { message: ev.message, status: ev.status };
          break;
        } else if (ev.type === 'done') {
          // The provider's own token accounting, when it reports any. The
          // generator finishes right after this, ending the for-await
          // naturally -- `done` needs no control-flow handling.
          if (ev.usage) {
            roundUsage.inputTokens = ev.usage.inputTokens;
            roundUsage.outputTokens = ev.usage.outputTokens;
          }
        }
      }
    } catch (err) {
      // A throwing provider generator (or a store append failing mid-round)
      // must not leave the chat span open.
      tel.endChat(chatSpan, {
        text: accumulatedText,
        toolCalls: toolCallParts.length,
        usage: roundUsage,
        error: { type: errorType(err), message: errorMessage(err) },
      });
      throw err;
    }

    addUsage(usage, roundUsage);
    tel.endChat(chatSpan, {
      text: accumulatedText,
      toolCalls: toolCallParts.length,
      usage: roundUsage,
      error: providerError ? { type: 'provider_error', message: providerError.message } : undefined,
    });

    if (providerError) {
      await appendEmit(deps, 'error', { message: providerError.message, status: providerError.status });
      await appendEmit(deps, 'turn-end', null);
      return { type: 'provider_error', message: providerError.message };
    }

    if (accumulatedText.length > 0) roundTexts.push(accumulatedText);

    if (toolCallParts.length === 0) {
      // Clean finish: no pending tool calls, stream ended -- persist the
      // final assistant message (narration from EVERY round this turn,
      // not just this last one) and close the turn.
      await appendEmit(deps, 'message', { role: 'assistant', text: roundTexts.join('\n\n') });
      await appendEmit(deps, 'turn-end', null);
      return undefined;
    }

    // Tool calls happened this round: extend the in-memory conversation
    // for the next provider call and loop.
    turnMessages.push({ role: 'assistant', content: accumulatedText, toolCalls: toolCallParts });
    turnMessages.push(...toolResultMessages);
  }
}

export async function runTurn(deps: TurnDeps, userText: string): Promise<void> {
  const tel = deps.telemetry ?? NOOP_TELEMETRY;
  const providerInfo = deps.agent.config.model.info;
  const turnSpan = tel.startTurn({
    agentName: deps.agent.name,
    sessionId: deps.sessionId,
    provider: providerInfo?.system,
    model: providerInfo?.model,
  });

  const usage: Usage = {};
  const counters = { rounds: 0 };

  try {
    const error = await runTurnBody(deps, userText, tel, turnSpan, usage, counters);
    tel.endTurn(turnSpan, { rounds: counters.rounds, usage, error });
  } catch (err) {
    tel.endTurn(turnSpan, {
      rounds: counters.rounds,
      usage,
      error: { type: errorType(err), message: errorMessage(err) },
    });
    throw err;
  }
}
