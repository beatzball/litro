/**
 * Unit tests for the Lit controller.
 *
 * Run with: pnpm --filter @beatzball/litro-native test
 *
 * The host is a fake with the two members the controller uses, which is also
 * the proof that the controller needs nothing else from Lit. The platform read
 * is mocked so each test controls when the answer arrives, because the point of
 * the controller is what a component renders before it does.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlatformInfo } from '../types.js';

const readPlatform = vi.hoisted(() => vi.fn());

vi.mock('../platform.js', () => ({
  platform: readPlatform,
  supports: vi.fn(),
}));

const { NativeController } = await import('../lit.js');
type Controller = InstanceType<typeof NativeController>;

/** A host that records what the controller asked of it. */
class FakeHost {
  controllers: Array<{ hostConnected?(): void; hostDisconnected?(): void }> = [];
  updates = 0;

  addController(controller: { hostConnected?(): void; hostDisconnected?(): void }): void {
    this.controllers.push(controller);
  }

  requestUpdate(): void {
    this.updates += 1;
  }
}

const NATIVE: PlatformInfo = {
  isNative: true,
  os: 'ios',
  bridgeVersion: 1,
  supports: ['haptics', 'notifications', 'badging', 'secureStorage', 'share', 'review'],
};

const WEB: PlatformInfo = {
  isNative: false,
  os: 'web',
  supports: [],
};

/** Let the controller's `.then` callback run. */
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  readPlatform.mockReset();
  // A read that never settles is the safe default: the real `platform()` always
  // returns a promise, so a test that does not care when the answer arrives
  // should still hand the controller one.
  readPlatform.mockReturnValue(new Promise(() => {}));
});

describe('registration', () => {
  it('adds itself to the host, so the host drives its lifecycle', () => {
    const host = new FakeHost();
    const controller = new NativeController(host);

    expect(host.controllers).toEqual([controller]);
  });

  it('reads nothing until the host connects', () => {
    const host = new FakeHost();
    new NativeController(host);

    expect(readPlatform).not.toHaveBeenCalled();
  });
});

describe('before the answer arrives', () => {
  it('reports a null platform, which is the server render answer', () => {
    const host = new FakeHost();
    const controller = new NativeController(host);

    expect(controller.platform).toBeNull();
  });

  it('reports every capability as unsupported', () => {
    const host = new FakeHost();
    const controller = new NativeController(host);
    controller.hostConnected();

    expect(controller.supports('haptics')).toBe(false);
    expect(controller.supports('share')).toBe(false);
  });

  it('has not asked for an update', () => {
    const host = new FakeHost();
    const controller = new NativeController(host);
    controller.hostConnected();

    expect(host.updates).toBe(0);
  });
});

describe('when the answer arrives', () => {
  let host: FakeHost;
  let controller: Controller;

  beforeEach(async () => {
    host = new FakeHost();
    readPlatform.mockResolvedValue(NATIVE);
    controller = new NativeController(host);
    controller.hostConnected();
    await settle();
  });

  it('holds the platform it was given', () => {
    expect(controller.platform).toEqual(NATIVE);
  });

  it('asks for exactly one update', () => {
    expect(host.updates).toBe(1);
  });

  it('reports a listed capability as supported', () => {
    expect(controller.supports('haptics')).toBe(true);
  });

  it('reports a capability missing from the list as unsupported', async () => {
    const partialHost = new FakeHost();
    readPlatform.mockResolvedValue({
      isNative: true,
      os: 'ios',
      bridgeVersion: 1,
      // A host that implements haptics and nothing else. The shell decides this
      // per build, so an app cannot assume a native host has all six.
      supports: ['haptics'],
    } satisfies PlatformInfo);
    const partial = new NativeController(partialHost);
    partial.hostConnected();
    await settle();

    expect(partial.supports('haptics')).toBe(true);
    expect(partial.supports('review')).toBe(false);
    expect(partial.supports('secureStorage')).toBe(false);
  });
});

describe('on the web', () => {
  it('supports nothing, so a native-only control never renders', async () => {
    const host = new FakeHost();
    readPlatform.mockResolvedValue(WEB);
    const controller = new NativeController(host);
    controller.hostConnected();
    await settle();

    expect(controller.platform?.isNative).toBe(false);
    for (const capability of ['haptics', 'notifications', 'badging', 'secureStorage', 'share', 'review'] as const) {
      expect(controller.supports(capability)).toBe(false);
    }
  });
});

describe('reading once', () => {
  it('reads once however many times the host connects', async () => {
    const host = new FakeHost();
    readPlatform.mockResolvedValue(NATIVE);
    const controller = new NativeController(host);

    controller.hostConnected();
    controller.hostConnected();
    await settle();
    controller.hostConnected();
    await settle();

    expect(readPlatform).toHaveBeenCalledTimes(1);
    expect(host.updates).toBe(1);
  });

  it('does not read again after a disconnect and reconnect', async () => {
    const host = new FakeHost();
    readPlatform.mockResolvedValue(NATIVE);
    const controller = new NativeController(host);

    controller.hostConnected();
    await settle();
    controller.hostDisconnected();
    controller.hostConnected();
    await settle();

    expect(readPlatform).toHaveBeenCalledTimes(1);
  });
});

describe('a host that went away', () => {
  it('is not asked to update', async () => {
    const host = new FakeHost();
    let resolve!: (info: PlatformInfo) => void;
    readPlatform.mockReturnValue(new Promise<PlatformInfo>((r) => { resolve = r; }));

    const controller = new NativeController(host);
    controller.hostConnected();
    controller.hostDisconnected();
    resolve(NATIVE);
    await settle();

    expect(controller.platform).toEqual(NATIVE);
    expect(host.updates).toBe(0);
  });
});

describe('a failed read', () => {
  it('leaves the platform unread rather than caching the failure', async () => {
    const host = new FakeHost();
    readPlatform.mockRejectedValue(new Error('chunk load failed'));
    const controller = new NativeController(host);

    controller.hostConnected();
    await settle();

    expect(controller.platform).toBeNull();
    expect(controller.supports('haptics')).toBe(false);
    expect(host.updates).toBe(0);
  });

  it('tries again on the next connect, and succeeds', async () => {
    const host = new FakeHost();
    readPlatform.mockRejectedValueOnce(new Error('chunk load failed'));
    const controller = new NativeController(host);

    controller.hostConnected();
    await settle();

    readPlatform.mockResolvedValue(NATIVE);
    controller.hostConnected();
    await settle();

    expect(readPlatform).toHaveBeenCalledTimes(2);
    expect(controller.platform).toEqual(NATIVE);
    expect(host.updates).toBe(1);
  });
});
