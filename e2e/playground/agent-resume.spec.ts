/**
 * Item 3 -- kill mid-stream, resume from the persisted log.
 *
 * This spec runs its OWN Nitro dev server on port 3052 (spawned/killed via
 * child_process, not the shared `playground` project webServer on 3030), so
 * it can SIGKILL the whole process group without taking down the server the
 * other playground specs depend on. Absolute `fetch()` calls are used
 * throughout instead of Playwright's `request`/`page` fixtures, which are
 * bound to the project's baseURL (3030) -- see the task brief.
 *
 * v0 CONTRACT being verified here (see packages/litro-agent/src/runtime/
 * handler.ts's module doc): the session store is a durable, file-backed LOG
 * (playground/.litro/sessions/<id>.jsonl). Killing the server mid-turn does
 * NOT resume the dead turn's execution -- there is no re-entrant turn
 * runner. What survives is exactly the prefix of `SessionEvent`s that were
 * `store.append()`-ed (and therefore durable) before the process died. A GET
 * replay after restart returns that truncated-but-clean prefix and then
 * ends the HTTP response with the transport-level `{"done":true}` -- which
 * is NOT the same claim as "the turn completed" (no `turn-end` event exists
 * in the log). This spec asserts exactly that shape, not a completed turn.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { serializeValue, createStreamDecoder, type StreamChunk } from '../../packages/framework/dist/stream.js';

// Playwright transpiles spec files to CJS, so __dirname (not import.meta.url)
// is the reliable way to locate this file on disk.
const repoRoot = path.resolve(__dirname, '../..');
const playgroundDir = path.join(repoRoot, 'playground');
const litroDataDir = path.join(playgroundDir, '.litro');
const cliEntry = path.join(repoRoot, 'packages/framework/dist/cli/index.js');

const PORT = 3052;
const BASE = `http://localhost:${PORT}`;
// Unique per run, same rationale as e2e/playground/agent.spec.ts's `session`:
// `beforeAll` wipes `.litro/` before starting the server, but that hook does
// NOT re-run on a Playwright retry of this test -- a fixed id would let a
// retry's POST land in the same session file as the killed first attempt,
// replaying a longer (duplicated) event sequence and breaking the exact
// `toEqual(['message', 'text-delta'])` assertion below.
const SESSION = `e2e-resume-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

let proc: ChildProcess | undefined;
let stdoutBuf = '';
let stderrBuf = '';

/** Spawns `litro dev --port 3052` in `playground/`, in its own process
 *  group (`detached: true`) -- Nitro's dev CLI forks a nitropack child
 *  process that does NOT share a pid with the top-level `node cli/index.js`
 *  process but DOES inherit its process group, so a plain `proc.kill()`
 *  would leave that child (and its listening socket) running. Killing the
 *  whole group via `process.kill(-pid, ...)` in stopServer() below is the
 *  only way to actually take the server down. */
