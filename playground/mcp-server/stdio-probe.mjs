/**
 * stdio-probe — drives `litro mcp serve` with the SDK's OWN client and prints
 * what the client received.
 *
 * The companion to `inspector-probe.mjs`, which drives a browser-based host over
 * HTTP. That one renders the `ui://` document; this one covers the transport a
 * person actually starts with and the one no browser can reach. Between them,
 * neither transport is checked only by something this repo wrote (AGENT-012).
 *
 * It also runs the check the design spec asks of phase 1 by name: pipe the
 * server's stdout through a JSON-per-line reader and assert that nothing but MCP
 * messages came out. The specification says a stdio server MUST NOT write
 * anything else there, and a single stray log line raises a transport error on
 * the client.
 *
 * Run:
 *   pnpm --filter playground mcp-app                      # pack first
 *   node playground/mcp-server/stdio-probe.mjs            # transcript
 *   node playground/mcp-server/stdio-probe.mjs --purity   # the stdout check
 *
 *   TOOL=<name> ARGS='{"city":"Lisbon"}' node ... --      # call another tool
 *   node playground/mcp-server/stdio-probe.mjs -- --timeout 1500
 *
 * Anything after `--` is passed to `litro mcp serve` itself.
 */
import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT = resolve(HERE, '..');
/** The CLI as an installed app resolves it, not a workspace path. */
const CLI = join(PROJECT, 'node_modules', '@beatzball', 'litro', 'dist', 'cli', 'index.js');

const argv = process.argv.slice(2);
const purity = argv.includes('--purity');
const dashdash = argv.indexOf('--');
/**
 * `--project` is always passed, because that is the configuration a host
 * actually uses: a host launches the command with a working directory of its
 * own, so the project has to be named. Running the probe from anywhere should
 * behave the same as running it from the playground.
 */
const serveArgs = ['--project', PROJECT, ...(dashdash === -1 ? [] : argv.slice(dashdash + 1))];

const out = (label, value) => console.log(`\n### ${label}\n${JSON.stringify(value, null, 2)}`);

if (purity) {
  await checkStdoutPurity();
} else {
  await transcript();
}

/** The full client-side transcript: list, call, read. */
async function transcript() {
  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
  const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js');

  const transport = new StdioClientTransport({
    command: 'node',
    args: [CLI, 'mcp', 'serve', ...serveArgs],
    // NO cwd. The probe's own working directory is inherited, whatever it is,
    // because that is a host's situation exactly — `--project` is what has to do
    // the work. Run this from anywhere and it should behave the same.
    // The server's own startup line and every project log go here. Inherited so
    // a reader can see that they did NOT go to stdout.
    stderr: 'inherit',
  });
  const client = new Client({ name: 'litro-stdio-probe', version: '0.0.1' });
  await client.connect(transport);

  out('initialize -> server', client.getServerVersion());
  const tools = await client.listTools();
  out('tools/list', tools);
  out('resources/list', await client.listResources());

  const name = process.env.TOOL ?? 'get-weather';
  const args = JSON.parse(process.env.ARGS ?? '{"city":"Lisbon"}');
  let result;
  try {
    result = await client.callTool({ name, arguments: args });
    out(`tools/call ${name}`, summarize(result));
  } catch (err) {
    out(`tools/call ${name} -> PROTOCOL ERROR`, { code: err.code, message: err.message });
  }

  // AGENT-002, checked rather than assumed: a UIResult's html is not in the
  // tools/call answer. The `ui://` document is the view, and it is read
  // separately, below.
  if (result) {
    const wire = JSON.stringify(result);
    console.log(
      `\n### AGENT-002 — html on the tools/call wire?\n` +
        `${/shadowrootmode|lit-part|"html"/.test(wire) ? 'YES — THIS IS A BUG' : 'no'}`,
    );
  }

  const uri = tools.tools.find((t) => t.name === name)?._meta?.ui?.resourceUri;
  if (uri) {
    const read = await client.readResource({ uri });
    const text = read.contents[0]?.text ?? '';
    out(`resources/read ${uri}`, {
      mimeType: read.contents[0]?.mimeType,
      _meta: read.contents[0]?._meta,
      bytes: Buffer.byteLength(text, 'utf8'),
      firstLine: text.split('\n')[0],
    });
  }

  // An unknown tool is a protocol error naming the tool, not an internal error.
  try {
    out('tools/call no-such-tool', await client.callTool({ name: 'no-such-tool', arguments: {} }));
  } catch (err) {
    out('tools/call no-such-tool -> PROTOCOL ERROR', { code: err.code, message: err.message });
  }

  await client.close();
}

/** Keeps a huge result readable: the text is capped on purpose, so printing all
 *  of it says nothing that its length does not. */
function summarize(result) {
  const text = result.content?.[0]?.text ?? '';
  return {
    ...result,
    content: [
      {
        ...result.content?.[0],
        text: text.length > 400 ? `${text.slice(0, 200)} … [${text.length} chars] … ${text.slice(-160)}` : text,
      },
    ],
  };
}

/**
 * The spec's phase-1 stdout check, spoken to the server by hand rather than
 * through the SDK's client — the point is to read the raw bytes, which a client
 * parses away.
 */
async function checkStdoutPurity() {
  // No cwd, for the same reason as above: `--project` is what locates the
  // project, not where the probe happens to be run from.
  const child = spawn('node', [CLI, 'mcp', 'serve', ...serveArgs], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (c) => (stdout += c));
  child.stderr.on('data', (c) => (stderr += c));

  const send = (msg) => child.stdin.write(`${JSON.stringify(msg)}\n`);
  send({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'purity', version: '0' } },
  });
  // Vite compiles the project's agent and tool modules on the first request, so
  // the server answers `initialize` only after that. Nothing here races it: the
  // rest is sent once there is an answer.
  await waitFor(() => stdout.includes('"id":1'), 30_000);
  send({ jsonrpc: '2.0', method: 'notifications/initialized' });
  send({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
  send({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'get-weather', arguments: { city: 'Lisbon' } } });
  await waitFor(() => stdout.includes('"id":3'), 30_000);
  child.kill();

  const lines = stdout.split('\n').filter((l) => l.trim() !== '');
  const bad = [];
  for (const line of lines) {
    try {
      if (JSON.parse(line).jsonrpc !== '2.0') bad.push(`not an MCP message: ${line.slice(0, 120)}`);
    } catch {
      bad.push(`not JSON: ${JSON.stringify(line.slice(0, 120))}`);
    }
  }

  console.log(`stdout lines: ${lines.length}`);
  console.log(`stray lines on stdout: ${bad.length}`);
  for (const b of bad) console.log(`  ${b}`);
  console.log(`stderr bytes (allowed, and where every log belongs): ${stderr.length}`);
  console.log(`tools/call answered: ${lines.some((l) => l.includes('structuredContent'))}`);
  console.log(`UIResult html on stdout: ${/shadowrootmode|lit-part/.test(stdout) ? 'YES — A BUG' : 'no'}`);
  process.exit(bad.length === 0 ? 0 : 1);
}

async function waitFor(predicate, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('timed out waiting for the server');
    await new Promise((r) => setTimeout(r, 50));
  }
}
