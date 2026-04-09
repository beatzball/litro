import { defineEventHandler } from 'h3';

export default defineEventHandler(() => ({
  message: 'Hello from the API (Elena)!',
  timestamp: new Date().toISOString(),
}));
