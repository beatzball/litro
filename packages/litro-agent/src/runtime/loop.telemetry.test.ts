/**
 * Telemetry behaviour of the turn loop.
 *
 * The load-bearing assertions here are the two that protect contracts, not
 * the attribute spot-checks: (1) telemetry NEVER changes what is appended
 * to the store or emitted to the wire, and (2) a UIResult's html never
 * reaches a span, even with content capture switched on.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'pathe';
import { runTurn, type TurnDeps } from './loop.js';
import { scriptedProvider } from '../providers/scripted.js';
import { fileSessionStore } from '../sessions/file.js';
import { defineTool, type AgentConfig, type ToolDefinition } from '../index.js';
import type { SessionEvent } from '../sessions/types.js';
import type { StandardSchemaV1 } from '@beatzball/litro/actions';
import { resolveTelemetry, GEN_AI, LITRO } from '../telemetry/runtime.js';
import { recordingTracer, type RecordedSpan } from '../telemetry/recording.js';

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'litro-agent-tel-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const textSchema: StandardSchemaV1<unknown, { text: string }> = {
  '~standard': {
    version: 1,
    vendor: 'litro-agent-test',
    validate(value) {
      const v = value as { text?: unknown } | null;
      if (typeof v?.text !== 'string') return { issues: [{ message: 'text must be a string' }] };
      return { value: { text: v.text } };
    },
  },
};

function echoTool(execute?: (input: { text: string }) => unknown): ToolDefinition {
  return defineTool({
    description: 'echoes text back',
    input: textSchema,
    execute: execute ?? ((input: { text: string }) => ({ echoed: input.text })),
  });
}

function makeDeps(opts: {
  model: AgentConfig['model'];
  tools?: Record<string, ToolDefinition>;
  telemetry?: TurnDeps['telemetry'];
  maxToolRounds?: number;
}): { deps: TurnDeps; emitted: SessionEvent[] } {
  const emitted: SessionEvent[] = [];
  const deps: TurnDeps = {
    agent: {
      name: 'concierge',
      config: { model: opts.model, instructions: 'be terse' },
      tools: new Map(Object.entries(opts.tools ?? {})),
    },
    store: fileSessionStore({ dir }),
    sessionId: 's1',
    event: undefined,
    emit: (ev) => emitted.push(ev),
    maxToolRounds: opts.maxToolRounds,
    telemetry: opts.telemetry,
  };
  return { deps, emitted };
}

function turnSpan(spans: RecordedSpan[]): RecordedSpan {
  return spans.find((s) => s.name.startsWith('invoke_agent'))!;
}

describe('runTurn telemetry -- span structure', () => {
  it('emits one invoke_agent span and one chat span for a plain text turn', async () => {
    const tracer = recordingTracer();
    const model = scriptedProvider(() => [{ type: 'text-delta', text: 'Hello' }, { type: 'done' }]);
    const { deps } = makeDeps({ model, telemetry: resolveTelemetry({ tracer }) });

    await runTurn(deps, 'hi there');

    expect(tracer.spans.map((s) => s.name)).toEqual(['invoke_agent concierge', 'chat scripted']);
    const [turn, chat] = tracer.spans;
    expect(turn.attributes[GEN_AI.operationName]).toBe('invoke_agent');
    expect(turn.attributes[GEN_AI.conversationId]).toBe('s1');
    expect(turn.attributes[GEN_AI.providerName]).toBe('scripted');
    expect(turn.attributes[LITRO.rounds]).toBe(1);
    expect(turn.error).toBeUndefined();
    expect(turn.ended).toBe(true);
    expect(chat.parent).toBe(turn);
    expect(chat.attributes[LITRO.round]).toBe(1);
    expect(chat.attributes[LITRO.toolCalls]).toBe(0);
    expect(chat.ended).toBe(true);
  });

  it('parents execute_tool to the TURN, not to the chat round that dispatched it', async () => {
    const tracer = recordingTracer();
    const model = scriptedProvider((_req, turn) =>
      turn === 1
        ? [{ type: 'tool-call' as const, id: 'call1', name: 'echo', input: { text: 'hi' } }, { type: 'done' as const }]
        : [{ type: 'text-delta' as const, text: 'done' }, { type: 'done' as const }],
    );
    const { deps } = makeDeps({ model, tools: { echo: echoTool() }, telemetry: resolveTelemetry({ tracer }) });

    await runTurn(deps, 'echo hi');

    const turn = turnSpan(tracer.spans);
    const chats = tracer.byName('chat ');
    const tools = tracer.byName('execute_tool ');
    expect(chats).toHaveLength(2);
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('execute_tool echo');
    expect(tools[0].parent).toBe(turn);
    expect(tools[0].parent).not.toBe(chats[0]);
    expect(tools[0].attributes[GEN_AI.toolCallId]).toBe('call1');
    expect(tools[0].attributes[GEN_AI.toolDescription]).toBe('echoes text back');
    expect(tools[0].error).toBeUndefined();
    expect(tools.every((s) => s.ended)).toBe(true);
    expect(turn.attributes[LITRO.rounds]).toBe(2);
    expect(chats[0].attributes[LITRO.toolCalls]).toBe(1);
    expect(chats[1].attributes[LITRO.toolCalls]).toBe(0);
  });

  it('runs the tool execute inside the tool span, so nested instrumentation parents correctly', async () => {
    const tracer = recordingTracer();
    let depthDuringExecute = -1;
    const tool = echoTool(() => {
      depthDuringExecute = tracer.byName('execute_tool ')[0]!.activeDepth;
      return { ok: true };
    });
    const model = scriptedProvider((_req, turn) =>
      turn === 1
        ? [{ type: 'tool-call' as const, id: 'c', name: 'echo', input: { text: 'hi' } }, { type: 'done' as const }]
        : [{ type: 'done' as const }],
    );
    const { deps } = makeDeps({ model, tools: { echo: tool }, telemetry: resolveTelemetry({ tracer }) });

    await runTurn(deps, 'go');

    expect(depthDuringExecute).toBe(1);
  });
});

describe('runTurn telemetry -- token usage', () => {
  it('records per-round usage on chat spans and the sum on the turn span', async () => {
    const tracer = recordingTracer();
    const model = scriptedProvider((_req, turn) =>
      turn === 1
        ? [
            { type: 'tool-call' as const, id: 'c', name: 'echo', input: { text: 'hi' } },
            { type: 'done' as const, usage: { inputTokens: 10, outputTokens: 2 } },
          ]
        : [{ type: 'text-delta' as const, text: 'ok' }, { type: 'done' as const, usage: { inputTokens: 20, outputTokens: 5 } }],
    );
    const { deps } = makeDeps({ model, tools: { echo: echoTool() }, telemetry: resolveTelemetry({ tracer }) });

    await runTurn(deps, 'go');

    const chats = tracer.byName('chat ');
    expect(chats[0].attributes[GEN_AI.inputTokens]).toBe(10);
    expect(chats[1].attributes[GEN_AI.inputTokens]).toBe(20);
    const turn = turnSpan(tracer.spans);
    expect(turn.attributes[GEN_AI.inputTokens]).toBe(30);
    expect(turn.attributes[GEN_AI.outputTokens]).toBe(7);
  });

  it('omits usage attributes when the provider reports none', async () => {
    const tracer = recordingTracer();
    const model = scriptedProvider(() => [{ type: 'done' }]);
    const { deps } = makeDeps({ model, telemetry: resolveTelemetry({ tracer }) });

    await runTurn(deps, 'go');

    const turn = turnSpan(tracer.spans);
    expect(GEN_AI.inputTokens in turn.attributes).toBe(false);
    expect(GEN_AI.outputTokens in turn.attributes).toBe(false);
  });
});

describe('runTurn telemetry -- error.type mapping', () => {
  it('provider-error marks both the chat span and the turn span', async () => {
    const tracer = recordingTracer();
    const model = scriptedProvider(() => [{ type: 'provider-error', message: 'upstream 502', status: 502 }]);
    const { deps, emitted } = makeDeps({ model, telemetry: resolveTelemetry({ tracer }) });

    await runTurn(deps, 'go');

    expect(tracer.byName('chat ')[0].error).toEqual({ type: 'provider_error', message: 'upstream 502' });
    expect(turnSpan(tracer.spans).error).toEqual({ type: 'provider_error', message: 'upstream 502' });
    // the turn still closes cleanly on the wire
    expect(emitted.map((e) => e.kind)).toEqual(['message', 'error', 'turn-end']);
  });

  it('the tool round limit marks the turn span', async () => {
    const tracer = recordingTracer();
    const model = scriptedProvider(() => [
      { type: 'tool-call', id: 'c', name: 'echo', input: { text: 'hi' } },
      { type: 'done' },
    ]);
    const { deps } = makeDeps({
      model,
      tools: { echo: echoTool() },
      maxToolRounds: 2,
      telemetry: resolveTelemetry({ tracer }),
    });

    await runTurn(deps, 'go');

    expect(turnSpan(tracer.spans).error).toEqual({
      type: 'tool_round_limit_exceeded',
      message: 'tool round limit exceeded',
    });
  });

  it('an unknown tool marks the tool span only -- the turn itself succeeds', async () => {
    const tracer = recordingTracer();
    const model = scriptedProvider((_req, turn) =>
      turn === 1
        ? [{ type: 'tool-call' as const, id: 'c', name: 'nope', input: {} }, { type: 'done' as const }]
        : [{ type: 'done' as const }],
    );
    const { deps } = makeDeps({ model, telemetry: resolveTelemetry({ tracer }) });

    await runTurn(deps, 'go');

    expect(tracer.byName('execute_tool ')[0].error?.type).toBe('unknown_tool');
    expect(turnSpan(tracer.spans).error).toBeUndefined();
  });

  it('a schema rejection is error.type validation_error', async () => {
    const tracer = recordingTracer();
    const model = scriptedProvider((_req, turn) =>
      turn === 1
        ? [{ type: 'tool-call' as const, id: 'c', name: 'echo', input: { text: 42 } }, { type: 'done' as const }]
        : [{ type: 'done' as const }],
    );
    const { deps } = makeDeps({ model, tools: { echo: echoTool() }, telemetry: resolveTelemetry({ tracer }) });

    await runTurn(deps, 'go');

    const tool = tracer.byName('execute_tool ')[0];
    expect(tool.error?.type).toBe('validation_error');
    expect(tool.error?.message).toContain('text must be a string');
  });

  it("a throwing tool uses the exception's class name as error.type, and never a stack", async () => {
    const tracer = recordingTracer();
    class RateLimitError extends Error {
      constructor() {
        super('rate limited');
        this.name = 'RateLimitError';
      }
    }
    const model = scriptedProvider((_req, turn) =>
      turn === 1
        ? [{ type: 'tool-call' as const, id: 'c', name: 'echo', input: { text: 'hi' } }, { type: 'done' as const }]
        : [{ type: 'done' as const }],
    );
    const { deps } = makeDeps({
      model,
      tools: {
        echo: echoTool(() => {
          throw new RateLimitError();
        }),
      },
      telemetry: resolveTelemetry({ tracer }),
    });

    await runTurn(deps, 'go');

    const tool = tracer.byName('execute_tool ')[0];
    expect(tool.error).toEqual({ type: 'RateLimitError', message: 'rate limited' });
    expect(JSON.stringify(tracer.spans)).not.toContain('loop.telemetry.test');
  });

  it('a nested UIResult is error.type nested_ui_result', async () => {
    const tracer = recordingTracer();
    const model = scriptedProvider((_req, turn) =>
      turn === 1
        ? [{ type: 'tool-call' as const, id: 'c', name: 'echo', input: { text: 'hi' } }, { type: 'done' as const }]
        : [{ type: 'done' as const }],
    );
    const { deps } = makeDeps({
      model,
      tools: {
        echo: echoTool(() => ({ card: { type: 'ui', html: '<x-card></x-card>', data: { a: 1 } } })),
      },
      telemetry: resolveTelemetry({ tracer }),
    });

    await runTurn(deps, 'go');

    expect(tracer.byName('execute_tool ')[0].error?.type).toBe('nested_ui_result');
  });

  it('closes the chat and turn spans when the provider generator throws, then rethrows', async () => {
    const tracer = recordingTracer();
    const model = {
      info: { system: 'exploding', model: 'boom' },
      // eslint-disable-next-line require-yield
      async *stream() {
        throw new TypeError('socket exploded');
      },
    };
    const { deps } = makeDeps({ model, telemetry: resolveTelemetry({ tracer }) });

    await expect(runTurn(deps, 'go')).rejects.toThrow('socket exploded');

    const chat = tracer.byName('chat ')[0];
    expect(chat.error).toEqual({ type: 'TypeError', message: 'socket exploded' });
    expect(chat.ended).toBe(true);
    const turn = turnSpan(tracer.spans);
    expect(turn.error).toEqual({ type: 'TypeError', message: 'socket exploded' });
    expect(turn.ended).toBe(true);
  });
});

describe('runTurn telemetry -- the html rule', () => {
  const html = '<weather-card>SECRET-MARKUP</weather-card>';

  it('flags a UI tool and keeps its html out of every span, even with captureContent on', async () => {
    const tracer = recordingTracer();
    const model = scriptedProvider((_req, turn) =>
      turn === 1
        ? [{ type: 'tool-call' as const, id: 'c', name: 'card', input: { text: 'lisbon' } }, { type: 'done' as const }]
        : [{ type: 'text-delta' as const, text: 'there you go' }, { type: 'done' as const }],
    );
    const { deps } = makeDeps({
      model,
      tools: {
        card: echoTool(() => ({ type: 'ui', html, data: { tempC: 21 } })),
      },
      telemetry: resolveTelemetry({ tracer, captureContent: true }),
    });

    await runTurn(deps, 'weather in lisbon');

    const tool = tracer.byName('execute_tool ')[0];
    expect(tool.attributes[LITRO.toolReturnedUi]).toBe(true);
    expect(tool.attributes[GEN_AI.toolCallResult]).toContain('21');
    // the whole trace, not just the tool span -- the second chat round's
    // captured input messages carry the tool result back to the model.
    expect(JSON.stringify(tracer.spans)).not.toContain('SECRET-MARKUP');
  });

  it('marks a non-UI tool as ui=false', async () => {
    const tracer = recordingTracer();
    const model = scriptedProvider((_req, turn) =>
      turn === 1
        ? [{ type: 'tool-call' as const, id: 'c', name: 'echo', input: { text: 'hi' } }, { type: 'done' as const }]
        : [{ type: 'done' as const }],
    );
    const { deps } = makeDeps({ model, tools: { echo: echoTool() }, telemetry: resolveTelemetry({ tracer }) });

    await runTurn(deps, 'go');

    expect(tracer.byName('execute_tool ')[0].attributes[LITRO.toolReturnedUi]).toBe(false);
  });
});

describe('runTurn telemetry -- behaviour is unchanged either way', () => {
  const script = (_req: unknown, turn: number) =>
    turn === 1
      ? [
          { type: 'text-delta' as const, text: 'looking...' },
          { type: 'tool-call' as const, id: 'c', name: 'echo', input: { text: 'hi' } },
          { type: 'done' as const },
        ]
      : [{ type: 'text-delta' as const, text: 'done' }, { type: 'done' as const }];

  it('produces an identical event sequence with and without a tracer', async () => {
    const withOff = makeDeps({ model: scriptedProvider(script), tools: { echo: echoTool() } });
    await runTurn(withOff.deps, 'go');

    // fresh session dir so seq numbering starts from the same place
    await rm(dir, { recursive: true, force: true });
    dir = await mkdtemp(join(tmpdir(), 'litro-agent-tel-'));

    const tracer = recordingTracer();
    const withOn = makeDeps({
      model: scriptedProvider(script),
      tools: { echo: echoTool() },
      telemetry: resolveTelemetry({ tracer, captureContent: true }),
    });
    await runTurn(withOn.deps, 'go');

    const strip = (evs: SessionEvent[]) => evs.map((e) => ({ seq: e.seq, kind: e.kind, payload: e.payload }));
    expect(strip(withOn.emitted)).toEqual(strip(withOff.emitted));
    expect(tracer.spans.length).toBeGreaterThan(0);
  });

  it('runs with no telemetry field at all (the default no-op path)', async () => {
    const { deps, emitted } = makeDeps({ model: scriptedProvider(() => [{ type: 'text-delta', text: 'hi' }, { type: 'done' }]) });
    await runTurn(deps, 'go');
    expect(emitted.map((e) => e.kind)).toEqual(['message', 'text-delta', 'message', 'turn-end']);
  });
});
