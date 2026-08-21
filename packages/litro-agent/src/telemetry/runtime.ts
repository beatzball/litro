/**
 * Internal telemetry facade used by the turn loop.
 *
 * All GenAI semantic-convention knowledge (attribute names, span names,
 * operation values) lives HERE rather than in `loop.ts`, so the loop reads
 * as domain logic and there is exactly one place that decides what a span
 * is allowed to carry. In particular, the "a UIResult's html never leaves
 * the surface channel" rule is enforced once, in `sanitizeForCapture`.
 *
 * When no tracer is configured `enabled` is false and every method
 * short-circuits to a shared no-op span before building any attributes —
 * telemetry off costs one boolean check per hook.
 */
import { isUIResult } from '../ui/index.js';
import type { ProviderRequest } from '../providers/types.js';
import type { AgentSpan, AgentTracer, SpanAttributes, TelemetryConfig } from './types.js';

// --- GenAI semantic conventions -------------------------------------------
export const GEN_AI = {
  operationName: 'gen_ai.operation.name',
  /** Current semconv name. `gen_ai.system` is emitted alongside it as a
   *  back-compat alias for backends that still key on the older name. */
  providerName: 'gen_ai.provider.name',
  system: 'gen_ai.system',
  requestModel: 'gen_ai.request.model',
  conversationId: 'gen_ai.conversation.id',
  agentName: 'gen_ai.agent.name',
  inputTokens: 'gen_ai.usage.input_tokens',
  outputTokens: 'gen_ai.usage.output_tokens',
  toolName: 'gen_ai.tool.name',
  toolCallId: 'gen_ai.tool.call.id',
  toolDescription: 'gen_ai.tool.description',
  toolType: 'gen_ai.tool.type',
  inputMessages: 'gen_ai.input.messages',
  outputMessages: 'gen_ai.output.messages',
  toolCallArguments: 'gen_ai.tool.call.arguments',
  toolCallResult: 'gen_ai.tool.call.result',
} as const;

export const ERROR_TYPE = 'error.type';

/** Litro-specific attributes, namespaced so they can never collide with a
 *  future semconv key. */
export const LITRO = {
  round: 'litro.agent.round',
  rounds: 'litro.agent.turn.rounds',
  toolCalls: 'litro.agent.round.tool_calls',
  toolReturnedUi: 'litro.agent.tool.ui',
} as const;

const DEFAULT_MAX_CONTENT_LENGTH = 8192;

// --- No-op path -----------------------------------------------------------
const NOOP_SPAN: AgentSpan = {
  setAttributes() {},
  setError() {},
  end() {},
};

export interface Usage {
  inputTokens?: number;
  outputTokens?: number;
}

export interface Telemetry {
  readonly enabled: boolean;
  startTurn(info: { agentName: string; sessionId: string; provider?: string; model?: string }): AgentSpan;
  endTurn(span: AgentSpan, info: { rounds: number; usage: Usage; error?: { type: string; message?: string } }): void;
  startChat(parent: AgentSpan, info: { provider?: string; model?: string; round: number; request: ProviderRequest }): AgentSpan;
  endChat(
    span: AgentSpan,
    info: { text: string; toolCalls: number; usage: Usage; error?: { type: string; message?: string } },
  ): void;
  startTool(parent: AgentSpan, info: { name: string; callId: string; description?: string; input: unknown }): AgentSpan;
  endTool(span: AgentSpan, info: { ui: boolean; result?: unknown; error?: { type: string; message?: string } }): void;
  /** Runs `fn` with `span` ambient, when the tracer supports it, so
   *  instrumentation inside a tool's own `execute()` nests correctly. */
  withActiveSpan<T>(span: AgentSpan, fn: () => T): T;
}

/**
 * Replaces any `UIResult` in `value` with a html-free stand-in, so captured
 * content can never carry rendered markup into a trace backend. Cycle-safe
 * and depth-capped, mirroring `loop.ts`'s `containsNestedUIResult` walk.
 */
