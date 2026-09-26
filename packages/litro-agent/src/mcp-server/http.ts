/**
 * Streamable HTTP as a Nitro route — phase 2 of
 * `design/specs/2026-09-24-mcp-server.md`.
 *
 * THIS IS A TRANSPORT, NOT A SECOND SERVER. The SDK puts the same `Server`
 * object behind either binding, and `./core.ts` builds that object. Everything
 * here is the four things stdio does not have: a URL, gates, CORS, and a
 * request that can be cut off halfway through.
 *
 * ROUTE SHAPE — `/__litro/mcp/:agent`
 *
 * One URL per agent, because decision 4 is one agent per server and an HTTP
 * endpoint IS a server: a host holds one entry per URL, exactly as it holds one
 * entry per `litro mcp serve --agent <name>` command. It also mirrors
 * `/__litro/agent/:agent/:session`, so a reader who knows one route knows this
 * one. An unknown agent answers 404 and names the agents that exist.
 *
 * TWO STATIC HANDLER ENTRIES, `post` and `options`. POST is the whole JSON-RPC
 * channel. OPTIONS is the CORS preflight a browser-based inspector sends before
 * it, and it must answer WITHOUT the token gate, because a preflight carries no
 * `Authorization` header — a browser will not send one until the preflight has
 * already said the header is allowed. GET is deliberately not served: it exists
 * in the current SDK only for the standalone server-initiated stream, protocol
 * revision 2026-07-28 removes it, and a stateless route has no stream to hand
 * out. A client that tries it gets 404 and carries on, which is what the SDK's
 * own client does with the 406 it gets from the rig today.
 *
 * WHY THE ROUTE IS DECLARED IN `nitro.config.ts` AND NOT PUSHED FROM A HOOK
 *
 * NITRO-001. The dev server reads handler config before `build:before` fires,
 * so a route added in that hook never reaches `litro dev`. The agents plugin
 * generates `server/stubs/mcp-handler.ts` and guarantees it exists before
 * rollup compiles it; the project declares the two entries pointing at it.
 */
import {
  defineEventHandler,
  getRouterParam,
  setResponseHeader,
  setResponseStatus,
  toWebRequest,
  type EventHandler,
  type H3Event,
} from 'h3';
import { AgentError, errorPayload } from '../errors.js';
import { buildAgent, type AgentManifestEntry } from '../runtime/agent.js';
import { loadPackedApps } from './apps.js';
import {
  createMcpServer,
  defaultLoad,
  defaultLog,
  loadMcpSdk,
  resolveAppsDir,
  resolveMcpAgent,
  type LogLine,
  type McpSdk,
  type ModuleLoader,
  type ResolvedMcpServer,
} from './core.js';
import {
  checkOrigin,
  checkToken,
  resolveGateConfig,
  type GateOverrides,
  type McpGateConfig,
} from './gates.js';

/** Where the route reads `litro mcp-app build`'s output from at run time. */
export const APPS_DIR_ENV = 'LITRO_MCP_APPS_DIR';

export interface McpHandlerOptions extends GateOverrides {
  /**
   * Where `litro mcp-app build` wrote. Relative values resolve against `cwd`.
   *
   * READ AT RUN TIME, from the deployed filesystem, and that is a real
   * constraint rather than a preference: `litro mcp-app build` is a separate
   * command that runs at a separate time, and nothing in the Nitro build knows
   * whether it has run. So a deployment that serves apps ships
   * `dist/mcp-apps/` beside the server, or points this at an absolute path. A
   * deployment that does not serves its tools and says so in the log, exactly
   * as stdio does with no manifest.
   */
  appsDir?: string;
  /** Project root for a relative `appsDir`. Defaults to the working directory. */
  cwd?: string;
  timeoutMs?: number;
  maxResultBytes?: number;
  /** Resolver for the SDK. A test passes its own; production uses `import()`. */
  load?: ModuleLoader;
  /** Where startup and per-call notices go. Defaults to `console.error`. */
  log?: LogLine;
  /**
   * Answer a POST with one JSON body instead of an SSE stream.
   *
   * Off by default, because the SSE form is what the specification prefers and
   * what carries a notification mid-call. A deployment behind something that
   * buffers responses — some CDNs and some serverless gateways do — turns this
   * on and loses streaming rather than losing the route.
   */
  enableJsonResponse?: boolean;
  serverInfo?: { name: string; version: string };
}

/** The part of the SDK only this transport needs. A `typeof import()` in a TYPE
 *  position, which the compiler erases — the SDK stays an optional peer, exactly
 *  as `McpSdk` in `./core.ts` does it. */
type WebTransportCtor =
  typeof import('@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js').WebStandardStreamableHTTPServerTransport;

