import type { H3Event } from 'h3';
import { AgentError } from './errors.js';
import type { Provider, ProviderRequest } from './providers/types.js';
import type { StandardSchemaV1 } from '@beatzball/litro/actions';

// Symbols
export const TOOL_CONFIG = Symbol.for('litro.agent.tool');
export const AGENT_CONFIG = Symbol.for('litro.agent.agent');

// Re-export types from submodules
export type * from './providers/types.js';
export type * from './sessions/types.js';
export type * from './telemetry/types.js';

// Re-export error types
export { AgentError };
export type { AgentErrorPayload } from './errors.js';

// Re-export UI types
export type { UIResult } from './ui/index.js';
export { isUIResult } from './ui/index.js';

// Re-export framework types
export type { StandardSchemaV1 } from '@beatzball/litro/actions';

// ToolConfig and related types
export interface ToolContext {
  event: H3Event | undefined;
  session: { id: string; seq: number };
}

export interface ToolConfig<In> {
  description: string;
  input: StandardSchemaV1<unknown, In>;
  execute(input: In, ctx: ToolContext): unknown;
}

export interface ToolDefinition {
  [TOOL_CONFIG]: ToolConfig<any>;
  [key: symbol]: unknown;
}

export function defineTool<In>(config: ToolConfig<In>): ToolDefinition {
  if (!config.input) {
    throw new AgentError(
      'defineTool: an input schema is required — every tool is model-callable and its input is hostile.',
      { status: 500 }
    );
  }
  return Object.assign({}, { [TOOL_CONFIG]: config });
}

// AgentConfig and related types
export interface AgentConfig {
  model: Provider;
  instructions: string;
  /** Deferred past v0 — a non-empty array throws at definition time. Tools
   *  are discovered from the agent's `tools/` directory (filename = tool
   *  name); an explicitly-passed `ToolDefinition` has no name to merge by. */
  tools?: never[];
  skills?: never[];
  extends?: never;
  mcp?: never[];
  subagents?: never[];
}

export interface AgentDefinition {
  [AGENT_CONFIG]: AgentConfig;
  [key: symbol]: unknown;
}

const DEFERRED_KEY_MESSAGES: Partial<Record<string, string>> = {
  tools:
    'defineAgent: an explicit "tools" array is deferred past v0 — tools are discovered ' +
    "from the agent's tools/ directory (agents/<name>/tools/*.ts). Move the tool into that directory.",
};

export function defineAgent(config: AgentConfig): AgentDefinition {
  for (const key of ['tools', 'skills', 'extends', 'mcp', 'subagents'] as const) {
    const v = (config as unknown as Record<string, unknown>)[key];
    if (v !== undefined && (!Array.isArray(v) || v.length > 0)) {
      throw new AgentError(
        DEFERRED_KEY_MESSAGES[key] ??
          `defineAgent: "${key}" is deferred past v0 — see the design spec's deferral list.`,
        { status: 500 }
      );
    }
  }
  return Object.assign({}, { [AGENT_CONFIG]: config });
}

// AccessGuard and related types
export type AccessGuard = (event: H3Event) => void | Promise<void>;

export function defineAccess(fn: (event: H3Event) => void | Promise<void>): AccessGuard {
  return fn;
}

// AgentRuntimeConfig and related types
export interface AgentRuntimeConfig {
  sessions?: import('./sessions/types.js').SessionStore;
  /** OpenTelemetry GenAI spans. Off unless a `tracer` is supplied — see
   *  `@beatzball/litro-agent/telemetry` for the OTel adapter. */
  telemetry?: import('./telemetry/types.js').TelemetryConfig;
}

export function defineAgentConfig(config: AgentRuntimeConfig): AgentRuntimeConfig {
  return config;
}
