/**
 * `litro mcp serve` — serves one agent's tools, and the `ui://` documents
 * `litro mcp-app build` packed, to an MCP host over stdio.
 *
 * This file is deliberately thin. Everything about MCP lives in
 * `@beatzball/litro-agent/mcp-server`; this command's whole job is to compile
 * the project's source, load that subpath from the PROJECT's dependencies, and
 * keep stdout clean while doing it.
 *
 * WHY THE SUBPATH IS IMPORTED AT RUNTIME
 *
 * Exactly the reason `litro mcp-app build` gives for the packager:
 * `@beatzball/litro-agent` depends on this package, so a static import would be
 * a cycle, and a project with no agent layer still has a working CLI. It is
 * resolved from the project's own dependencies when the command runs.
 *
 * WHY VITE AND NOT NITRO
 *
 * Open question 5 of the design spec, settled by measurement:
 *
 *   - Vite's `ssrLoadModule` loads `agents/<name>/agent.ts` and its `tools/*.ts`
 *     in 146ms, with the project's own tsconfig, and no listening socket.
 *   - Nitro gets there only by building and starting a dev server (1.2s to
 *     `createNitro` alone), and its own logger writes to STDOUT — measured on
 *     this repo's playground — which is the one thing a stdio server must not
 *     do. Worse, the tool map would live in the dev worker, so answering stdio
 *     would mean a second hop through HTTP and through the agent handler's gate
 *     stack, which rejects every MCP host by design (decision 3).
 *   - The one thing Nitro would buy — a real `H3Event` for `ctx.event` — does
 *     not exist over stdio anyway. There is no request.
 *
 * Not jiti, for the reason the comment above `createServer` in `./mcp-app.ts`
 * records: it mis-orders the decorator and class-property passes and fails on a
 * Lit `@property` field.
 */
import { createServer, type Logger } from 'vite';
import { Writable } from 'node:stream';
import { existsSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'pathe';

/** The shape this command uses out of `@beatzball/litro-agent/mcp-server`. */
interface McpServerModule {
  serveMcpStdio(options: {
    cwd: string;
    agent?: string;
    appsDir?: string;
    load: (id: string) => Promise<Record<string, unknown>>;
    stdout?: Writable;
    log?: (line: string) => void;
    timeoutMs?: number;
    maxResultBytes?: number;
    serverInfo?: { name: string; version: string };
  }): Promise<{ agentName: string; toolNames: string[]; appUris: string[]; closed: Promise<void> }>;
}

/** Everything this command prints goes to stderr. stdout belongs to the
 *  JSON-RPC channel and nothing else. */
function warn(line: string): void {
  process.stderr.write(`${line}\n`);
}

/**
 * Takes stdout away from everything except the MCP transport.
 *
 * Done FIRST, before Vite starts and before a line of project source is
 * compiled, because the damage is done by whichever module logs earliest. The
 * original write is captured here and handed to the transport as a stream; every
 * other writer — Vite, the project's own `console.log`, a dependency's banner —
 * lands on stderr instead.
 */
function takeStdout(): { mcpStdout: Writable; restore: () => void } {
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

  // PUT BACK ON EVERY FAILURE PATH. A server that starts owns the process until
  // the host kills it, so the redirect is permanent and that is correct — but a
  // startup failure RETURNS, and leaving stdout pointed at stderr then makes
  // every later write in the same process go to the wrong stream. It also made
  // an unrelated test in this package fail, which is how it was found.
  //
  // Only restores what this function replaced: something else may have patched
  // stdout since, and clobbering that would be worse than leaving the redirect.
  return {
    mcpStdout,
    restore: () => {
      if (process.stdout.write === patched) process.stdout.write = original;
    },
  };
}

/** A Vite logger that writes to stderr. Belt and braces over `takeStdout` —
 *  Vite's default logger reaches stdout through `console.log`, which the
 *  rebind already covers, but a logger that never tries is easier to reason
 *  about. */
function stderrLogger(): Logger {
  const write = (msg: string): void => void process.stderr.write(`${msg}\n`);
  const logger: Logger = {
    hasWarned: false,
    info: write,
    warn: (msg) => {
      logger.hasWarned = true;
      write(msg);
    },
    warnOnce: (msg) => {
      logger.hasWarned = true;
      write(msg);
    },
    error: (msg) => {
      logger.hasWarned = true;
      write(msg);
    },
    clearScreen: () => {},
    hasErrorLogged: () => false,
  };
  return logger;
}

function flagValue(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag);
  if (i !== -1 && args[i + 1]) return args[i + 1];
  const inline = args.find((a) => a.startsWith(`${flag}=`));
  return inline ? inline.slice(flag.length + 1) : undefined;
}

function positiveInt(raw: string | undefined, flag: string): number | undefined {
  if (raw === undefined) return undefined;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`${flag} takes a positive whole number of ${flag === '--timeout' ? 'milliseconds' : 'bytes'}, got "${raw}".`);
  }
  return n;
}

const USAGE =
  'usage: litro mcp serve [--project <dir>] [--agent <name>] [--apps-dir <dir>] ' +
  '[--timeout <ms>] [--max-result-bytes <n>]';

/**
 * The project directory, which is NOT always the working directory.
 *
 * `--project` exists because a host launches this command with a cwd of its own
 * choosing, and at least one desktop host ignores a `cwd` field in its server
 * configuration entirely. Without the flag the only configuration that worked
 * was a shell wrapper doing `cd <project> && exec ...`, which is not something
 * to ask of anyone for the headline command.
 *
 * NAMED `--project`, not `--dir`: `litro mcp-app build --dir` already means
 * something else — the `mcp-apps/` SOURCE directory — and one flag name meaning
 * "project root" in one subcommand and "a directory inside the project" in
 * another is how a CLI becomes guesswork. `--project` is also what `tsc` calls
 * the same idea.
 *
 * Relative to the real working directory, so `--project ../api` behaves the way
 * a path typed in a shell does.
 */
