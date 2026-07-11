import { describe, it, expect } from 'vitest';
import { scriptedProvider } from './scripted.js';
import type { ProviderEvent, ProviderRequest } from './types.js';

function req(overrides: Partial<ProviderRequest> = {}): ProviderRequest {
  return { system: 'sys', messages: [{ role: 'user', content: 'hi' }], tools: [], ...overrides };
}

describe('scriptedProvider', () => {
  it('streams the events the script returns, in order', async () => {
    const provider = scriptedProvider(() => [{ type: 'text-delta', text: 'hello' }, { type: 'done' }]);
    const events: ProviderEvent[] = [];
    for await (const e of provider.stream(req())) events.push(e);
    expect(events).toEqual([{ type: 'text-delta', text: 'hello' }, { type: 'done' }]);
  });

  it('increments turn (1-based) across successive stream() calls', async () => {
    const turns: number[] = [];
    const provider = scriptedProvider((_req, turn) => {
      turns.push(turn);
      return [{ type: 'done' }];
    });
    for await (const _e of provider.stream(req())) void _e;
    for await (const _e of provider.stream(req())) void _e;
    for await (const _e of provider.stream(req())) void _e;
    expect(turns).toEqual([1, 2, 3]);
  });

  it('passes the request through to the script', async () => {
    let seen: ProviderRequest | undefined;
    const provider = scriptedProvider((r) => {
      seen = r;
      return [{ type: 'done' }];
    });
    const request = req({ messages: [{ role: 'user', content: 'what is the weather' }] });
    for await (const _e of provider.stream(request)) void _e;
    expect(seen?.messages).toEqual(request.messages);
  });

  it('awaits a delay pseudo-event between events without ever yielding it', async () => {
    const provider = scriptedProvider(() => [
      { type: 'text-delta', text: 'before' },
      { type: 'delay', ms: 30 },
      { type: 'text-delta', text: 'after' },
      { type: 'done' },
    ]);
    const events: ProviderEvent[] = [];
    const timestamps: number[] = [];
    const start = Date.now();
    for await (const e of provider.stream(req())) {
      events.push(e);
      timestamps.push(Date.now() - start);
    }
    expect(events).toEqual([
      { type: 'text-delta', text: 'before' },
      { type: 'text-delta', text: 'after' },
      { type: 'done' },
    ]);
    // 'after' must land at least ~30ms after 'before' due to the delay.
    expect(timestamps[1] - timestamps[0]).toBeGreaterThanOrEqual(25);
  });

  it('propagates script errors', async () => {
    const provider = scriptedProvider(() => {
      throw new Error('script boom');
    });
    await expect(async () => {
      for await (const _e of provider.stream(req())) void _e;
    }).rejects.toThrow('script boom');
  });
});
