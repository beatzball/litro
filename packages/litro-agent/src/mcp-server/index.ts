/**
 * `@beatzball/litro-agent/mcp-server` — a Litro project's agent tools, and the
 * `ui://` documents `litro mcp-app build` packed, in front of an MCP host.
 *
 * v1 is stdio, one agent, tools and their apps. Streamable HTTP, auth, progress
 * notifications and `outputSchema` are later phases and are deliberately absent
 * — see `design/specs/2026-09-24-mcp-server.md` section 12.
 *
 * The stdio entry point. Streamable HTTP is `./http.ts`; everything both
 * transports share is `./core.ts`, and this module re-exports it so the
 * published surface of `@beatzball/litro-agent/mcp-server` is unchanged.
 */
import { Writable } from 'node:stream';
import { AgentError } from '../errors.js';
import { buildAgent, type AgentManifestEntry } from '../runtime/agent.js';
import { scanAgents } from '../plugin.js';
import { loadPackedApps } from './apps.js';
import {
  createMcpServer,
  defaultLoad,
  defaultLog,
  loadMcpSdk,
  resolveAppsDir,
  resolveMcpAgent,
  sdkLoadError,
  type LogLine,
  type ModuleLoader,
  type ResolvedMcpServer,
} from './core.js';

export type { PackedApp, PackedAppDescriptor, LoadedApps } from './apps.js';
export type { AgentManifestEntry, ResolvedAgent } from '../runtime/agent.js';
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
export type {
  CreateServerOptions,
  LogLine,
  McpSdk,
  ModuleLoader,
  ResolvedMcpServer,
} from './core.js';
export {
  callTool,
  createMcpServer,
  loadMcpSdk,
  resolveAppsDir,
  resolveMcpAgent,
} from './core.js';
export type { McpGateConfig, GateOverrides } from './gates.js';
export {
  LOCAL_ENV,
  ORIGINS_ENV,
  TOKEN_ENV,
  bearerToken,
  checkOrigin,
  checkToken,
  constantTimeEqual,
  isDevServer,
  isLocalOrigin,
  isOriginAllowed,
  parseOriginList,
  resolveGateConfig,
} from './gates.js';
export type { McpHandlerOptions } from './http.js';
export { APPS_DIR_ENV, createMcpHandler } from './http.js';

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
  const loaded = await loadPackedApps(appsDir);

  return resolveMcpAgent(agent, loaded);
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
