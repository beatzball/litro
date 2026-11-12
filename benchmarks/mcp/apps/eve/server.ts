if (process.argv[2] !== 'http') {
  throw new Error('Eve supports the HTTP benchmark only. Usage: node dist/server.mjs http');
}
process.env.HOST = '127.0.0.1';
process.env.NITRO_HOST = '127.0.0.1';
process.env.PORT ??= '3000';
process.env.NITRO_PORT = process.env.PORT;
process.env.EVE_SCHEDULES_DISABLED = '1';
await import(new URL('../.output/server/index.mjs', import.meta.url).href);