export function sanitizeForCapture(value: unknown, depth = 0, seen: Set<unknown> = new Set()): unknown {
  if (isUIResult(value)) return { type: 'ui', data: value.data ?? null };
  if (value === null || typeof value !== 'object') return value;
  if (depth > 8 || seen.has(value)) return '[omitted]';
  seen.add(value);

  if (Array.isArray(value)) return value.map((v) => sanitizeForCapture(v, depth + 1, seen));

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = sanitizeForCapture(v, depth + 1, seen);
  }
  return out;
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max)}…[truncated]`;
}

function noopTelemetry(): Telemetry {
  return {
    enabled: false,
    startTurn: () => NOOP_SPAN,
    endTurn: () => {},
    startChat: () => NOOP_SPAN,
    endChat: () => {},
    startTool: () => NOOP_SPAN,
    endTool: () => {},
    withActiveSpan: (_span, fn) => fn(),
  };
}

/** Builds the telemetry facade for a runtime config. Returns the shared
 *  no-op implementation when no tracer is configured. */
export function resolveTelemetry(config?: TelemetryConfig | null): Telemetry {
  const tracer: AgentTracer | undefined = config?.tracer ?? undefined;
  if (!tracer) return NOOP_TELEMETRY;

  const captureContent = config?.captureContent === true;
  const maxLen = config?.maxContentLength ?? DEFAULT_MAX_CONTENT_LENGTH;

  /** Serializes `value` for a content attribute, or returns undefined when
   *  content capture is off (an undefined attribute is dropped). */
  function content(value: unknown): string | undefined {
    if (!captureContent) return undefined;
    let json: string;
    try {
      json = JSON.stringify(sanitizeForCapture(value)) ?? 'null';
    } catch {
      json = '"[unserializable]"';
    }
    return truncate(json, maxLen);
  }

  function applyError(span: AgentSpan, error?: { type: string; message?: string }): void {
    if (error) span.setError(error.type, error.message);
  }

  return {
    enabled: true,

    startTurn(info) {
      const attrs: SpanAttributes = {
        [GEN_AI.operationName]: 'invoke_agent',
        [GEN_AI.agentName]: info.agentName,
        [GEN_AI.conversationId]: info.sessionId,
        [GEN_AI.providerName]: info.provider,
        [GEN_AI.system]: info.provider,
        [GEN_AI.requestModel]: info.model,
      };
      return tracer.startSpan(`invoke_agent ${info.agentName}`, { attributes: attrs });
    },

    endTurn(span, info) {
      span.setAttributes({
        [LITRO.rounds]: info.rounds,
        [GEN_AI.inputTokens]: info.usage.inputTokens,
        [GEN_AI.outputTokens]: info.usage.outputTokens,
      });
      applyError(span, info.error);
      span.end();
    },

    startChat(parent, info) {
      const attrs: SpanAttributes = {
        [GEN_AI.operationName]: 'chat',
        [GEN_AI.providerName]: info.provider,
        [GEN_AI.system]: info.provider,
        [GEN_AI.requestModel]: info.model,
        [LITRO.round]: info.round,
        [GEN_AI.inputMessages]: content(info.request.messages),
      };
      return tracer.startSpan(`chat ${info.model ?? 'unknown'}`, { attributes: attrs, parent });
    },

    endChat(span, info) {
      span.setAttributes({
        [LITRO.toolCalls]: info.toolCalls,
        [GEN_AI.inputTokens]: info.usage.inputTokens,
        [GEN_AI.outputTokens]: info.usage.outputTokens,
        [GEN_AI.outputMessages]: content([{ role: 'assistant', content: info.text }]),
      });
      applyError(span, info.error);
      span.end();
    },

    startTool(parent, info) {
      const attrs: SpanAttributes = {
        [GEN_AI.operationName]: 'execute_tool',
        [GEN_AI.toolName]: info.name,
        [GEN_AI.toolCallId]: info.callId,
        [GEN_AI.toolType]: 'function',
        [GEN_AI.toolDescription]: info.description,
        [GEN_AI.toolCallArguments]: content(info.input),
      };
      return tracer.startSpan(`execute_tool ${info.name}`, { attributes: attrs, parent });
    },

    endTool(span, info) {
      span.setAttributes({
        [LITRO.toolReturnedUi]: info.ui,
        [GEN_AI.toolCallResult]: content(info.result),
      });
      applyError(span, info.error);
      span.end();
    },

    withActiveSpan(span, fn) {
      return tracer.withActiveSpan ? tracer.withActiveSpan(span, fn) : fn();
    },
  };
}

/** Shared no-op instance, used whenever telemetry is unconfigured so the
 *  turn loop never allocates per turn on the off path. */
export const NOOP_TELEMETRY: Telemetry = noopTelemetry();
