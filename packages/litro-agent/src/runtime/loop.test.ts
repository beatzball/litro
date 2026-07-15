import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'pathe';
import { runTurn, type TurnDeps } from './loop.js';
import { scriptedProvider } from '../providers/scripted.js';
import { fileSessionStore } from '../sessions/file.js';
import { defineTool, TOOL_CONFIG, type AgentConfig, type ToolDefinition } from '../index.js';
import type { ProviderRequest } from '../providers/types.js';
import type { SessionEvent } from '../sessions/types.js';
import type { StandardSchemaV1 } from '@beatzball/litro/actions';

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'litro-agent-loop-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

// Schema that requires { text: string }.
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
    execute: execute ?? (async (input: { text: string }) => ({ echoed: input.text })),
  });
}

/** Wraps a raw callback emit fn with an instrumented one that, at the moment
 *  of each call, asserts the event is ALREADY durable on disk (append must
 *  resolve before emit fires -- the keystone ordering contract). */
function trackedEmit(filePath: string) {
  const emitted: SessionEvent[] = [];
  const emit = (ev: SessionEvent) => {
    const raw = existsSync(filePath) ? readFileSync(filePath, 'utf-8') : '';
    const lines = raw.trim() === '' ? 0 : raw.trim().split('\n').length;
    expect(lines).toBeGreaterThanOrEqual(ev.seq);
    emitted.push(ev);
  };
  return { emit, emitted };
}

function makeDeps(opts: {
  tools?: Record<string, ToolDefinition>;
  model: AgentConfig['model'];
  sessionId?: string;
  maxToolRounds?: number;
}): { deps: TurnDeps; emitted: SessionEvent[]; store: ReturnType<typeof fileSessionStore>; sessionId: string } {
  const sessionId = opts.sessionId ?? 's1';
  const store = fileSessionStore({ dir });
  const filePath = join(dir, `${sessionId}.jsonl`);
  const { emit, emitted } = trackedEmit(filePath);
  const tools = new Map<string, ToolDefinition>(Object.entries(opts.tools ?? {}));
  const deps: TurnDeps = {
    agent: { name: 'test-agent', config: { model: opts.model, instructions: 'be terse' }, tools },
    store,
    sessionId,
    event: undefined,
    emit,
    maxToolRounds: opts.maxToolRounds,
  };
  return { deps, emitted, store, sessionId };
}

async function persistedLog(store: ReturnType<typeof fileSessionStore>, sessionId: string): Promise<SessionEvent[]> {
  const out: SessionEvent[] = [];
  for await (const ev of store.read(sessionId)) out.push(ev);
  return out;
}

