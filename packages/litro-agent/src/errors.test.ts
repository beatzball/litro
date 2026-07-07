import { describe, it, expect } from 'vitest';
import { AgentError, errorPayload } from './errors.js';

describe('AgentError', () => {
  it('carries status and serializes without stack in prod mode', () => {
    const err = new AgentError('nope', { status: 409 });
    expect(err.status).toBe(409);
    const payload = errorPayload(err, false);
    expect(payload).toEqual({ name: 'AgentError', message: 'nope', status: 409 });
  });

  it('includes stack only in dev mode and defaults unknown errors to 500', () => {
    const payload = errorPayload(new Error('boom'), true);
    expect(payload.status).toBe(500);
    expect(payload.stack).toBeTruthy();
    expect(errorPayload('weird', false)).toEqual({ name: 'Error', message: 'weird', status: 500 });
  });
});
