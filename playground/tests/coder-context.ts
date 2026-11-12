import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';
import { createEvent } from 'h3';
import { coderAccess, issueCoderSession, type CoderIdentity } from '../server/coder-auth.js';

export const testToken = 'coder-test-secret-123456789';
export function authenticatedContext(transport: 'chat' | 'mcp' = 'chat') {
  const req = new IncomingMessage(new Socket());
  req.headers = { authorization: `Bearer ${process.env.CODER_ACCESS_TOKEN ?? testToken}`, host: 'localhost' };
  req.url = '/';
  const event = createEvent(req, new ServerResponse(req));
  const { sessionId } = issueCoderSession(event);
  if (transport === 'chat') event.context.params = { session: sessionId };
  coderAccess(event);
  return { event, session: { id: transport === 'chat' ? sessionId : 'mcp', seq: 1 } };
}
export function identity(session = 'session', principal = 'alice', transport: 'chat' | 'mcp' = 'chat'): CoderIdentity {
  return { principal, agent: 'coder', session, transport };
}
