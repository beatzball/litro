# Stage 1: Build
FROM node:20-slim AS builder

RUN npm install -g pnpm@9

WORKDIR /app
COPY pnpm-workspace.yaml package.json ./
COPY packages/ packages/
COPY docs/ docs/

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @beatzball/litro-router build
RUN pnpm --filter @beatzball/litro build
RUN pnpm --filter @beatzball/litro-docs build

# Stage 2: Serve
FROM nginx:alpine

COPY --from=builder /app/docs/dist/static /usr/share/nginx/html
COPY docs/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
