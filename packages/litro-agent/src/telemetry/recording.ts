/**
 * Test-only recording tracer. Lives in src (not a .test.ts) so more than
 * one spec file can share it; it is not part of the package's public
 * exports map.
 */
import type { AgentSpan, AgentTracer, SpanAttributes, StartSpanOptions } from './types.js';

export interface RecordedSpan {
  name: string;
  attributes: Record<string, string | number | boolean>;
  parent: RecordedSpan | undefined;
  error: { type: string; message?: string } | undefined;
  ended: boolean;
  /** True while this span was ambient via `withActiveSpan`. */
  activeDepth: number;
}

class RecordingSpan implements AgentSpan {
  readonly record: RecordedSpan;

  constructor(name: string, parent: RecordedSpan | undefined) {
    this.record = { name, attributes: {}, parent, error: undefined, ended: false, activeDepth: 0 };
  }

  setAttributes(attrs: SpanAttributes): void {
    for (const [k, v] of Object.entries(attrs)) {
      if (v !== undefined) this.record.attributes[k] = v;
    }
  }

  setError(type: string, message?: string): void {
    this.record.error = { type, message };
  }

  end(): void {
    this.record.ended = true;
  }
}

export interface RecordingTracer extends AgentTracer {
  readonly spans: RecordedSpan[];
  byName(prefix: string): RecordedSpan[];
}

export function recordingTracer(opts: { withActive?: boolean } = {}): RecordingTracer {
  const spans: RecordedSpan[] = [];
  const stack: RecordingSpan[] = [];

  const tracer: RecordingTracer = {
    spans,
    byName(prefix: string) {
      return spans.filter((s) => s.name.startsWith(prefix));
    },
    startSpan(name: string, options: StartSpanOptions = {}): AgentSpan {
      const parent = options.parent instanceof RecordingSpan ? options.parent.record : undefined;
      const span = new RecordingSpan(name, parent);
      span.setAttributes(options.attributes ?? {});
      spans.push(span.record);
      return span;
    },
  };

  if (opts.withActive !== false) {
    tracer.withActiveSpan = <T>(span: AgentSpan, fn: () => T): T => {
      if (!(span instanceof RecordingSpan)) return fn();
      stack.push(span);
      span.record.activeDepth += 1;
      try {
        return fn();
      } finally {
        stack.pop();
      }
    };
  }

  return tracer;
}
