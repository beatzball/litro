import type { ChildProcess } from 'node:child_process';
import { join, resolve } from 'node:path';
import { MOCK_API_PORT } from '../config.js';
import { startCommand, waitForReady, stopServer } from './server-lifecycle.js';

const MOCK_API_DIR = new URL('../../mock-api/', import.meta.url).pathname;
const BENCHMARKS_DIR = new URL('../../', import.meta.url).pathname;

export async function startMockApi(): Promise<ChildProcess> {
  const serverScript = join(MOCK_API_DIR, 'server.ts');
  const tsxBin = resolve(BENCHMARKS_DIR, 'node_modules', '.bin', 'tsx');
  const proc = await startCommand(tsxBin, [serverScript], MOCK_API_DIR, MOCK_API_PORT, 'mock-api', false, {
    MOCK_API_PORT: String(MOCK_API_PORT),
  });
  try {
    await waitForReady(`http://localhost:${MOCK_API_PORT}/v0/topstories.json`, 15_000, proc);
    console.log(`Mock HN API ready on port ${MOCK_API_PORT}`);
    return proc;
  } catch (error) {
    await stopServer(proc);
    throw error;
  }
}

export const stopMockApi = stopServer;
