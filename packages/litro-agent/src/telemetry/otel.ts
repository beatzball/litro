/**
 * OpenTelemetry adapter — the ONLY place in this package that knows about
 * the OTel API shape, and it still does not import it.
 *
 * `@opentelemetry/api` is passed IN by the caller rather than imported
 * here. That keeps the package dependency-free (no peer dep to resolve, no
 * dynamic import, no top-level await in a server bundle) and guarantees the
 * runtime uses the exact same `@opentelemetry/api` singleton the app
 * registered its SDK against — a duplicated api copy is the classic reason
 * spans silently vanish.
 *
 * ```ts
 * // agents/_config.ts
 * import * as otel from '@opentelemetry/api';
 * import { defineAgentConfig } from '@beatzball/litro-agent';
 * import { otelTracer } from '@beatzball/litro-agent/telemetry';
 *
 * export default defineAgentConfig({
 *   telemetry: { tracer: otelTracer(otel) },
 * });
 * ```
 */
import type { AgentSpan, AgentTracer, SpanAttributes, StartSpanOptions } from './types.js';

/** Structural subset of an OTel `Span` this adapter uses. */
export interface OtelSpanLike {
  setAttributes(attributes: Record<string, unknown>): unknown;
  setStatus(status: { code: number; message?: string }): unknown;
  end(): void;
}

/** Structural subset of the `@opentelemetry/api` namespace this adapter
 *  uses. Declared structurally so the package carries no OTel types. */
export interface OtelApiLike {
  trace: {
    getTracer(name: string, version?: string): { startSpan(name: string, options?: unknown, context?: unknown): OtelSpanLike };
    setSpan(context: unknown, span: OtelSpanLike): unknown;
  };
  context: {
    active(): unknown;
    with<T>(context: unknown, fn: () => T): T;
  };
  SpanStatusCode?: { ERROR?: number };
}

export interface OtelTracerOptions {
  /** Instrumentation scope name. Defaults to the package name. */
  name?: string;
  /** Instrumentation scope version. */
  version?: string;
}

/** OTel's `SpanStatusCode.ERROR`, used when the api namespace does not
 *  expose the enum (a partial/stubbed api object). */
const SPAN_STATUS_ERROR = 2;

const ERROR_TYPE = 'error.type';

class OtelAgentSpan implements AgentSpan {
  constructor(
    readonly raw: OtelSpanLike,
    private readonly errorCode: number,
  ) {}

  setAttributes(attrs: SpanAttributes): void {
    const cleaned = stripUndefined(attrs);
    if (Object.keys(cleaned).length > 0) this.raw.setAttributes(cleaned);
  }

  setError(type: string, message?: string): void {
    this.raw.setAttributes({ [ERROR_TYPE]: type });
    this.raw.setStatus(message === undefined ? { code: this.errorCode } : { code: this.errorCode, message });
  }

  end(): void {
    this.raw.end();
  }
}

function stripUndefined(attrs: SpanAttributes): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(attrs)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

/**
 * Wraps the `@opentelemetry/api` namespace as an `AgentTracer`.
 *
 * Parentage is explicit: a `parent` span is turned into a real OTel context
 * via `trace.setSpan`, so nesting is correct even with no context manager
 * registered. `withActiveSpan` additionally makes a span ambient, so
 * instrumentation inside a tool's own `execute()` parents to the tool span.
 */
export function otelTracer(api: OtelApiLike, opts: OtelTracerOptions = {}): AgentTracer {
  const tracer = api.trace.getTracer(opts.name ?? '@beatzball/litro-agent', opts.version);
  const errorCode = api.SpanStatusCode?.ERROR ?? SPAN_STATUS_ERROR;

  return {
    startSpan(name: string, options: StartSpanOptions = {}): AgentSpan {
      const attributes = stripUndefined(options.attributes ?? {});
      const parent = options.parent;
      const ctx =
        parent instanceof OtelAgentSpan ? api.trace.setSpan(api.context.active(), parent.raw) : api.context.active();
      return new OtelAgentSpan(tracer.startSpan(name, { attributes }, ctx), errorCode);
    },

    withActiveSpan<T>(span: AgentSpan, fn: () => T): T {
      if (!(span instanceof OtelAgentSpan)) return fn();
      return api.context.with(api.trace.setSpan(api.context.active(), span.raw), fn);
    },
  };
}
