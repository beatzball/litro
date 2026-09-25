/**
 * `@beatzball/litro-agent/mcp-server` — a Litro project's agent tools, and the
 * `ui://` documents `litro mcp-app build` packed, in front of an MCP host.
 *
 * v1 is stdio, one agent, tools and their apps. Streamable HTTP, auth, progress
 * notifications and `outputSchema` are later phases and are deliberately absent
 * — see `design/specs/2026-09-24-mcp-server.md` section 12.
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
import { Writable } from 'node:stream';
import { AgentError } from '../errors.js';
import { buildAgent, type AgentManifestEntry, type ResolvedAgent } from '../runtime/agent.js';
import { runTool, type ToolCallOutcome } from '../runtime/tool-call.js';
import { scanAgents } from '../plugin.js';
import { DEFAULT_APPS_DIR, loadPackedApps, type PackedApp } from './apps.js';
import { resolveTools, type McpToolEntry, type ResolvedTool } from './tools.js';
import {
  DEFAULT_MAX_RESULT_BYTES,
  DEFAULT_TIMEOUT_MS,
  shapeOutcome,
  timeoutResult,
  toolErrorResult,
  withTimeout,
  type ToolCallResult,
} from './result.js';

export type { PackedApp, PackedAppDescriptor, LoadedApps } from './apps.js';
export { loadPackedApps, resolveApp, DEFAULT_APPS_DIR } from './apps.js';
export type { McpToolEntry, ResolvedTool } from './tools.js';
export { resolveTools } from './tools.js';
export {
  DEFAULT_MAX_RESULT_BYTES,
  DEFAULT_TIMEOUT_MS,
  WRAPPED_RESULT_KEY,
  asStructuredContent,
  shapeOutcome,
  shapeValueResult,
  toolErrorResult,
} from './result.js';
export type { ToolCallResult } from './result.js';

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
const defaultLoad: ModuleLoader = (id) => import(/* @vite-ignore */ id) as Promise<Record<string, unknown>>;
const defaultLog: LogLine = (line) => void process.stderr.write(`${line}\n`);

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