describe('runTurn', () => {
  it('plain text turn: message(user), text-delta*, message(assistant), turn-end', async () => {
    const model = scriptedProvider(() => [
      { type: 'text-delta', text: 'Hel' },
      { type: 'text-delta', text: 'lo' },
      { type: 'done' },
    ]);
    const { deps, emitted, store, sessionId } = makeDeps({ model });

    await runTurn(deps, 'hi there');

    expect(emitted.map((e) => e.kind)).toEqual(['message', 'text-delta', 'text-delta', 'message', 'turn-end']);
    expect(emitted[0]!.payload).toEqual({ role: 'user', text: 'hi there' });
    expect(emitted[3]!.payload).toEqual({ role: 'assistant', text: 'Hello' });

    const persisted = await persistedLog(store, sessionId);
    expect(persisted).toEqual(emitted);
  });

  it('one tool round: tool-call -> tool-result, then a clean second-round finish', async () => {
    const requests: ProviderRequest[] = [];
    const model = scriptedProvider((req, turn) => {
      requests.push(req);
      if (turn === 1) {
        return [{ type: 'tool-call', id: 'call1', name: 'echo', input: { text: 'hi' } }, { type: 'done' }];
      }
      return [{ type: 'text-delta', text: 'done' }, { type: 'done' }];
    });
    const { deps, emitted, store, sessionId } = makeDeps({ model, tools: { echo: echoTool() } });

    await runTurn(deps, 'say hi');

    expect(emitted.map((e) => e.kind)).toEqual([
      'message',
      'tool-call',
      'tool-result',
      'text-delta',
      'message',
      'turn-end',
    ]);
    const toolCallEv = emitted[1]!;
    expect(toolCallEv.payload).toEqual({ id: 'call1', name: 'echo', input: { text: 'hi' } });
    const toolResultEv = emitted[2]!;
    expect(toolResultEv.payload).toEqual({ echoed: 'hi' });
    expect(emitted[4]!.payload).toEqual({ role: 'assistant', text: 'done' });

    expect(requests).toHaveLength(2);
    const secondReq = requests[1]!;
    const assistantMsg = secondReq.messages.find((m) => m.role === 'assistant' && m.toolCalls);
    expect(assistantMsg?.toolCalls).toEqual([{ id: 'call1', name: 'echo', input: { text: 'hi' } }]);
    const toolMsg = secondReq.messages.find((m) => m.role === 'tool');
    expect(toolMsg?.toolCallId).toBe('call1');
    expect(toolMsg?.content).toBe(JSON.stringify({ echoed: 'hi' }));

    const persisted = await persistedLog(store, sessionId);
    expect(persisted).toEqual(emitted);
  });

  it('UIResult tool: emits a ui event with html; model only ever sees data', async () => {
    const secretHtml = '<template shadowrootmode="open"><weather-card></weather-card></template>';
    const uiTool = defineTool({
      description: 'renders a card',
      input: textSchema,
      async execute() {
        return { type: 'ui' as const, html: secretHtml, data: { ok: true } };
      },
    });
    const requests: ProviderRequest[] = [];
    const model = scriptedProvider((req, turn) => {
      requests.push(req);
      if (turn === 1) {
        return [{ type: 'tool-call', id: 'call1', name: 'card', input: { text: 'x' } }, { type: 'done' }];
      }
      return [{ type: 'text-delta', text: 'ok' }, { type: 'done' }];
    });
    const { deps, emitted, store, sessionId } = makeDeps({ model, tools: { card: uiTool } });

    await runTurn(deps, 'show a card');

    expect(emitted.map((e) => e.kind)).toEqual(['message', 'tool-call', 'ui', 'text-delta', 'message', 'turn-end']);
    const uiEv = emitted[2]!;
    expect(uiEv.payload).toEqual({ type: 'ui', html: secretHtml, data: { ok: true } });

    for (const req of requests) {
      for (const m of req.messages) {
        expect(m.content).not.toContain('shadowroot');
        expect(m.content).not.toContain(secretHtml);
      }
    }
    const secondReq = requests[1]!;
    const toolMsg = secondReq.messages.find((m) => m.role === 'tool');
    expect(toolMsg?.content).toBe(JSON.stringify({ ok: true }));

    const persisted = await persistedLog(store, sessionId);
    expect(persisted).toEqual(emitted);
  });

  it('async-generator tool: tool-progress per yield, tool-result from the return value', async () => {
    const genTool = defineTool({
      description: 'streams steps',
      input: textSchema,
      async *execute() {
        yield { step: 1 };
        yield { step: 2 };
        return { finished: true };
      },
    });
    const model = scriptedProvider((_req, turn) => {
      if (turn === 1) {
        return [{ type: 'tool-call', id: 'call1', name: 'gen', input: { text: 'x' } }, { type: 'done' }];
      }
      return [{ type: 'done' }];
    });
    const { deps, emitted, store, sessionId } = makeDeps({ model, tools: { gen: genTool } });

    await runTurn(deps, 'go');

    expect(emitted.map((e) => e.kind)).toEqual([
      'message',
      'tool-call',
      'tool-progress',
      'tool-progress',
      'tool-result',
      'message',
      'turn-end',
    ]);
    expect(emitted[2]!.payload).toEqual({ step: 1 });
    expect(emitted[3]!.payload).toEqual({ step: 2 });
    expect(emitted[4]!.payload).toEqual({ finished: true });
    expect(emitted[5]!.payload).toEqual({ role: 'assistant', text: '' });

    const persisted = await persistedLog(store, sessionId);
    expect(persisted).toEqual(emitted);
  });

  it('tool throw and unknown tool: error-shaped tool-result, loop continues, turn completes', async () => {
    const throwingTool = defineTool({
      description: 'always throws',
      input: textSchema,
      async execute() {
        throw new Error('boom');
      },
    });
    const model = scriptedProvider((_req, turn) => {
      if (turn === 1) {
        return [
          { type: 'tool-call', id: 'call1', name: 'boom', input: { text: 'x' } },
          { type: 'tool-call', id: 'call2', name: 'nope', input: { text: 'x' } },
          { type: 'done' },
        ];
      }
      return [{ type: 'text-delta', text: 'recovered' }, { type: 'done' }];
    });
    const { deps, emitted, store, sessionId } = makeDeps({ model, tools: { boom: throwingTool } });

    await runTurn(deps, 'try things');

    const kinds = emitted.map((e) => e.kind);
    expect(kinds).toEqual([
      'message',
      'tool-call',
      'tool-result',
      'tool-call',
      'tool-result',
      'text-delta',
      'message',
      'turn-end',
    ]);
    const throwResult = emitted[2]!.payload as { error: { message: string } };
    expect(throwResult.error.message).toMatch(/boom/);
    expect(throwResult).not.toHaveProperty('stack');
    const unknownResult = emitted[4]!.payload as { error: { message: string } };
    expect(unknownResult.error.message).toMatch(/nope/);
    expect(emitted[6]!.payload).toEqual({ role: 'assistant', text: 'recovered' });

    const persisted = await persistedLog(store, sessionId);
    expect(persisted).toEqual(emitted);
  });

  it('invalid tool input (schema reject): error tool-result mentioning validation', async () => {
    const model = scriptedProvider((_req, turn) => {
      if (turn === 1) {
        return [{ type: 'tool-call', id: 'call1', name: 'echo', input: { wrong: true } }, { type: 'done' }];
      }
      return [{ type: 'text-delta', text: 'ok' }, { type: 'done' }];
    });
    const { deps, emitted } = makeDeps({ model, tools: { echo: echoTool() } });

    await runTurn(deps, 'bad input');

    const toolResultEv = emitted.find((e) => e.kind === 'tool-result')!;
    const payload = toolResultEv.payload as { error: { message: string } };
    expect(payload.error.message).toMatch(/valid/i);
  });

  it('provider-error mid-turn: error + turn-end, no throw, session stays resumable', async () => {
    const model = scriptedProvider(() => [
      { type: 'text-delta', text: 'partial' },
      { type: 'provider-error', message: 'upstream exploded', status: 502 },
    ]);
    const { deps, emitted, store, sessionId } = makeDeps({ model });

    await expect(runTurn(deps, 'hi')).resolves.toBeUndefined();

    expect(emitted.map((e) => e.kind)).toEqual(['message', 'text-delta', 'error', 'turn-end']);
    expect(emitted[2]!.payload).toEqual({ message: 'upstream exploded', status: 502 });

    const persisted = await persistedLog(store, sessionId);
    expect(persisted).toEqual(emitted);
  });

  it('async-generator tool returning a UIResult: ui event (not tool-result), model only sees data', async () => {
    const secretHtml = '<template shadowrootmode="open"><x-a>secret-html-marker</x-a></template>';
    const genUiTool = defineTool({
      description: 'streams then returns a card',
      input: textSchema,
      async *execute() {
        yield { step: 1 };
        return { type: 'ui' as const, html: secretHtml, data: { ok: 1 } };
      },
    });
    const requests: ProviderRequest[] = [];
    const model = scriptedProvider((req, turn) => {
      requests.push(req);
      if (turn === 1) {
        return [{ type: 'tool-call', id: 'call1', name: 'gen', input: { text: 'x' } }, { type: 'done' }];
      }
      return [{ type: 'text-delta', text: 'ok' }, { type: 'done' }];
    });
    const { deps, emitted, store, sessionId } = makeDeps({ model, tools: { gen: genUiTool } });

    await runTurn(deps, 'show a card');

    expect(emitted.map((e) => e.kind)).toEqual([
      'message',
      'tool-call',
      'tool-progress',
      'ui',
      'text-delta',
      'message',
      'turn-end',
    ]);
    const uiEv = emitted[3]!;
    expect(uiEv.payload).toEqual({ type: 'ui', html: secretHtml, data: { ok: 1 } });

    for (const req of requests) {
      for (const m of req.messages) {
        expect(m.content).not.toContain('secret-html-marker');
        expect(m.content).not.toContain('shadowroot');
      }
    }
    const secondReq = requests[1]!;
    const toolMsg = secondReq.messages.find((m) => m.role === 'tool');
    expect(toolMsg?.content).toBe(JSON.stringify({ ok: 1 }));

    const persisted = await persistedLog(store, sessionId);
    expect(persisted).toEqual(emitted);
  });

  it('tool returning a nested UIResult (not top-level): tool error, html never leaks, turn completes', async () => {
    const secretHtml = '<template shadowrootmode="open"><x-a>secret-html-marker</x-a></template>';
    const nestedTool = defineTool({
      description: 'returns a nested ui result',
      input: textSchema,
      async execute() {
        return { card: { type: 'ui' as const, html: secretHtml, data: { ok: 1 } } };
      },
    });
    const requests: ProviderRequest[] = [];
    const model = scriptedProvider((req, turn) => {
      requests.push(req);
      if (turn === 1) {
        return [{ type: 'tool-call', id: 'call1', name: 'nested', input: { text: 'x' } }, { type: 'done' }];
      }
      return [{ type: 'text-delta', text: 'ok' }, { type: 'done' }];
    });
    const { deps, emitted, store, sessionId } = makeDeps({ model, tools: { nested: nestedTool } });

    await runTurn(deps, 'try nested');

    expect(emitted.map((e) => e.kind)).toEqual([
      'message',
      'tool-call',
      'tool-result',
      'text-delta',
      'message',
      'turn-end',
    ]);
    const resultEv = emitted[2]!;
    const payload = resultEv.payload as { error: { message: string } };
    expect(payload.error.message).toMatch(/nested UIResult/);
    expect(payload.error.message).toMatch(/directly/);

    for (const req of requests) {
      for (const m of req.messages) {
        expect(m.content).not.toContain('secret-html-marker');
        expect(m.content).not.toContain('shadowroot');
      }
    }
    const secondReq = requests[1]!;
    const toolMsg = secondReq.messages.find((m) => m.role === 'tool');
    expect(toolMsg?.content).toBe(JSON.stringify({ error: { message: payload.error.message } }));

    const persisted = await persistedLog(store, sessionId);
    expect(persisted).toEqual(emitted);
  });

  it('multi-round narration: pre-tool-call text persists in the final assistant message', async () => {
    const model = scriptedProvider((_req, turn) => {
      if (turn === 1) {
        return [
          { type: 'text-delta', text: 'Checking...' },
          { type: 'tool-call', id: 'call1', name: 'echo', input: { text: 'x' } },
          { type: 'done' },
        ];
      }
      return [{ type: 'text-delta', text: 'Here you go.' }, { type: 'done' }];
    });
    const { deps, emitted, store, sessionId } = makeDeps({ model, tools: { echo: echoTool() } });

    await runTurn(deps, 'do the thing');

    const messageEv = emitted.find(
      (e) => e.kind === 'message' && (e.payload as { role: string }).role === 'assistant'
    )!;
    expect(messageEv.payload).toEqual({ role: 'assistant', text: 'Checking...\n\nHere you go.' });

    const persisted = await persistedLog(store, sessionId);
    expect(persisted).toEqual(emitted);
  });

  it('maxToolRounds exhausted: stops calling the provider and appends a round-limit error', async () => {
    let calls = 0;
    const model = scriptedProvider(() => {
      calls += 1;
      return [{ type: 'tool-call', id: `call${calls}`, name: 'echo', input: { text: 'x' } }, { type: 'done' }];
    });
    const { deps, emitted } = makeDeps({ model, tools: { echo: echoTool() }, maxToolRounds: 2 });

    await runTurn(deps, 'loop forever');

    expect(calls).toBe(2);
    const kinds = emitted.map((e) => e.kind);
    expect(kinds[kinds.length - 2]).toBe('error');
    expect(kinds[kinds.length - 1]).toBe('turn-end');
    const errEv = emitted.find((e) => e.kind === 'error')!;
    expect((errEv.payload as { message: string }).message).toMatch(/round limit/);
  });
});
