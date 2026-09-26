/**
 * Everything both transports need, and nothing either one needs alone.
 *
 * WHY THIS IS NOT `./index.ts`
 *
 * `./index.ts` is the stdio entry point, and it imports `scanAgents` from
 * `../plugin.js` — which pulls `fast-glob` in. That is correct for a CLI that
 * walks project source, and wrong for a Nitro route: the HTTP handler is
 * compiled into a project's server bundle, where a filesystem globber has no
 * business being. So the SDK loader, the server itself and one call's shaping
 * live here, `./http.ts` imports only this, and `./index.ts` re-exports it so
 * nothing about the published surface changes.
 *
 * WHY THE SDK IS LOADED AT RUN TIME
 *
 * `@modelcontextprotocol/sdk` is an OPTIONAL peer dependency. Only a project
 * that serves MCP installs it, and every other Litro project must build and run
 * without it — so nothing in this module may import it statically. It is loaded
 * through the caller's own resolver (`load`), which on the CLI path is the
 * project's Vite server, so the SDK that answers is the project's copy at the
 * version it pinned.
 *
 * A resolution failure is told apart from any other load error, because
 * reporting a syntax error in the SDK as "not installed" sends the reader to
 * reinstall something they already have. `litro mcp-app build` does the same
 * for the packager, and this follows it.
 *
 * WHY THE PROTOCOL LAYER IS NOT HAND-WRITTEN
 *
 * AGENT-012. Hundreds of green tests once drove a fake host built from the same
 * misreading of the spec that produced the code. The SDK owns the JSON-RPC
 * layer, the handshake and the schemas; this module owns only the mapping from
 * a Litro tool to an MCP tool.
 */
import { AgentError } from '../errors.js';
import type { ResolvedAgent } from '../runtime/agent.js';
import { runTool, type ToolCallOutcome } from '../runtime/tool-call.js';
import { DEFAULT_APPS_DIR, type LoadedApps, type PackedApp } from './apps.js';
import { resolveTools, type ResolvedTool } from './tools.js';
import {
  DEFAULT_MAX_RESULT_BYTES,
  DEFAULT_TIMEOUT_MS,
  shapeOutcome,
  timeoutResult,
  toolErrorResult,
  withTimeout,
  type ToolCallResult,
} from './result.js';

/** Loads a module by specifier. On the CLI path this is a Vite dev server's
 *  `ssrLoadModule`, so project TypeScript compiles with the project's own
 *  config; in a test it is a plain dynamic import. */
export type ModuleLoader = (id: string) => Promise<Record<string, unknown>>;

/** Everything goes to stderr. The specification is explicit that a stdio
 *  server MUST NOT write anything to stdout that is not an MCP message, and it
 *  explicitly allows stderr for any logging. */
export type LogLine = (line: string) => void;

// `@vite-ignore`: the specifier is a variable, so Vite cannot analyze it and
// says so on stderr. That is the point — the SDK and the project's own modules
// are resolved at run time by whoever called in, not bundled.
export const defaultLoad: ModuleLoader = (id) => import(/* @vite-ignore */ id) as Promise<Record<string, unknown>>;
export const defaultLog: LogLine = (line) => void process.stderr.write(`${line}\n`);

/** The name the SDK reports to a host when the caller names nothing better. */
const DEFAULT_SERVER_NAME = 'litro';

/**
 * The messages that mean "the package is not there", as opposed to "the package
 * is there and broke".
 *
 * FOUR FORMS, because three resolvers word it three ways and the fourth was
 * missed. Vite 8 answers a missing dependency with "Failed to load url
 * @scope/pkg (resolved id: ...). Does the file exist?" — measured, against a
 * scaffolded app with no SDK installed — which matches neither "Failed to
 * resolve" nor Node's "Cannot find module". Without it, a project that simply
 * had not installed the SDK was told "could not load", with a Vite stack, and
 * never told what to install.
 *
 * `litro mcp-app build` carries the same list for the packager, and had the same
 * gap. Keep the two in step by hand: a package boundary stops them sharing one
 * constant (`packages/framework/src/cli/mcp-app.ts`).
 */
const RESOLUTION_FAILURE =
  /Failed to resolve|Failed to load url|Does the file exist\?|Cannot find (module|package)|ERR_MODULE_NOT_FOUND/i;

export interface McpSdk {
  Server: typeof import('@modelcontextprotocol/sdk/server/index.js').Server;
  McpError: typeof import('@modelcontextprotocol/sdk/types.js').McpError;
  ErrorCode: typeof import('@modelcontextprotocol/sdk/types.js').ErrorCode;
  CallToolRequestSchema: typeof import('@modelcontextprotocol/sdk/types.js').CallToolRequestSchema;
  ListToolsRequestSchema: typeof import('@modelcontextprotocol/sdk/types.js').ListToolsRequestSchema;
  ListResourcesRequestSchema: typeof import('@modelcontextprotocol/sdk/types.js').ListResourcesRequestSchema;
  ReadResourceRequestSchema: typeof import('@modelcontextprotocol/sdk/types.js').ReadResourceRequestSchema;
}