function sdkLoadError(err: unknown): AgentError {
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

// --- startup resolution ---------------------------------------------------

export interface ResolveOptions {
  /** Project root. `agents/` is found under it, as is the apps directory. */
  cwd: string;
  /** Which agent to serve. Optional when the project has exactly one. */
  agent?: string;
  /** Where `litro mcp-app build` wrote. Relative to `cwd` unless absolute. */
  appsDir?: string;
  load?: ModuleLoader;
}

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
export async function resolveMcpServer(options: ResolveOptions): Promise<ResolvedMcpServer> {
  const load = options.load ?? defaultLoad;
  const scanned = await scanAgents(options.cwd);

  if (scanned.length === 0) {
    throw new AgentError(
      `no agents found in ${options.cwd}/agents/.\n` +
        '  An agent is a directory with an agent.ts in it: agents/<name>/agent.ts.',
      { status: 500 },
    );
  }

  const names = scanned.map((a) => a.name);
  let chosen = scanned[0];
  if (options.agent !== undefined) {
    const match = scanned.find((a) => a.name === options.agent);
    if (!match) {
      throw new AgentError(
        `no agent named "${options.agent}".\n  This project has: ${names.join(', ')}`,
        { status: 500 },
      );
    }
    chosen = match;
  } else if (scanned.length > 1) {
    // One agent per server (decision 4): tool names are unique inside an agent
    // and not across a project, and the `access` guard is per agent. Guessing
    // would serve one agent's tools under another's name.
    throw new AgentError(
      `this project has ${scanned.length} agents (${names.join(', ')}), so --agent is required.\n` +
        '  A second agent is a second server entry in the host configuration.',
      { status: 500 },
    );
  }

  // ONLY the chosen agent's modules are loaded. A second agent with a broken
  // import must not stop the one being served from starting.
  const entry: AgentManifestEntry = {
    name: chosen.name,
    module: await load(chosen.agentFile),
    instructions: chosen.instructions,
    tools: await Promise.all(
      chosen.tools.map(async (t) => ({ name: t.name, module: await load(t.file) })),
    ),
  };
  const agent = buildAgent(entry);

  const appsDir = resolveAppsDir(options.cwd, options.appsDir);
  const { apps, manifestPath, missing } = await loadPackedApps(appsDir);

  const { tools, oddNames } = resolveTools(agent.tools, apps, {
    agentName: agent.name,
    manifestPath,
    manifestMissing: missing,
  });

  return { agent, tools, apps, manifestPath, manifestMissing: missing, oddNames };
}

function resolveAppsDir(cwd: string, appsDir: string | undefined): string {
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

// --- stdio ---------------------------------------------------------------

export interface ServeStdioOptions extends ResolveOptions {
  /**
   * The stream the MCP transport writes to. A caller that has ALREADY taken
   * stdout away from everything else passes the real one here — `litro mcp
   * serve` does that before Vite starts, because a banner printed while the
   * bundler boots is already a stray byte. Omitted, this function takes stdout
   * itself.
   */
  stdout?: Writable;
  serverInfo?: { name: string; version: string };
  timeoutMs?: number;
  maxResultBytes?: number;
  log?: LogLine;
}

export interface ServeStdioResult {
  agentName: string;
  toolNames: string[];
  appUris: string[];
  /**
   * Resolves when the host goes away — it closes the server's stdin, and the
   * transport reports that.
   *
   * THE CALLER MUST AWAIT THIS AND THEN SHUT DOWN. A stdio server's whole
   * lifetime is its host's: when the host stops it, the process has no reason to
   * exist. Nothing ends it on its own, because the Vite server the CLI keeps
   * open holds the event loop, so a host that starts and stops a server several
   * times leaves one orphaned process each time — nine of them accumulated in a
   * single session of testing this, and one held the HMR port against an
   * unrelated build.
   */
  closed: Promise<void>;
  /** Closes the transport from this side. Used by tests; a host closes stdin. */
  close: () => Promise<void>;
}

/**
 * Serves one agent over stdio, and keeps stdout clean while doing it.
 *
 * THE STDOUT GUARD IS THE POINT OF THIS FUNCTION.
 *
 * The specification says a stdio server "MUST NOT write anything to its stdout
 * that is not a valid MCP message". Measured: one ordinary log line before
 * connecting raised `Unexpected token 'l', "[litro] Sca"... is not valid JSON`
 * on the client's transport. This SDK's client skipped the line and carried on,
 * but a host that treats a transport error as fatal drops the session.
 *
 * A project's own modules log, Vite logs, and Nitro's logger writes to stdout —
 * measured, on this repo's playground. So rather than asking every one of them
 * to behave, the real `stdout` is handed to the transport and nothing else, and
 * `process.stdout.write` is rebound to stderr. `console.log` goes through
 * `process.stdout.write`, so it is covered too.
 */
export async function serveMcpStdio(options: ServeStdioOptions): Promise<ServeStdioResult> {
  const log = options.log ?? defaultLog;
  const load = options.load ?? defaultLoad;

  const resolved = await resolveMcpServer({ ...options, load });
  const sdk = await loadMcpSdk(load);

  let stdio: Record<string, unknown>;
  try {
    stdio = await load('@modelcontextprotocol/sdk/server/stdio.js');
  } catch (err) {
    throw sdkLoadError(err);
  }
  const StdioServerTransport = stdio.StdioServerTransport as typeof import('@modelcontextprotocol/sdk/server/stdio.js').StdioServerTransport;

  // A caller that passed a stream has already done this; doing it twice would
  // capture the redirect as the "original" and send MCP messages to stderr.
  const captured = options.stdout ? undefined : captureStdout();
  const mcpStdout = options.stdout ?? captured!.mcpStdout;
  const transport = new StdioServerTransport(process.stdin, mcpStdout);
  const server = createMcpServer({
    resolved,
    sdk,
    serverInfo: options.serverInfo,
    timeoutMs: options.timeoutMs,
    maxResultBytes: options.maxResultBytes,
    log,
  });

  // Registered BEFORE connect, so a host that disconnects immediately cannot
  // close the transport between the connect and the hook being attached.
  const closed = new Promise<void>((resolve) => {
    const prior = server.onclose?.bind(server);
    server.onclose = () => {
      prior?.();
      resolve();
    };
  });

  await server.connect(transport);

  for (const odd of resolved.oddNames) {
    // Open question 4 in the spec: fail at startup, or normalize. Neither is
    // ruled yet, so this does neither — the name is served as written and said
    // out loud, which is the only option that is not a decision.
    log(
      `[litro mcp] tool name "${odd}" is outside MCP's guidance (1-128 characters of letters, ` +
        'digits, "_", "-" and "."). Serving it as written; a strict host may refuse it.',
    );
  }
  if (resolved.manifestMissing && resolved.apps.length === 0) {
    log(`[litro mcp] no ${resolved.manifestPath}; serving tools only. Run \`litro mcp-app build\` to add apps.`);
  }
  log(
    `[litro mcp] agent "${resolved.agent.name}" over stdio — ` +
      `${resolved.tools.length} tool(s), ${resolved.apps.length} app(s)`,
  );

  return {
    agentName: resolved.agent.name,
    toolNames: resolved.tools.map((t) => t.name),
    appUris: resolved.apps.map((a) => a.descriptor.uri),
    closed,
    close: async () => {
      await transport.close();
      captured?.restore();
    },
  };
}

/**
 * Hands the caller the real stdout and points `process.stdout.write` at stderr.
 *
 * The returned stream forwards to the ORIGINAL write, captured before the
 * rebind, so the transport is unaffected by it. `restore()` puts the original
 * back, which only a test needs.
 */
export function captureStdout(): { mcpStdout: Writable; restore: () => void } {
  const original = process.stdout.write.bind(process.stdout);

  const mcpStdout = new Writable({
    write(chunk: unknown, encoding: unknown, callback: (err?: Error | null) => void) {
      original(chunk as Uint8Array, encoding as BufferEncoding, callback);
      return true;
    },
  });

  const patched = ((chunk: unknown, encoding?: unknown, callback?: unknown) =>
    (process.stderr.write as (...a: unknown[]) => boolean)(chunk, encoding, callback)) as typeof process.stdout.write;
  process.stdout.write = patched;

  return {
    mcpStdout,
    restore: () => {
      // Only restore what this function replaced. Something else may have
      // patched stdout since, and clobbering that would be worse than leaving
      // the redirect in place.
      if (process.stdout.write === patched) process.stdout.write = original;
    },
  };
}