function startServer(): ChildProcess {
  stdoutBuf = '';
  stderrBuf = '';
  const child = spawn('node', [cliEntry, 'dev', '--port', String(PORT)], {
    cwd: playgroundDir,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout?.on('data', (d: Buffer) => {
    stdoutBuf += d.toString();
  });
  child.stderr?.on('data', (d: Buffer) => {
    stderrBuf += d.toString();
  });
  return child;
}

function stopServer(child: ChildProcess): void {
  if (child.pid === undefined) return;
  try {
    process.kill(-child.pid, 'SIGKILL');
  } catch {
    // already dead
  }
}

async function waitForServerUp(timeoutMs = 30000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/agent`, { signal: AbortSignal.timeout(1000) });
      if (res.ok) {
        await res.text();
        return;
      }
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(
    `server on port ${PORT} did not become ready within ${timeoutMs}ms\n--- stdout ---\n${stdoutBuf}\n--- stderr ---\n${stderrBuf}`,
  );
}

async function waitForServerDown(timeoutMs = 10000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await fetch(BASE, { signal: AbortSignal.timeout(500) });
    } catch {
      return; // connection refused/aborted -- port is free
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`server on port ${PORT} did not go down within ${timeoutMs}ms`);
}

function valueKinds(chunks: StreamChunk[]): string[] {
  return chunks
    .filter((c): c is { kind: 'value'; value: unknown } => c.kind === 'value')
    .map((c) => (c.value as { kind: string }).kind);
}

test.describe('agent demo — kill mid-stream, resume from the persisted log', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    await rm(litroDataDir, { recursive: true, force: true });
    proc = startServer();
    await waitForServerUp();
  });

  test.afterAll(async () => {
    if (proc) stopServer(proc);
    await rm(litroDataDir, { recursive: true, force: true }).catch(() => {});
  });

  test('a POST killed mid-turn leaves a truncated-but-clean log; GET replay after restart does not fabricate a completed turn', async () => {
    // "slowly" makes the demo agent (playground/agents/demo/agent.ts)
    // splice a 1500ms delay in after every text-delta -- the first one
    // opens a real kill window between the persisted "message" + first
    // "text-delta" and the tool-call that would otherwise follow.
    const postRes = await fetch(`${BASE}/__litro/agent/demo/${SESSION}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-litro-agent': '1' },
      body: serializeValue({ text: 'weather slowly' }),
    });
    expect(postRes.ok).toBe(true);
    expect(postRes.body).not.toBeNull();

    const reader = postRes.body!.getReader();
    const decode = createStreamDecoder();
    const textDecoder = new TextDecoder();
    let buffer = '';
    const seen: StreamChunk[] = [];

    // Read raw bytes off the wire until 2 full NDJSON lines have decoded
    // (the user "message" + the first "text-delta") -- this happens well
    // inside the 1500ms delay the demo agent opens before its tool-call, so
    // the server is still holding the turn open when we kill it below.
    while (seen.length < 2) {
      const { value, done } = await reader.read();
      if (done) throw new Error('stream ended before 2 lines were read -- the slow delay may not have fired');
      buffer += textDecoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, nl);
        buffer = buffer.slice(nl + 1);
        if (line.trim()) seen.push(decode(line));
      }
    }
    await reader.cancel().catch(() => {});

    expect(valueKinds(seen)).toEqual(['message', 'text-delta']);

    // Kill the whole process group -- the turn is now dead. v0 has no
    // re-entrant turn runner: nothing will ever append the tool-call/ui/
    // closing-text/assistant-message/turn-end events this turn would have
    // produced had it run to completion.
    stopServer(proc!);
    await waitForServerDown();

    // Restart the exact same server. The session log is file-backed
    // (playground/.litro/sessions/<id>.jsonl), so the prefix that was
    // durably appended before the kill survives the restart even though the
    // in-memory lock/broadcast state (both process-global) does not.
    proc = startServer();
    await waitForServerUp();

    const replay = await fetch(`${BASE}/__litro/agent/demo/${SESSION}?from=0`);
    expect(replay.ok).toBe(true);
    const replayText = await replay.text();
    const chunks = replayText
      .split('\n')
      .filter((l) => l.length > 0)
      .map(createStreamDecoder());

    // Transport-level clean termination: the GET always ends with
    // {"done":true} once it has replayed everything the store has, in a
    // fresh process with no in-flight lock for this session/agent key.
    expect(chunks[chunks.length - 1]).toEqual({ kind: 'done' });

    const kinds = valueKinds(chunks);

    // The v0 contract, asserted exactly: the persisted PREFIX replayed
    // (user message + first text-delta survived the kill) -- and nothing
    // more. No tool-call, no ui event, no closing text, no assistant
    // message, and critically no turn-end: this is a truncated-but-clean
    // replay of a dead turn, not a completed one.
    expect(kinds).toEqual(['message', 'text-delta']);
    expect(kinds).not.toContain('turn-end');
  });
});
