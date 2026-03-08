import { defineEventHandler } from 'h3';

export default defineEventHandler(() => ({
  message: 'Hello from playground-11ty!',
  timestamp: new Date().toISOString(),
}));
