import { defineEventHandler } from 'h3';

export default defineEventHandler(() => ({
  message: 'Hello from the API (FAST)!',
  timestamp: new Date().toISOString(),
}));
