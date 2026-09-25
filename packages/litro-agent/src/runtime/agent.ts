/**
 * One manifest entry -> one resolved agent: its config, its tool map, and its
 * `access` guard.
 *
 * This is shared on purpose. The HTTP handler (`./handler.ts`) and the MCP
 * server (`../mcp-server/`) both start from the same `agentEntries` shape the
 * build-time scanner writes, and both need the same three things out of it. Two
 * copies of `buildAgent` would let a project's chat loop and its MCP server
 * disagree about which tools an agent has, or about where its instructions came
 * from.
 */
import type { H3Event } from 'h3';
import { AGENT_CONFIG } from '../index.js';
import type { AgentConfig, AgentDefinition, ToolDefinition } from '../index.js';

export interface AgentManifestEntry {
  name: string;
  /** agent.ts namespace: `default` = AgentDefinition, `access?` = guard. */
  module: Record<string, unknown>;
  /** instructions.md content, inlined at build time. */
  instructions: string;
  tools: Array<{ name: string; module: Record<string, unknown> }>;
}

export type AgentAccessGuard = (event: H3Event) => void | Promise<void>;

export interface ResolvedAgent {
  name: string;
  config: AgentConfig;
  tools: Map<string, ToolDefinition>;
  access?: AgentAccessGuard;
}

/** Manifest instructions override config.instructions only when the config
 *  value LOOKS like a relative path the build was supposed to inline (starts
 *  with './' or '../'). A literal instructions string in the config stands
 *  as-is. */
export function resolveInstructions(config: AgentConfig, manifestInstructions: string): string {
  const raw = config.instructions;
  if (typeof raw === 'string' && (raw.startsWith('./') || raw.startsWith('../'))) {
    return manifestInstructions;
  }
  return raw;
}

export function buildAgent(entry: AgentManifestEntry): ResolvedAgent {
  const def = entry.module.default as AgentDefinition;
  const config = def[AGENT_CONFIG] as AgentConfig;
  const access = entry.module.access as AgentAccessGuard | undefined;

  // Tools are the scanner's concern -- `defineAgent` rejects a non-empty
  // `config.tools` at definition time (an explicit ToolDefinition carries no
  // `name` field to key a Map by), so by the time entries reach a consumer
  // `entry.tools` (scanner-discovered `tools/*.ts`) is the only source.
  const tools = new Map<string, ToolDefinition>();
  for (const t of entry.tools) {
    tools.set(t.name, t.module.default as ToolDefinition);
  }

  return {
    name: entry.name,
    config: { ...config, instructions: resolveInstructions(config, entry.instructions) },
    tools,
    access,
  };
}
