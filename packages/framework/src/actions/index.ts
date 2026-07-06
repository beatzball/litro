/**
 * @beatzball/litro/actions — server-leaning action surface.
 * Import defineAction here inside .server.ts modules. Client code never
 * imports this module directly (stubs import ./client instead).
 */
export { defineAction, runAction, ACTION_CONFIG } from './define.js';
export type { ActionConfig, ActionContext, ActionFunction } from './define.js';
export { LitroActionError } from './error.js';
export type { ActionErrorPayload } from './error.js';
export type { StandardSchemaV1 } from './standard-schema.js';
export { actionUrl, ACTION_ID } from './client.js';
