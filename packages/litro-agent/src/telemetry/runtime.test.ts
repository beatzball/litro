import { describe, it, expect } from 'vitest';
import { resolveTelemetry, sanitizeForCapture, NOOP_TELEMETRY, GEN_AI, LITRO } from './runtime.js';
import { recordingTracer } from './recording.js';
import type { ProviderRequest } from '../providers/types.js';

const request: ProviderRequest = {
  system: 'be terse',
  messages: [{ role: 'user', content: 'hello' }],
  tools: [],
};

describe('resolveTelemetry', () => {
  it('returns the shared no-op instance when no tracer is configured', () => {
    expect(resolveTelemetry()).toBe(NOOP_TELEMETRY);
    expect(resolveTelemetry(null)).toBe(NOOP_TELEMETRY);
    expect(resolveTelemetry({})).toBe(NOOP_TELEMETRY);
    expect(resolveTelemetry({ captureContent: true })).toBe(NOOP_TELEMETRY);
    expect(NOOP_TELEMETRY.enabled).toBe(false);
  });

  it('the no-op path still runs the callback passed to withActiveSpan', () => {
    let ran = false;
    const out = NOOP_TELEMETRY.withActiveSpan(NOOP_TELEMETRY.startTurn({ agentName: 'a', sessionId: 's' }), () => {
      ran = true;
      return 42;
    });
    expect(ran).toBe(true);
    expect(out).toBe(42);
  });

  it('is enabled once a tracer is supplied', () => {
    expect(resolveTelemetry({ tracer: recordingTracer() }).enabled).toBe(true);
  });
});

describe('span shapes', () => {
  it('names and attributes the invoke_agent span per the GenAI conventions', () => {
    const tracer = recordingTracer();
    const tel = resolveTelemetry({ tracer });
    const span = tel.startTurn({ agentName: 'concierge', sessionId: 'sess-1', provider: 'anthropic', model: 'm-1' });
    tel.endTurn(span, { rounds: 2, usage: { inputTokens: 10, outputTokens: 4 } });

    const rec = tracer.spans[0];
    expect(rec.name).toBe('invoke_agent concierge');
    expect(rec.attributes[GEN_AI.operationName]).toBe('invoke_agent');
    expect(rec.attributes[GEN_AI.agentName]).toBe('concierge');
    expect(rec.attributes[GEN_AI.conversationId]).toBe('sess-1');
    expect(rec.attributes[GEN_AI.providerName]).toBe('anthropic');
    // back-compat alias for backends still keyed on the older name
    expect(rec.attributes[GEN_AI.system]).toBe('anthropic');
    expect(rec.attributes[GEN_AI.requestModel]).toBe('m-1');
    expect(rec.attributes[LITRO.rounds]).toBe(2);
    expect(rec.attributes[GEN_AI.inputTokens]).toBe(10);
    expect(rec.attributes[GEN_AI.outputTokens]).toBe(4);
    expect(rec.ended).toBe(true);
  });

  it('omits provider/model attributes entirely when the provider has no info', () => {
    const tracer = recordingTracer();
    const tel = resolveTelemetry({ tracer });
    tel.endTurn(tel.startTurn({ agentName: 'a', sessionId: 's' }), { rounds: 1, usage: {} });

    const attrs = tracer.spans[0].attributes;
    expect(GEN_AI.providerName in attrs).toBe(false);
    expect(GEN_AI.requestModel in attrs).toBe(false);
    expect(GEN_AI.inputTokens in attrs).toBe(false);
  });

  it('parents chat and execute_tool spans to the span it is handed', () => {
    const tracer = recordingTracer();
    const tel = resolveTelemetry({ tracer });
    const turn = tel.startTurn({ agentName: 'a', sessionId: 's' });
    const chat = tel.startChat(turn, { provider: 'openai', model: 'gpt', round: 1, request });
    const tool = tel.startTool(turn, { name: 'weather', callId: 'c1', description: 'gets weather', input: {} });

    const [turnRec, chatRec, toolRec] = tracer.spans;
    expect(chatRec.name).toBe('chat gpt');
    expect(chatRec.parent).toBe(turnRec);
    expect(chatRec.attributes[LITRO.round]).toBe(1);
    expect(toolRec.name).toBe('execute_tool weather');
    // sibling of the chat round, not a child of it
    expect(toolRec.parent).toBe(turnRec);
    expect(toolRec.attributes[GEN_AI.toolName]).toBe('weather');
    expect(toolRec.attributes[GEN_AI.toolCallId]).toBe('c1');
    expect(toolRec.attributes[GEN_AI.toolDescription]).toBe('gets weather');
    expect(toolRec.attributes[GEN_AI.toolType]).toBe('function');
    void chat;
    void tool;
  });

  it('records error.type on a failed span', () => {
    const tracer = recordingTracer();
    const tel = resolveTelemetry({ tracer });
    const turn = tel.startTurn({ agentName: 'a', sessionId: 's' });
    tel.endTool(tel.startTool(turn, { name: 't', callId: 'c', input: {} }), {
      ui: false,
      error: { type: 'validation_error', message: 'bad input' },
    });

    const toolRec = tracer.spans[1];
    expect(toolRec.error).toEqual({ type: 'validation_error', message: 'bad input' });
    expect(toolRec.ended).toBe(true);
  });

  it('falls back to calling fn directly when the tracer has no withActiveSpan', () => {
    const tracer = recordingTracer({ withActive: false });
    const tel = resolveTelemetry({ tracer });
    expect(tel.withActiveSpan(tel.startTurn({ agentName: 'a', sessionId: 's' }), () => 'ran')).toBe('ran');
  });
});