/**
 * The web-standard transport, loaded through the caller's resolver.
 *
 * `WebStandardStreamableHTTPServerTransport` and not
 * `StreamableHTTPServerTransport`: the Node one is a wrapper that wants an
 * `IncomingMessage` and a `ServerResponse`, which only exist on a Node preset.
 * The web one takes a `Request` and returns a `Response`, which is what
 * `toWebRequest(event)` gives and what h3 sends back — so the same route works
 * on every preset Nitro deploys to, and the streaming body is handed over
 * rather than copied.
 */
async function loadWebTransport(load: ModuleLoader): Promise<WebTransportCtor> {
  const mod = await load('@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js');
  const ctor = mod.WebStandardStreamableHTTPServerTransport as WebTransportCtor | undefined;
  if (!ctor) {
    throw new AgentError(
      'this @modelcontextprotocol/sdk has no WebStandardStreamableHTTPServerTransport.\n' +
        '  The HTTP route needs @modelcontextprotocol/sdk 1.30 or newer.',
      { status: 500 },
    );
  }
  return ctor;
}

/** CORS, with one allowlisted origin or none. Never `*` — a wildcard would let
 *  any page a reader visits drive their MCP route from their own browser, with
 *  their own token attached by the host that stored it. */
function applyCors(event: H3Event, origin: string | undefined): void {
  // `Vary: Origin` whether or not an origin was echoed: the response differs by
  // request origin either way, and a cache that does not know that would serve
  // one origin's answer to another.
  setResponseHeader(event, 'vary', 'origin');
  if (!origin) return;
  setResponseHeader(event, 'access-control-allow-origin', origin);
  setResponseHeader(event, 'access-control-allow-credentials', 'true');
  setResponseHeader(
    event,
    'access-control-expose-headers',
    'mcp-session-id, mcp-protocol-version',
  );
}

function applyPreflight(event: H3Event): void {
  setResponseHeader(event, 'access-control-allow-methods', 'POST, OPTIONS');
  // The headers an MCP client actually sends. Not `*`: a wildcard in the
  // allow-headers list is ignored by a browser for a credentialed request
  // anyway, so it would read as permission that is not there.
  setResponseHeader(
    event,
    'access-control-allow-headers',
    'authorization, content-type, accept, mcp-session-id, mcp-protocol-version, last-event-id',
  );
  setResponseHeader(event, 'access-control-max-age', 600);
}

function isDev(): boolean {
  return (process as unknown as { dev?: boolean }).dev === true;
}

/** An error answered as JSON, with the status the gate chose. Not a JSON-RPC
 *  error: a request refused at the gate never reached the protocol layer, and
 *  dressing it as `-32000` would tell a client the server answered when it did
 *  not. */
function sendGateError(event: H3Event, err: unknown): string {
  const payload = errorPayload(err, isDev());
  setResponseStatus(event, payload.status);
  setResponseHeader(event, 'content-type', 'application/json; charset=utf-8');
  return JSON.stringify(payload);
}

/**
 * Builds the Nitro handler for `/__litro/mcp/:agent`.
 *
 * THE CONFIGURATION CHECK IS SYNCHRONOUS AND FIRST, so a deployment with no
 * token and no local marker fails while the server is starting rather than
 * answering its first request. `resolveGateConfig` throws; Nitro reports the
 * module that threw and the process does not come up. That is the whole point
 * of decision 3 part 4 — there is no default of "open".
 *
 * Everything else resolves once, eagerly, and is shared by every request: the
 * tool list, the schemas and the packed documents are all decided at startup,
 * so a `tools/call` never touches the filesystem.
 */
