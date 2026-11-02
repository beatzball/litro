/**
 * Bridge resolution.
 *
 * One bridge is resolved on the first call, cached, and reused. Nothing native
 * is imported or probed while this module is evaluated, which is the rule that
 * keeps a server render safe: a static import of a native module would run
 * before this file's body, and that class of bug builds clean and fails
 * silently. See rule BUILD-009 for the same trap in the hydration entry.
 *
 * In a browser, both adapters are loaded in parallel and the shell adapter is
 * asked whether a shell hosts this page. It answers only after the handshake,
 * so every call made before then simply waits on the promise below. On the
 * server, the shell adapter is never loaded at all.
 */

import type { NativeBridge } from './types.js';

let cached: Promise<NativeBridge> | null = null;

/**
 * The bridge for this environment.
 *
 * Calling this during a server render resolves the web bridge without touching
 * a browser global. The returned promise is cached, so the work happens once
 * however many callers ask.
 */
export function getBridge(): Promise<NativeBridge> {
  if (cached === null) {
    // Cache the promise, not the result, so concurrent first callers share one
    // resolution. Drop it again if that resolution fails: the adapter arrives
    // over the network as its own chunk, and a single flaky load must not turn
    // every later call into a rejection for the life of the page.
    const attempt: Promise<NativeBridge> = resolve().then(({ bridge, final }) => {
      // A provisional answer is used for the callers already waiting, and then
      // forgotten, so the next call tries again. See `resolve`.
      if (!final && cached === attempt) cached = null;
      return bridge;
    });
    cached = attempt;
    attempt.catch(() => {
      if (cached === attempt) cached = null;
    });
  }
  return cached;
}

/**
 * Forgets the cached bridge.
 *
 * Only useful in tests, which need to resolve again after changing what the
 * environment exposes. Nothing in an app should call it.
 */
export function resetBridgeForTests(): void {
  cached = null;
}

interface Resolution {
  bridge: NativeBridge;
  /** False when the answer is a stand-in that a later call should replace. */
  final: boolean;
}

async function resolve(): Promise<Resolution> {
  // `typeof` on an undeclared global never throws, so this is safe on the
  // server, and it is the only global this file reads. Everything that knows
  // what a shell looks like lives in adapters/shell.ts.
  if (typeof window === 'undefined') {
    const { WebBridge } = await import('./adapters/web.js');
    return { bridge: new WebBridge(), final: true };
  }

  // In parallel, not one after the other: the shell bridge needs the web one
  // for every capability its build left out, and a plain browser should not
  // pay a second round trip to learn there is no shell.
  //
  // The shell chunk is allowed to fail. A plain web page never needed it, and
  // a capability call must not reject over a chunk the page did not ask for.
  // This file cannot tell whether a shell is present -- only shell.ts may look
  // -- so the web bridge answers the waiting callers and the answer is not
  // cached. Inside a shell, the next call retries the chunk and reaches the
  // shell; on a plain web page the retry costs one more failed import while
  // the chunk is broken, and nothing at all once it loads.
  const [{ WebBridge }, shellModule] = await Promise.all([
    import('./adapters/web.js'),
    import('./adapters/shell.js').catch(() => null),
  ]);
  const web = new WebBridge();
  if (shellModule === null) return { bridge: web, final: false };
  return { bridge: (await shellModule.connectShell(window, web)) ?? web, final: true };
}
