/**
 * Telemetry contract for @beatzball/litro-agent.
 *
 * The runtime emits OpenTelemetry GenAI-semantic-convention spans through
 * this interface WITHOUT importing (or depending on) `@opentelemetry/api`.
 * The caller brings its own tracer: either the thin adapter from
 * `@beatzball/litro-agent/telemetry` (which wraps a real OTel `Tracer` by
 * structural typing) or any object matching `AgentTracer`.
 *
 * Parentage is EXPLICIT (`opts.parent`) rather than inherited from an
 * ambient context. That is deliberate: it makes span nesting correct even
 * when no OTel context manager (AsyncLocalStorage) is registered, and it
 * lets the runtime parent `execute_tool` to the turn rather than to the
 * `chat` round it happens to be dispatched from.
 */

export type SpanAttributeValue = string | number | boolean;

/** `undefined` values are dropped rather than recorded. */
export type SpanAttributes = Record<string, SpanAttributeValue | undefined>;

export interface AgentSpan {
  setAttributes(attrs: SpanAttributes): void;
  /** Marks the span failed. `type` is the semconv `error.type` value; the
   *  runtime never passes a stack (mirroring the no-stacks-in-prod rule). */
  setError(type: string, message?: string): void;
  end(): void;
}

export interface StartSpanOptions {
  attributes?: SpanAttributes;
  /** Explicit parent. Omitted means "root, or whatever the tracer's own
   *  ambient context says" — the runtime always passes one where it has it. */
  parent?: AgentSpan;
}

export interface AgentTracer {
  startSpan(name: string, opts?: StartSpanOptions): AgentSpan;
  /** Optional. When present, the runtime runs a tool's `execute()` inside
   *  it so instrumentation INSIDE the tool nests under the tool span. A
   *  tracer that cannot establish ambient context simply omits this. */
  withActiveSpan?<T>(span: AgentSpan, fn: () => T): T;
}

export interface TelemetryConfig {
  /** No tracer = telemetry off, and every hook short-circuits to a shared
   *  no-op object (no allocation, no attribute building). */
  tracer?: AgentTracer;
  /**
   * Record prompt/completion/tool payloads on spans. OFF by default, per
   * the GenAI semantic conventions' opt-in stance on content capture and
   * this package's own no-internals-by-default posture.
   *
   * Even when ON, a `UIResult`'s `html` is NEVER recorded — the same rule
   * that keeps html out of the model channel keeps it out of traces.
   */
  captureContent?: boolean;
  /** Truncation cap for captured content attributes. Default 8192 chars. */
  maxContentLength?: number;
}