export function createMcpHandler(
  entries: AgentManifestEntry[],
  options: McpHandlerOptions = {},
): EventHandler {
  const log = options.log ?? defaultLog;
  const load = options.load ?? defaultLoad;

  // Throws. See above.
  const gates: McpGateConfig = resolveGateConfig(process.env, options);

  const appsDir = resolveAppsDir(
    options.cwd ?? process.cwd(),
    options.appsDir ?? process.env[APPS_DIR_ENV],
  );

  /**
   * One resolution for the whole process, started at boot rather than on the
   * first request.
   *
   * Eager, because a tool naming an app the manifest does not list is a startup
   * failure in the specification's terms and finding it at boot is the closest
   * a Nitro route can get. The rejection is stored rather than thrown: an
   * unhandled rejection during Nitro's startup is reported as a crash with no
   * hint of which route caused it, so the error is kept and answered — once per
   * request, with the message the reader needs — and also logged now.
   */
  const resolved: Promise<Map<string, ResolvedMcpServer>> = (async () => {
    // Wrapped as an AgentError so the MESSAGE survives to the client. h3 hides a
    // plain Error's message behind a bare 500, and the messages thrown here —
    // "tool X names the app Y, which the manifest does not list", and what to run
    // about it — are the whole value of resolving at boot. `errorPayload` sends an
    // AgentError's `message` in production by design (AGENT-007).
    const loaded = await loadPackedApps(appsDir).catch(asAgentError);
    const map = new Map<string, ResolvedMcpServer>();
    for (const entry of entries) {
      let one: ResolvedMcpServer;
      try {
        one = resolveMcpAgent(buildAgent(entry), loaded);
      } catch (err) {
        throw asAgentError(err);
      }
      map.set(entry.name, one);
      for (const odd of one.oddNames) {
        // Open question 4 in the spec: fail at startup, or normalize. Neither is
        // ruled, so this does neither — the name is served as written and said
        // out loud, which is what the stdio path does.
        log(
          `[litro mcp] tool name "${odd}" is outside MCP's guidance (1-128 characters of letters, ` +
            'digits, "_", "-" and "."). Serving it as written; a strict host may refuse it.',
        );
      }
    }
    if (loaded.missing && entries.length > 0) {
      log(
        `[litro mcp] no ${loaded.manifestPath}; the HTTP route serves tools only. ` +
          `Run \`litro mcp-app build\`, or set ${APPS_DIR_ENV} to where it wrote.`,
      );
    }
    log(
      `[litro mcp] /__litro/mcp/:agent — ${map.size} agent(s): ` +
        `${[...map.keys()].join(', ') || 'none'}; ${loaded.apps.length} app(s)` +
        (gates.token ? '; bearer token required' : '; local, no token'),
    );
    return map;
  })();
  resolved.catch((err) => log(`[litro mcp] the HTTP route cannot serve: ${(err as Error).message}`));

  // Loaded once, on the first request rather than at boot: a project that
  // declares the route but never receives a request should not pay for the SDK,
  // and the "not installed" message has to reach a reader who is looking at a
  // response, not at a log from ten minutes ago.
  let sdkOnce: Promise<{ sdk: McpSdk; Transport: WebTransportCtor }> | undefined;
  function sdk(): Promise<{ sdk: McpSdk; Transport: WebTransportCtor }> {
    sdkOnce ??= (async () => {
      const loadedSdk = await loadMcpSdk(load);
      return { sdk: loadedSdk, Transport: await loadWebTransport(load) };
    })().catch((err) => {
      // Not cached as a rejection: a project that installs the SDK and restarts
      // nothing should be able to succeed on the next request.
      sdkOnce = undefined;
      throw err;
    });
    return sdkOnce;
  }

  return defineEventHandler(async (event) => {
    let echoOrigin: string | undefined;
    try {
      // GATE 1 — Origin. Present and not allowlisted is 403; absent is allowed,
      // because a host that is not a browser sends none.
      echoOrigin = checkOrigin(event, gates).echoOrigin;
      applyCors(event, echoOrigin);

      if (event.method === 'OPTIONS') {
        // No token gate here. A preflight cannot carry `Authorization`.
        applyPreflight(event);
        setResponseStatus(event, 204);
        return null;
      }

      // GATE 2 — the shared secret, in constant time.
      checkToken(event, gates);

      const agents = await resolved;
      const name = getRouterParam(event, 'agent') ?? '';
      const server = agents.get(name);
      if (!server) {
        throw new AgentError(
          `Unknown agent: "${name}".` +
            (agents.size > 0
              ? ` This project has: ${[...agents.keys()].join(', ')}`
              : ' This project has no agents.'),
          { status: 404 },
        );
      }

      // GATE 3 — the agent's own guard, LAST, exactly as the chat handler runs
      // it. A project puts its own rule here, and it reads a real `H3Event`
      // over HTTP where stdio had none.
      if (server.agent.access) await server.agent.access(event);

      return await handleMcpRequest(event, server, {
        ...options,
        load,
        log,
        sdk: await sdk(),
      });
    } catch (err) {
      if (err instanceof AgentError) {
        // CORS headers survive the error: a browser cannot read a 401 or a 403
        // without them, so the inspector would show a network failure instead
        // of the reason.
        applyCors(event, echoOrigin);
        return sendGateError(event, err);
      }
      throw err;
    }
  });
}

interface RequestDeps extends McpHandlerOptions {
  load: ModuleLoader;
  log: LogLine;
  sdk: { sdk: McpSdk; Transport: WebTransportCtor };
}

