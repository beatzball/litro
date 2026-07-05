import { describe, it, expect } from 'vitest';
import { defineAction, runAction, ACTION_CONFIG } from '../define.js';
import { LitroActionError } from '../error.js';
import type { StandardSchemaV1 } from '../standard-schema.js';

// Minimal hand-rolled Standard Schema validator — keeps the framework zod-free.
const textSchema: StandardSchemaV1<unknown, { text: string }> = {
  '~standard': {
    version: 1,
    vendor: 'litro-test',
    validate(value: unknown) {
      if (typeof value === 'object' && value !== null && typeof (value as { text?: unknown }).text === 'string') {
        return { value: value as { text: string } };
      }
      return { issues: [{ message: 'expected { text: string }' }] };
    },
  },
};

describe('defineAction', () => {
  it('returns a callable that runs validation then the handler', async () => {
    const upper = defineAction({
      input: textSchema,
      async handler({ text }) {
        return text.toUpperCase();
      },
    });
    await expect(upper({ text: 'hi' })).resolves.toBe('HI');
  });

  it('attaches the config under ACTION_CONFIG so the HTTP handler can detect it', () => {
    const a = defineAction({ async handler() { return 1; } });
    expect((a as unknown as Record<symbol, unknown>)[ACTION_CONFIG]).toBeDefined();
  });

  it('rejects invalid input with a 400 LitroActionError carrying issues', async () => {
    const upper = defineAction({
      input: textSchema,
      async handler({ text }) {
        return text.toUpperCase();
      },
    });
    const err = await upper({ text: 42 } as never).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(LitroActionError);
    expect((err as LitroActionError).status).toBe(400);
    expect((err as LitroActionError).issues).toEqual([{ message: 'expected { text: string }' }]);
  });

  it('runs without validation when no input schema is given', async () => {
    const echo = defineAction({ async handler(input: unknown) { return input; } });
    await expect(echo({ raw: true })).resolves.toEqual({ raw: true });
  });
});

describe('runAction', () => {
  it('passes the provided ctx.event through to the handler', async () => {
    const fakeEvent = { path: '/x' } as never;
    const config = {
      async handler(_input: unknown, ctx: { event: unknown }) {
        return ctx.event;
      },
    };
    await expect(runAction(config, null, { event: fakeEvent })).resolves.toBe(fakeEvent);
  });
});

describe('LitroActionError', () => {
  it('defaults to status 500 and carries name/status/issues', () => {
    const e = new LitroActionError('boom');
    expect(e.name).toBe('LitroActionError');
    expect(e.status).toBe(500);
    expect(new LitroActionError('x', { status: 403 }).status).toBe(403);
  });
});