function resolveProject(args: string[], cwd: string): { project: string; explicit: boolean } {
  const flag = flagValue(args, '--project');
  if (flag === undefined) return { project: cwd, explicit: false };
  return { project: isAbsolute(flag) ? flag : resolve(cwd, flag), explicit: true };
}

/**
 * Runs `litro mcp <subcommand>`.
 *
 * Returns 0 while a server is RUNNING — the caller must not exit on it, because
 * the process now belongs to the host that started it. Any non-zero return is a
 * startup failure that has already been explained on stderr.
 */
export async function mcpCommand(args: string[], cwd: string): Promise<number> {
  if (args[0] !== 'serve') {
    warn(USAGE);
    return 2;
  }

  let timeoutMs: number | undefined;
  let maxResultBytes: number | undefined;
  try {
    timeoutMs = positiveInt(flagValue(args, '--timeout'), '--timeout');
    maxResultBytes = positiveInt(flagValue(args, '--max-result-bytes'), '--max-result-bytes');
  } catch (err) {
    warn(`litro mcp serve: ${(err as Error).message}`);
    return 2;
  }

  const agent = flagValue(args, '--agent');
  const appsDir = flagValue(args, '--apps-dir');
  const { project, explicit } = resolveProject(args, cwd);

  // Checked before Vite starts, because Vite is happy to start on a directory
  // that is not a project at all and the failure then arrives as a resolution
  // error four steps later.
  if (!existsSync(join(project, 'package.json'))) {
    warn(
      `litro mcp serve: ${project} has no package.json, so it is not a project directory.\n` +
        (explicit
          ? '  Check the --project path.'
          : '  This command takes the project from the working directory. Pass --project <dir> when ' +
            'the host launches it somewhere else.'),
    );
    return 1;
  }

  // BEFORE Vite. A banner printed while the bundler starts is a stray byte on
  // the JSON-RPC channel, and the specification forbids it whether or not a
  // given client survives it.
  const { mcpStdout, restore } = takeStdout();

  const vite = await createServer({
    root: project,
    appType: 'custom',
    server: {
      middlewareMode: true,
      // NO SOCKET. A stdio server has nothing to hot-reload, and the socket
      // binds a fixed port (24678) — so a host configured with two Litro
      // projects started one and then printed "WebSocket server error: Port
      // 24678 is already in use" for the second. Two servers side by side is an
      // ordinary thing to want.
      //
      // BOTH FLAGS, because they do different things and only one of them is
      // the fix. `hmr: false` turns off hot reloading; measured, it leaves the
      // WebSocket server running and the port warning intact. `ws: false` is
      // what stops the socket being opened at all. It is marked experimental in
      // Vite 8, which is why `hmr: false` stays as well: if `ws` ever goes away,
      // this path is still asking for no hot reload rather than silently
      // regaining it.
      hmr: false,
      ws: false,
    },
    customLogger: stderrLogger(),
  });

  /** Every failure path from here on: report, close Vite, put stdout back. */
  const fail = async (message: string): Promise<number> => {
    warn(message);
    await vite.close();
    restore();
    return 1;
  };

  let mod: McpServerModule;
  try {
    mod = (await vite.ssrLoadModule('@beatzball/litro-agent/mcp-server')) as unknown as McpServerModule;
  } catch (err) {
    // Only a resolution failure means "not installed". Anything else — a
    // syntax error, a bad export map, a throwing import — was being reported as
    // a missing package, which sends the reader to reinstall something they
    // already have. Same test as `litro mcp-app build`.
    const message = (err as Error)?.message ?? String(err);
    // Same four forms as `./mcp-app.ts` — see the comment there for why "Failed
    // to load url" is in the list.
    if (/Failed to resolve|Failed to load url|Does the file exist\?|Cannot find (module|package)|ERR_MODULE_NOT_FOUND/i.test(message)) {
      return await fail(
        'litro mcp serve: @beatzball/litro-agent is not installed in this project.\n' +
          '  pnpm add @beatzball/litro-agent',
      );
    }
    return await fail(`litro mcp serve: could not load @beatzball/litro-agent/mcp-server\n  ${message}`);
  }

  let running: { closed: Promise<void> };
  try {
    running = await mod.serveMcpStdio({
      cwd: project,
      agent,
      appsDir,
      // The SAME resolver the project's own modules load through, so the SDK
      // that answers is the project's copy and the Lit a tool renders with is
      // the one its templates were built by. Two copies of either fail in ways
      // that are tedious to read.
      load: (id) => vite.ssrLoadModule(id) as Promise<Record<string, unknown>>,
      stdout: mcpStdout,
      log: warn,
      timeoutMs,
      maxResultBytes,
    });
  } catch (err) {
    let message = (err as Error)?.message ?? String(err);
    // The reader is most likely in the wrong directory, and the message says
    // which directory was searched but not how to change it.
    if (!explicit && /^no agents found in /.test(message)) {
      message +=
        '\n  This command takes the project from the working directory. Pass --project <dir> when the ' +
        'host launches it somewhere else.';
    }
    return await fail(`litro mcp serve: ${message}`);
  }

  // The Vite server stays open while the host is connected: it is what compiles
  // a tool's module graph, and a tool may still import something lazily on its
  // first call.
  //
  // Then it is closed, deliberately. A stdio server's lifetime is its host's, so
  // when the host closes stdin this process has no reason to stay — and nothing
  // would end it on its own, because Vite holds the event loop open. Without
  // this, every start and stop leaves an orphaned Node process behind.
  await running.closed;
  await vite.close();
  restore();
  return 0;
}