describe('content capture', () => {
  it('records no content attributes by default', () => {
    const tracer = recordingTracer();
    const tel = resolveTelemetry({ tracer });
    const turn = tel.startTurn({ agentName: 'a', sessionId: 's' });
    tel.endChat(tel.startChat(turn, { round: 1, request }), { text: 'hi there', toolCalls: 0, usage: {} });
    tel.endTool(tel.startTool(turn, { name: 't', callId: 'c', input: { secret: 'x' } }), {
      ui: false,
      result: { secret: 'y' },
    });

    for (const span of tracer.spans) {
      expect(GEN_AI.inputMessages in span.attributes).toBe(false);
      expect(GEN_AI.outputMessages in span.attributes).toBe(false);
      expect(GEN_AI.toolCallArguments in span.attributes).toBe(false);
      expect(GEN_AI.toolCallResult in span.attributes).toBe(false);
    }
  });

  it('records content attributes when captureContent is on', () => {
    const tracer = recordingTracer();
    const tel = resolveTelemetry({ tracer, captureContent: true });
    const turn = tel.startTurn({ agentName: 'a', sessionId: 's' });
    tel.endChat(tel.startChat(turn, { round: 1, request }), { text: 'hi there', toolCalls: 0, usage: {} });
    tel.endTool(tel.startTool(turn, { name: 't', callId: 'c', input: { city: 'lisbon' } }), {
      ui: false,
      result: { tempC: 22 },
    });

    const chat = tracer.spans[1];
    expect(chat.attributes[GEN_AI.inputMessages]).toContain('hello');
    expect(chat.attributes[GEN_AI.outputMessages]).toContain('hi there');
    const tool = tracer.spans[2];
    expect(tool.attributes[GEN_AI.toolCallArguments]).toContain('lisbon');
    expect(tool.attributes[GEN_AI.toolCallResult]).toContain('22');
  });

  it('truncates captured content at maxContentLength', () => {
    const tracer = recordingTracer();
    const tel = resolveTelemetry({ tracer, captureContent: true, maxContentLength: 32 });
    tel.endTool(
      tel.startTool(tel.startTurn({ agentName: 'a', sessionId: 's' }), {
        name: 't',
        callId: 'c',
        input: { long: 'x'.repeat(500) },
      }),
      { ui: false },
    );

    const captured = tracer.spans[1].attributes[GEN_AI.toolCallArguments] as string;
    expect(captured.startsWith('{"long":"xxx')).toBe(true);
    expect(captured.endsWith('…[truncated]')).toBe(true);
    expect(captured.length).toBe(32 + '…[truncated]'.length);
  });

  it('survives an unserializable value instead of throwing', () => {
    const tracer = recordingTracer();
    const tel = resolveTelemetry({ tracer, captureContent: true });
    tel.endTool(
      tel.startTool(tel.startTurn({ agentName: 'a', sessionId: 's' }), {
        name: 't',
        callId: 'c',
        input: { big: 1n },
      }),
      { ui: false },
    );
    expect(tracer.spans[1].attributes[GEN_AI.toolCallArguments]).toBe('"[unserializable]"');
  });
});

describe('sanitizeForCapture -- html never reaches a span', () => {
  const uiResult = { type: 'ui' as const, html: '<x-card>SECRET-MARKUP</x-card>', data: { temp: 21 } };

  it('replaces a top-level UIResult with a html-free stand-in', () => {
    expect(sanitizeForCapture(uiResult)).toEqual({ type: 'ui', data: { temp: 21 } });
  });

  it('replaces a nested UIResult too', () => {
    const out = JSON.stringify(sanitizeForCapture({ card: uiResult, other: [uiResult] }));
    expect(out).not.toContain('SECRET-MARKUP');
    expect(out).toContain('21');
  });

  it('strips html even through captureContent on a real tool span', () => {
    const tracer = recordingTracer();
    const tel = resolveTelemetry({ tracer, captureContent: true });
    tel.endTool(tel.startTool(tel.startTurn({ agentName: 'a', sessionId: 's' }), { name: 't', callId: 'c', input: {} }), {
      ui: true,
      result: uiResult,
    });

    const attrs = tracer.spans[1].attributes;
    expect(attrs[LITRO.toolReturnedUi]).toBe(true);
    expect(JSON.stringify(attrs)).not.toContain('SECRET-MARKUP');
    expect(attrs[GEN_AI.toolCallResult]).toContain('21');
  });

  it('is cycle-safe and depth-capped', () => {
    const cyclic: Record<string, unknown> = { name: 'root' };
    cyclic.self = cyclic;
    expect(() => JSON.stringify(sanitizeForCapture(cyclic))).not.toThrow();

    let deep: unknown = uiResult;
    for (let i = 0; i < 20; i++) deep = { next: deep };
    expect(JSON.stringify(sanitizeForCapture(deep))).not.toContain('SECRET-MARKUP');
  });

  it('passes primitives through untouched', () => {
    expect(sanitizeForCapture('hi')).toBe('hi');
    expect(sanitizeForCapture(7)).toBe(7);
    expect(sanitizeForCapture(null)).toBe(null);
    expect(sanitizeForCapture(undefined)).toBe(undefined);
  });
});
