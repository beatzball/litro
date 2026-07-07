import { describe, it, expect } from 'vitest';
import { defineTool, defineAgent, defineAccess, defineAgentConfig, TOOL_CONFIG, AGENT_CONFIG } from './index.js';
import type { StandardSchemaV1 } from '@beatzball/litro/actions';

const echoSchema: StandardSchemaV1<unknown, { text: string }> = {
  '~standard': {
    version: 1,
    vendor: 'litro-agent-test',
    validate(value) {
      const v = value as { text?: unknown } | null;
      if (typeof v?.text !== 'string') return { issues: [{ message: 'text required' }] };
      return { value: { text: v.text } };
    },
  },
};

describe('defineTool', () => {
  it('attaches config under TOOL_CONFIG and preserves description/input', () => {
    const tool = defineTool({ description: 'echo', input: echoSchema, async execute(input) { return input.text; } });
    const cfg = (tool as Record<symbol, unknown>)[TOOL_CONFIG] as { description: string };
    expect(cfg.description).toBe('echo');
  });

  it('throws AgentError when input schema is missing', () => {
    expect(() => defineTool({ description: 'bad' } as never)).toThrow(/input schema/i);
  });
});

describe('defineAgent', () => {
  const model = { async *stream() { yield { type: 'done' as const } } };

  it('attaches config under AGENT_CONFIG', () => {
    const agent = defineAgent({ model, instructions: 'be helpful' });
    const cfg = (agent as Record<symbol, unknown>)[AGENT_CONFIG] as { instructions: string };
    expect(cfg.instructions).toBe('be helpful');
  });

  it('rejects deferred config keys with an actionable error', () => {
    expect(() => defineAgent({ model, instructions: 'x', skills: [{}] } as never)).toThrow(/deferred/i);
    expect(() => defineAgent({ model, instructions: 'x', mcp: [{}] } as never)).toThrow(/deferred/i);
  });
});

describe('defineAccess / defineAgentConfig', () => {
  it('are identity wrappers that brand their values', () => {
    const guard = defineAccess(() => undefined);
    expect(typeof guard).toBe('function');
    const cfg = defineAgentConfig({});
    expect(cfg).toEqual({});
  });
});
