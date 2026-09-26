/**
 * The agent's tools, as MCP sees them.
 *
 * `tools/list` is built once at startup: a name, the description the tool
 * already carries, the `inputSchema` `toolInputJSONSchema` produces from its
 * Standard Schema, and `_meta.ui.resourceUri` for a tool that names a packed
 * app. Nothing is invented — a vendor with no JSON Schema converter publishes
 * `{ type: 'object' }`, which is what the chat loop already sends its provider.
 */
import { TOOL_CONFIG } from '../index.js';
import type { ToolAppVisibility, ToolConfig, ToolDefinition } from '../index.js';
import { toolInputJSONSchema } from '../runtime/json-schema.js';
import { resolveApp, type PackedApp } from './apps.js';

/** One tool as `tools/list` publishes it. */
export interface McpToolEntry {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  _meta?: { ui: { resourceUri: string; visibility?: ToolAppVisibility[] } };
}

/** A tool plus everything resolved about it at startup. */
export interface ResolvedTool {
  name: string;
  config: ToolConfig<unknown>;
  entry: McpToolEntry;
}

/**
 * MCP's guidance for a tool name: 1 to 128 characters of letters, digits, `_`,
 * `-` and `.`. A tool's name is a filename stem, which can hold far more than
 * that.
 */
const MCP_TOOL_NAME = /^[A-Za-z0-9_.-]{1,128}$/;

export interface ResolveToolsResult {
  tools: ResolvedTool[];
  /** Names that fall outside MCP's guidance. Reported, not rejected and not
   *  rewritten — see the comment on `assertAppsResolve`. */
  oddNames: string[];
}

/**
 * Builds the published tool list for one agent.
 *
 * Throws when a tool names an app that the manifest does not list. The MCP Apps
 * specification says the referenced resource MUST exist on the server, and
 * startup is the only place that can be honored — the alternative is a host
 * fetching a `ui://` address that answers nothing, which shows up as a blank
 * panel with no error anywhere.
 */
export function resolveTools(
  tools: Map<string, ToolDefinition>,
  apps: PackedApp[],
  context: { agentName: string; manifestPath: string; manifestMissing: boolean },
): ResolveToolsResult {
  const resolved: ResolvedTool[] = [];
  const oddNames: string[] = [];

  for (const [name, def] of tools) {
    const config = def?.[TOOL_CONFIG] as ToolConfig<unknown> | undefined;
    if (!config) {
      throw new Error(
        `agent "${context.agentName}": tool "${name}" has no defineTool() default export. ` +
          'Export the result of defineTool() as the default.',
      );
    }

    if (!MCP_TOOL_NAME.test(name)) oddNames.push(name);

    const entry: McpToolEntry = {
      name,
      description: config.description,
      inputSchema: toolInputJSONSchema(config.input),
    };

    const app = config.app;
    if (app !== undefined) {
      const ref = typeof app === 'string' ? { name: app } : app;
      const packed = resolveApp(apps, ref.name);
      if (!packed) {
        throw new Error(appNotFoundMessage(context, name, ref.name, apps));
      }
      entry._meta = {
        ui: {
          resourceUri: packed.descriptor.uri,
          // Emitted only when the author set it. The extension defaults to
          // ['model', 'app'] on its own, and repeating a default here would
          // make a tool's published shape depend on this file rather than on
          // the spec.
          ...(ref.visibility ? { visibility: ref.visibility } : {}),
        },
      };
    }

    resolved.push({ name, config, entry });
  }

  return { tools: resolved, oddNames };
}

function appNotFoundMessage(
  context: { agentName: string; manifestPath: string; manifestMissing: boolean },
  toolName: string,
  appName: string,
  apps: PackedApp[],
): string {
  const head = `agent "${context.agentName}": tool "${toolName}" names the app "${appName}"`;
  if (context.manifestMissing) {
    return (
      `${head}, but there is no ${context.manifestPath}.\n` +
      '  Run `litro mcp-app build` first, or point the server at where it wrote: --apps-dir on\n' +
      '  `litro mcp serve`, or LITRO_MCP_APPS_DIR for the HTTP route.'
    );
  }
  const listed = apps.map((a) => `"${a.name}" (${a.descriptor.uri})`);
  return (
    `${head}, which ${context.manifestPath} does not list.\n` +
    (listed.length > 0
      ? `  It lists: ${listed.join(', ')}`
      : '  It lists no apps at all. Run `litro mcp-app build`.')
  );
}
