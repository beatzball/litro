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

export interface TurnDeps {
  agent: { name: string; config: AgentConfig; tools: Map<string, ToolDefinition> };
  store: SessionStore;
  sessionId: string;
  event: H3Event | undefined;
  /** Wire callback -- called AFTER the corresponding append() resolves. */
  emit: (ev: SessionEvent) => void;
  /** Runaway guard: max number of PROVIDER CALLS in a single turn. Default 8. */
  maxToolRounds?: number;
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

/** Finalizes a tool's (non-progress) result: a direct UIResult, a plain
 *  value with a UIResult nested somewhere inside it, or an ordinary value.
 *  Persists the appropriate event and returns the string to feed back to
 *  the provider. The html half of a UIResult -- wherever it appears in the
 *  result shape -- never reaches that return value. */
async function finalizeToolResult(deps: TurnDeps, toolName: string, result: unknown): Promise<string> {
  if (isUIResult(result)) {
    // The model must NEVER see `html` -- only `data` is fed back into the
    // conversation. The full UIResult (html included) goes to the wire via
    // the `ui` event, not into any ChatMessage.
    await appendEmit(deps, 'ui', result);
    const data = result.data ?? null;
    return JSON.stringify(data);
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
    return JSON.stringify({ error: { message } });
  }

  await appendEmit(deps, 'tool-result', result);
  return JSON.stringify(result);
}

/** Runs one tool call to completion: looks the tool up, validates input via
 *  its Standard Schema, executes it, persists the appropriate event(s), and
 *  returns the string to feed back to the provider as the `tool` message's
 *  `content`. The html half of a UIResult -- and any tool's raw internal
 *  error stack -- never reaches this return value. */
async function runToolCall(
  deps: TurnDeps,
  callEvent: SessionEvent,
  call: { id: string; name: string; input: unknown },
): Promise<string> {
  const toolDef = deps.agent.tools.get(call.name);
  if (!toolDef) {
    const message = `Unknown tool: "${call.name}"`;
    await appendEmit(deps, 'tool-result', { error: { message } });
    return JSON.stringify({ error: { message } });
  }

  const cfg = toolDef[TOOL_CONFIG] as ToolConfig<unknown>;

  const validation = await cfg.input['~standard'].validate(call.input);
  if (validation.issues) {
    const detail = validation.issues.map((i) => i.message).join('; ');
    const message = `Validation failed for tool "${call.name}": ${detail}`;
    await appendEmit(deps, 'tool-result', { error: { message } });
    return JSON.stringify({ error: { message } });
  }

  let result: unknown;
  try {
    result = await cfg.execute(validation.value, {
      event: deps.event,
      session: { id: deps.sessionId, seq: callEvent.seq },
    });
  } catch (err) {
    const message = errorMessage(err);
    await appendEmit(deps, 'tool-result', { error: { message } });
    return JSON.stringify({ error: { message } });
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
    return finalizeToolResult(deps, call.name, final ?? null);
  }

  return finalizeToolResult(deps, call.name, result);
}

export async function runTurn(deps: TurnDeps, userText: string): Promise<void> {
  const maxToolRounds = deps.maxToolRounds ?? DEFAULT_MAX_TOOL_ROUNDS;
  const cfg = deps.agent.config;

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
      await appendEmit(deps, 'error', { message: 'tool round limit exceeded' });
      await appendEmit(deps, 'turn-end', null);
      return;
    }

    const req: ProviderRequest = {
      system: cfg.instructions,
      messages: [...baseMessages, ...turnMessages],
      tools: toolSpecs,
    };

    let accumulatedText = '';
    const toolCallParts: ToolCallPart[] = [];
    const toolResultMessages: ChatMessage[] = [];
    let providerError: { message: string; status?: number } | undefined;

    for await (const ev of cfg.model.stream(req)) {
      if (ev.type === 'text-delta') {
        accumulatedText += ev.text;
        await appendEmit(deps, 'text-delta', { text: ev.text });
      } else if (ev.type === 'tool-call') {
        const call = { id: ev.id, name: ev.name, input: ev.input };
        const callEvent = await appendEmit(deps, 'tool-call', call);
        toolCallParts.push(call);
        const content = await runToolCall(deps, callEvent, call);
        toolResultMessages.push({ role: 'tool', toolCallId: ev.id, content });
      } else if (ev.type === 'provider-error') {
        providerError = { message: ev.message, status: ev.status };
        break;
      }
      // 'done' needs no handling: the provider's async generator simply
      // finishes after yielding it, ending this for-await loop naturally.
    }

    if (providerError) {
      await appendEmit(deps, 'error', { message: providerError.message, status: providerError.status });
      await appendEmit(deps, 'turn-end', null);
      return;
    }

    if (accumulatedText.length > 0) roundTexts.push(accumulatedText);

    if (toolCallParts.length === 0) {
      // Clean finish: no pending tool calls, stream ended -- persist the
      // final assistant message (narration from EVERY round this turn,
      // not just this last one) and close the turn.
      await appendEmit(deps, 'message', { role: 'assistant', text: roundTexts.join('\n\n') });
      await appendEmit(deps, 'turn-end', null);
      return;
    }

    // Tool calls happened this round: extend the in-memory conversation
    // for the next provider call and loop.
    turnMessages.push({ role: 'assistant', content: accumulatedText, toolCalls: toolCallParts });
    turnMessages.push(...toolResultMessages);
  }
}