/**
 * Loads the parts of the SDK this server uses, or explains what to install.
 *
 * The two failure messages are different on purpose. "Not installed" names the
 * package to add; anything else quotes what actually went wrong, because a
 * broken export map or a throwing import is not fixed by installing again.
 */
export async function loadMcpSdk(load: ModuleLoader = defaultLoad): Promise<McpSdk> {
  // Sequential, not `Promise.all`. A Vite runner that fails one load tears the
  // transport down, so the second load then failed with "transport was
  // disconnected" and THAT became the reported cause — hiding the real one.
  let server: Record<string, unknown>;
  let types: Record<string, unknown>;
  try {
    server = await load('@modelcontextprotocol/sdk/server/index.js');
    types = await load('@modelcontextprotocol/sdk/types.js');
  } catch (err) {
    throw sdkLoadError(err);
  }

  return {
    Server: server.Server as McpSdk['Server'],
    McpError: types.McpError as McpSdk['McpError'],
    ErrorCode: types.ErrorCode as McpSdk['ErrorCode'],
    CallToolRequestSchema: types.CallToolRequestSchema as McpSdk['CallToolRequestSchema'],
    ListToolsRequestSchema: types.ListToolsRequestSchema as McpSdk['ListToolsRequestSchema'],
    ListResourcesRequestSchema: types.ListResourcesRequestSchema as McpSdk['ListResourcesRequestSchema'],
    ReadResourceRequestSchema: types.ReadResourceRequestSchema as McpSdk['ReadResourceRequestSchema'],
  };
}

export function sdkLoadError(err: unknown): AgentError {
  const message = (err as Error)?.message ?? String(err);
  if (RESOLUTION_FAILURE.test(message)) {
    return new AgentError(
      '@modelcontextprotocol/sdk is not installed in this project.\n' +
        '  pnpm add -D @modelcontextprotocol/sdk\n' +
        '  It is an optional peer dependency, so only a project that serves MCP needs it.',
      { status: 500 },
    );
  }
  return new AgentError(`could not load @modelcontextprotocol/sdk\n  ${message}`, { status: 500, cause: err });
}


// --- startup resolution ----------------------------------------------------

export interface ResolvedMcpServer {
  agent: ResolvedAgent;
  tools: ResolvedTool[];
  apps: PackedApp[];
  manifestPath: string;
  manifestMissing: boolean;
  /** Tool names outside MCP's naming guidance, for the caller to warn about. */
  oddNames: string[];
}

/**
 * Everything that must be true before a host connects: exactly one agent
 * chosen, its tools loaded, and every app a tool names present in the manifest.
 *
 * Deliberately separate from `createMcpServer`, and deliberately free of the
 * SDK: a project with no SDK installed still gets these errors, and a test can
 * assert them without a transport.
 */
/**
 * One built agent plus one loaded app set -> everything a server needs.
 *
 * SHARED WITH THE HTTP ROUTE on purpose. `resolveMcpServer` above gets its
 * agent by scanning project source with Vite, because a stdio server starts
 * from a fresh checkout that has no build output; `createMcpHandler` in
 * `./http.ts` gets its agents from the build-time manifest, because a Nitro
 * route has one already. Everything AFTER that point — the tool list, the
 * schemas, the app resolution and the startup check that every named app
 * exists — has to be identical, or a project's tools would differ between the
 * two transports, which is exactly what the specification says must not happen.
 */
export function resolveMcpAgent(agent: ResolvedAgent, loaded: LoadedApps): ResolvedMcpServer {
  const { apps, manifestPath, missing } = loaded;
  const { tools, oddNames } = resolveTools(agent.tools, apps, {
    agentName: agent.name,
    manifestPath,
    manifestMissing: missing,
  });
  return { agent, tools, apps, manifestPath, manifestMissing: missing, oddNames };
}

export function resolveAppsDir(cwd: string, appsDir: string | undefined): string {
  const dir = appsDir ?? DEFAULT_APPS_DIR;
  // `pathe` normalizes separators; an absolute value is taken as given so a
  // host config can point at a build output outside the project.
  return dir.startsWith('/') || /^[A-Za-z]:/.test(dir) ? dir : `${cwd}/${dir}`;
}

// --- the server -----------------------------------------------------------

export interface CreateServerOptions {
  resolved: ResolvedMcpServer;
  sdk: McpSdk;
  serverInfo?: { name: string; version: string };
  /** Per-call timeout. */
  timeoutMs?: number;
  /** Cap on the JSON one call may answer with. */
  maxResultBytes?: number;
  log?: LogLine;
}

/**
 * Builds the MCP server. Four handlers, and no state beyond what startup
 * resolved — every tool list, schema and document is already in hand, so a
 * request never reaches the filesystem.
 */
