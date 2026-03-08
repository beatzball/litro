import { defineEventHandler } from 'h3';

export default defineEventHandler(() => ({
  message: 'Hello from {{projectName}}!',
  timestamp: new Date().toISOString(),
}));