/**
 * One request, one transport, one `Server`.
 *
 * SESSIONS: there are none. `sessionIdGenerator: undefined` puts the transport
 * in stateless mode, so no `Mcp-Session-Id` is issued and none is validated.
 * Three reasons, in order:
 *
 *   1. Litro deploys anywhere Nitro deploys, which includes places where the
 *      next request reaches a different instance with a different heap. A
 *      session map in module state would work in `litro dev` and fail in
 *      production, which is the worst shape a bug can have.
 *   2. Protocol revision 2026-07-28 removes protocol-level sessions outright
 *      (spec section 3). Building one now would be work to undo.
 *   3. Nothing this server answers is stateful. Every tool list, schema and
 *      document is resolved at startup, and a `tools/call` carries its own
 *      arguments.
 *
 * The SDK's own client re-sends `initialize` per connection and the legacy
 * handshake completes inside the one POST, which is why a fresh `Server` per
 * request answers correctly rather than complaining that it was never
 * initialized.
 *
 * A CLIENT THAT DISCONNECTS MID-CALL: the `Response` body is a `ReadableStream`
 * the transport owns. h3 pipes it to the connection; when the connection goes
 * away the pipe cancels the stream, the transport's cleanup runs, and
 * `transport.close()` here closes the per-request `Server` with it. The tool
 * itself keeps running to completion — a promise cannot be canceled, and
 * `ToolContext` carries no abort signal in v1 — and its result is dropped
 * instead of written. Nothing is appended to a session store on this path, so
 * there is no half-written turn to recover: that is the agent route's problem
 * (AGENT-001) and not this one.
 */
async function handleMcpRequest(
  event: H3Event,
  server: ResolvedMcpServer,
  deps: RequestDeps,
): Promise<Response> {
  const { sdk, Transport } = deps.sdk;

  const transport = new Transport({
    sessionIdGenerator: undefined,
    enableJsonResponse: deps.enableJsonResponse ?? false,
  });

  const mcp = createMcpServer({
    resolved: server,
    sdk,
    serverInfo: deps.serverInfo ?? { name: `litro-${server.agent.name}`, version: '0.0.0' },
    timeoutMs: deps.timeoutMs,
    maxResultBytes: deps.maxResultBytes,
    log: deps.log,
  });

  await mcp.connect(transport);

  // `toWebRequest` reads the body as a stream, so nothing is parsed here and
  // `parsedBody` is not passed: the transport decides what a valid MCP message
  // is, and a body this route pre-parsed would be this route's reading of the
  // protocol rather than the SDK's (AGENT-012).
  const request = toWebRequest(event);

  let response: Response;
  try {
    response = await transport.handleRequest(request);
  } catch (err) {
    await transport.close();
    throw err;
  }

  // A response with no body is finished, so the transport can go now. One with
  // a body is an SSE stream the transport is still writing to; closing it here
  // would cut the stream off before the first message.
  if (!response.body) {
    await transport.close();
    return response;
  }

  return new Response(closeWhenDone(response.body, transport, deps.log), {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

/**
 * Passes the stream through and closes the transport when it ends — whether it
 * ended because the answer was complete or because the client went away.
 *
 * Without this, one transport and one `Server` leak per request, and a stateless
 * route that leaks per request is a memory leak with a request counter attached.
 *
 * WRITTEN AS A READER LOOP rather than a `TransformStream` with a `cancel`
 * hook: `cancel` on a transformer is a late addition to the streams standard,
 * and whether a given runtime calls it is exactly the kind of thing that would
 * leak silently on one preset and not another. A `ReadableStream`'s own
 * `cancel` has been there since the beginning, and it is the ONE place a
 * mid-call disconnect is observable from here.
 *
 * EXPORTED for its test. A disconnect halfway through an SSE stream is not
 * something a request driven from the same process can reliably stage, and a
 * leak here is invisible until a server has been up for a week — so the
 * contract is pinned directly instead.
 */
export function closeWhenDone(
  source: ReadableStream<Uint8Array>,
  transport: { close(): Promise<void> },
  log: LogLine,
): ReadableStream<Uint8Array> {
  const reader = source.getReader();
  let closed = false;
  const close = (): void => {
    if (closed) return;
    closed = true;
    void transport.close().catch((err) => {
      log(`[litro mcp] closing a transport failed: ${(err as Error).message}`);
    });
  };

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          close();
          return;
        }
        controller.enqueue(value);
      } catch (err) {
        controller.error(err);
        close();
      }
    },
    cancel(reason) {
      // The client went away mid-call. Release the source so the SDK's own
      // stream cleanup runs, then close the transport and its `Server`.
      close();
      return reader.cancel(reason);
    },
  });
}

/**
 * Keeps a message written for a reader on its way to the reader.
 *
 * h3 answers a plain `Error` with a bare 500 and no message, which is right for
 * an unexpected throw and wrong for these: "tool X names the app Y, which the
 * manifest does not list" and what to run about it is the entire value of
 * resolving at boot. `AgentError`'s message is sent in production by design
 * (AGENT-007), so the reader gets the sentence instead of a status code.
 */
function asAgentError(err: unknown): never {
  if (err instanceof AgentError) throw err;
  throw new AgentError((err as Error)?.message ?? String(err), { status: 500, cause: err });
}