export function createMcpServer(options: CreateServerOptions): InstanceType<McpSdk['Server']> {
  const { resolved, sdk } = options;
  const log = options.log ?? defaultLog;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxResultBytes = options.maxResultBytes ?? DEFAULT_MAX_RESULT_BYTES;

  const server = new sdk.Server(
    options.serverInfo ?? { name: `${DEFAULT_SERVER_NAME}-${resolved.agent.name}`, version: '0.0.0' },
    { capabilities: { tools: {}, resources: {} } },
  );

  const byName = new Map(resolved.tools.map((t) => [t.name, t]));
  const byUri = new Map(resolved.apps.map((a) => [a.descriptor.uri, a]));

  server.setRequestHandler(sdk.ListToolsRequestSchema, async () => ({
    tools: resolved.tools.map((t) => t.entry as unknown as Record<string, unknown>),
  }));

  server.setRequestHandler(sdk.ListResourcesRequestSchema, async () => ({
    resources: resolved.apps.map((app) => ({
      uri: app.descriptor.uri,
      name: app.descriptor.name,
      mimeType: app.descriptor.mimeType,
      // `_meta.ui` travels on the DECLARATION as well as on the read contents,
      // so a host that decides CSP at prefetch time has it. Passed through,
      // never rebuilt.
      ...(app.descriptor._meta ? { _meta: app.descriptor._meta } : {}),
    })),
  }));

  server.setRequestHandler(sdk.ReadResourceRequestSchema, async (request) => {
    const uri = request.params.uri;
    const app = byUri.get(uri);
    if (!app) {
      // A uri from a request never becomes a path. Only addresses the manifest
      // listed can be read (AGENT-008).
      throw new sdk.McpError(sdk.ErrorCode.InvalidParams, `Unknown resource: ${uri}`);
    }
    return {
      contents: [
        {
          uri: app.descriptor.uri,
          mimeType: app.descriptor.mimeType,
          // Byte for byte what `litro mcp-app build` wrote.
          text: app.html,
          ...(app.descriptor._meta ? { _meta: app.descriptor._meta } : {}),
        },
      ],
    };
  });

  server.setRequestHandler(sdk.CallToolRequestSchema, async (request) => {
    const name = request.params.name;
    const tool = byName.get(name);

    // Unknown tool and invalid arguments are what the specification calls
    // protocol errors; a tool that RAN and failed is `isError: true`. The rig
    // answered an unknown tool with -32603 Internal error, which tells a client
    // the server broke rather than that the tool does not exist.
    if (!tool) {
      throw new sdk.McpError(sdk.ErrorCode.InvalidParams, `Unknown tool: "${name}"`);
    }

    const result = await callTool(tool, request.params.arguments ?? {}, {
      sdk,
      timeoutMs,
      maxResultBytes,
      log,
    });
    return result as unknown as Record<string, unknown>;
  });

  return server;
}

interface CallDeps {
  sdk: McpSdk;
  timeoutMs: number;
  maxResultBytes: number;
  log: LogLine;
}

/**
 * Runs one tool and shapes the answer.
 *
 * `ctx.event` is `undefined`, and that is not a gap being papered over: over
 * stdio there is no request, so a tool that reads a cookie or a header has
 * nothing to read. `ToolContext.event` is already `H3Event | undefined` for
 * exactly this case.
 *
 * `session` is a fixed, non-persisted id. There is no session store on this
 * path — a tool that uses `session.seq` for a cache key still works, and one
 * that expects a conversation does not have one.
 */
export async function callTool(
  tool: ResolvedTool,
  args: unknown,
  deps: CallDeps,
): Promise<ToolCallResult> {
  const shapeOptions = { maxResultBytes: deps.maxResultBytes, log: deps.log, toolName: tool.name };

  let race: { timedOut: true } | { timedOut: false; value: ToolCallOutcome };
  try {
    race = await withTimeout(
      deps.timeoutMs,
      runTool(tool.config, tool.name, args, {
        event: undefined,
        session: { id: 'mcp', seq: 0 },
      }),
    );
  } catch (err) {
    // `runTool` lets a throwing schema and a throwing generator through. Both
    // are still the tool's own failure from a host's point of view, so they are
    // `isError`, not a protocol error, and the message carries no stack
    // (AGENT-007).
    return toolErrorResult((err as Error)?.message ?? String(err));
  }

  if (race.timedOut) {
    deps.log(`[litro mcp] tool "${tool.name}" exceeded ${deps.timeoutMs}ms; answered with an error.`);
    return timeoutResult(tool.name, deps.timeoutMs);
  }

  const outcome = race.value;

  // Invalid arguments are a protocol error, which the specification groups with
  // an unknown tool rather than with a tool that ran and failed.
  if (outcome.kind === 'validation-error') {
    throw new deps.sdk.McpError(deps.sdk.ErrorCode.InvalidParams, outcome.message);
  }

  return shapeOutcome(outcome, shapeOptions);
}
