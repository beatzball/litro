/**
 * Bridge resolution.
 *
 * One bridge is resolved on the first call, cached, and reused. Nothing native
 * is imported or probed while this module is evaluated, which is the rule that
 * keeps a server render safe: a static import of a native module would run
 * before this file's body, and that class of bug builds clean and fails
 * silently. See rule BUILD-009 for the same trap in the hydration entry.
 *
 * Phase 1 ships the web path only. When the native host lands, this is the one
 * place that learns about it.
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
  return (cached ??= resolve());
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

async function resolve(): Promise<NativeBridge> {
  const { WebBridge } = await import('./adapters/web.js');
  return new WebBridge();
}
