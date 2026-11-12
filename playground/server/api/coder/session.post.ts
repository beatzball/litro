import { createError, defineEventHandler, getRequestHeader, getRequestURL, setResponseHeader } from 'h3';
import { AgentError } from '@beatzball/litro-agent';
import { issueCoderSession } from '../../coder-auth.js';

export default defineEventHandler((event) => {
  const origin = getRequestHeader(event, 'origin');
  if (getRequestHeader(event, 'x-litro-agent') !== '1' ||
      getRequestHeader(event, 'sec-fetch-site') === 'cross-site' ||
      (origin && origin !== getRequestURL(event).origin)) {
    throw new AgentError('Sign in from the coder page on this server.', { status: 403 });
  }
  setResponseHeader(event, 'cache-control', 'no-store');
  try { return issueCoderSession(event); }
  catch (error) {
    if (error instanceof AgentError) throw createError({ statusCode: error.status, statusMessage: error.message });
    throw error;
  }
});
