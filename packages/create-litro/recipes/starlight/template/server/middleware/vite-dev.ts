import { defineEventHandler, fromNodeMiddleware } from 'h3';

let viteHandlerPromise: Promise<ReturnType<typeof fromNodeMiddleware>> | null = null;

export default defineEventHandler(async (event) => {
  if (!process.dev || !process.env.NITRO_DEV_WORKER_ID) return;

  if (!viteHandlerPromise) {
    const httpServer = (event.node.req.socket as import('node:net').Socket & {
      server?: import('node:http').Server;
    }).server;

    viteHandlerPromise = import('vite')
      .then(({ createServer }) =>
        createServer({
          server: {
            middlewareMode: true,
            hmr: httpServer ? { server: httpServer } : true,
          },
          appType: 'custom',
          root: process.cwd(),
        }),
      )
      .then((server) => fromNodeMiddleware(server.middlewares));
  }

  const viteHandler = await viteHandlerPromise;
  return viteHandler(event);
});
