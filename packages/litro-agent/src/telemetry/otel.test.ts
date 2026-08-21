import { describe, it, expect } from 'vitest';
import { otelTracer, type OtelApiLike, type OtelSpanLike } from './otel.js';
import { resolveTelemetry, GEN_AI } from './runtime.js';

/**
 * A faithful stand-in for the `@opentelemetry/api` namespace: same call
 * shapes (`trace.getTracer`, `tracer.startSpan(name, options, context)`,
 * `trace.setSpan`, `context.active`, `context.with`) and the same
 * `SpanStatusCode.ERROR = 2` value.
 *
 * `@opentelemetry/api` itself is deliberately NOT a devDependency: adding
 * it forced pnpm to re-resolve nitropack's `vite` peer across the
 * workspace lockfile, which is unrelated churn. The adapter is structurally
 * typed, so this fake exercises exactly the surface it depends on.
 */
interface FakeSpan extends OtelSpanLike {
  name: string;
  attributes: Record<string, unknown>;
  status: { code: number; message?: string } | undefined;
  parentOf: FakeSpan | undefined;
  ended: boolean;
}

function fakeApi(): { api: OtelApiLike; spans: FakeSpan[]; activeStack: FakeSpan[] } {
  const spans: FakeSpan[] = [];
  const activeStack: FakeSpan[] = [];
  // A "context" here is just the span it carries (or undefined for root).
  let active: FakeSpan | undefined;

  const api: OtelApiLike = {
    trace: {
      getTracer(name: string, version?: string) {
        void name;
        void version;
        return {
          startSpan(spanName: string, options?: unknown, ctx?: unknown): OtelSpanLike {
            const attrs = ((options as { attributes?: Record<string, unknown> } | undefined)?.attributes ?? {}) as Record<
              string,
              unknown
            >;
            const span: FakeSpan = {
              name: spanName,
              attributes: { ...attrs },
              status: undefined,
              parentOf: ctx as FakeSpan | undefined,
              ended: false,
              setAttributes(next: Record<string, unknown>) {
                Object.assign(span.attributes, next);
                return span;
              },
              setStatus(status: { code: number; message?: string }) {
                span.status = status;
                return span;
              },
              end() {
                span.ended = true;
              },
            };
            spans.push(span);
            return span;
          },
        };
      },
      setSpan(_ctx: unknown, span: OtelSpanLike) {
        return span as FakeSpan;
      },
    },
    context: {
      active() {
        return active;
      },
      with<T>(ctx: unknown, fn: () => T): T {
        const prev = active;
        active = ctx as FakeSpan;
        activeStack.push(active);
        try {
          return fn();
        } finally {
          active = prev;
        }
      },
    },
    SpanStatusCode: { ERROR: 2 },
  };

  return { api, spans, activeStack };
}

describe('otelTracer', () => {
  it('passes attributes through and drops undefined values', () => {
    const { api, spans } = fakeApi();
    const tracer = otelTracer(api);
    tracer.startSpan('chat m', { attributes: { a: 'x', b: 3, c: true, d: undefined } });

    expect(spans[0].name).toBe('chat m');
    expect(spans[0].attributes).toEqual({ a: 'x', b: 3, c: true });
    expect('d' in spans[0].attributes).toBe(false);
  });

  it('turns an explicit parent into a real context so nesting works with no context manager', () => {
    const { api, spans } = fakeApi();
    const tracer = otelTracer(api);
    const parent = tracer.startSpan('invoke_agent a');
    tracer.startSpan('execute_tool t', { parent });

    expect(spans[1].parentOf).toBe(spans[0]);
  });

  it('roots a span with no parent', () => {
    const { api, spans } = fakeApi();
    otelTracer(api).startSpan('invoke_agent a');
    expect(spans[0].parentOf).toBeUndefined();
  });

  it('ignores a foreign span passed as parent instead of throwing', () => {
    const { api, spans } = fakeApi();
    const foreign = { setAttributes() {}, setError() {}, end() {} };
    otelTracer(api).startSpan('chat m', { parent: foreign });
    expect(spans[0].parentOf).toBeUndefined();
  });

  it('records error.type as an attribute and ERROR as the span status', () => {
    const { api, spans } = fakeApi();
    const span = otelTracer(api).startSpan('execute_tool t');
    span.setError('validation_error', 'text must be a string');

    expect(spans[0].attributes['error.type']).toBe('validation_error');
    expect(spans[0].status).toEqual({ code: 2, message: 'text must be a string' });
  });

  it('omits the status message when none is given', () => {
    const { api, spans } = fakeApi();
    otelTracer(api).startSpan('chat m').setError('provider_error');
    expect(spans[0].status).toEqual({ code: 2 });
  });

  it('falls back to SpanStatusCode.ERROR = 2 when the api omits the enum', () => {
    const { api, spans } = fakeApi();
    delete (api as { SpanStatusCode?: unknown }).SpanStatusCode;
    otelTracer(api).startSpan('chat m').setError('boom');
    expect(spans[0].status?.code).toBe(2);
  });

  it('ends the underlying span', () => {
    const { api, spans } = fakeApi();
    otelTracer(api).startSpan('chat m').end();
    expect(spans[0].ended).toBe(true);
  });

  it('makes a span ambient inside withActiveSpan, and restores after', () => {
    const { api, activeStack } = fakeApi();
    const tracer = otelTracer(api);
    const span = tracer.startSpan('execute_tool t');

    let insideActive: unknown;
    const out = tracer.withActiveSpan!(span, () => {
      insideActive = api.context.active();
      return 'done';
    });

    expect(out).toBe('done');
    expect(activeStack).toHaveLength(1);
    expect(insideActive).toBe(activeStack[0]);
    expect(api.context.active()).toBeUndefined();
  });

  it('withActiveSpan just runs the callback for a foreign span', () => {
    const { api, activeStack } = fakeApi();
    const foreign = { setAttributes() {}, setError() {}, end() {} };
    expect(otelTracer(api).withActiveSpan!(foreign, () => 'ran')).toBe('ran');
    expect(activeStack).toHaveLength(0);
  });

  it('uses the package name as the default instrumentation scope', () => {
    const seen: string[] = [];
    const { api } = fakeApi();
    const getTracer = api.trace.getTracer.bind(api.trace);
    api.trace.getTracer = (name: string, version?: string) => {
      seen.push(name);
      return getTracer(name, version);
    };
    otelTracer(api);
    otelTracer(api, { name: 'my-agents', version: '2.0.0' });
    expect(seen).toEqual(['@beatzball/litro-agent', 'my-agents']);
  });

  it('composes with the telemetry facade end to end', () => {
    const { api, spans } = fakeApi();
    const tel = resolveTelemetry({ tracer: otelTracer(api) });
    const turn = tel.startTurn({ agentName: 'concierge', sessionId: 's1', provider: 'anthropic', model: 'm' });
    tel.endTurn(turn, { rounds: 1, usage: { inputTokens: 5 } });

    expect(spans[0].name).toBe('invoke_agent concierge');
    expect(spans[0].attributes[GEN_AI.conversationId]).toBe('s1');
    expect(spans[0].attributes[GEN_AI.inputTokens]).toBe(5);
    expect(spans[0].ended).toBe(true);
  });
});
