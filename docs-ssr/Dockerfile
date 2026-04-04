# Stage 1: Build
FROM node:20-slim AS builder

RUN npm install -g pnpm@9

WORKDIR /app

# Copy lockfile and root configs
COPY pnpm-lock.yaml package.json tsconfig.json ./

# Trimmed workspace — only the packages needed for docs-ssr build.
# Avoids copying playground/benchmark dirs that aren't required.
RUN printf 'packages:\n  - "packages/*"\n  - "docs"\n  - "docs-ssr"\n' > pnpm-workspace.yaml

COPY packages/ packages/
# docs/ workspace package.json needed for pnpm install; public/ for shared static assets
COPY docs/package.json docs/package.json
COPY docs/public/ docs/public/
COPY docs-ssr/ docs-ssr/

RUN pnpm install --frozen-lockfile

# Create stub tsconfig.json for referenced workspaces not present in this build.
# Root tsconfig.json has "references" to playground etc.; esbuild walks these
# and fails if the file is missing.
RUN mkdir -p playground && echo '{}' > playground/tsconfig.json

RUN pnpm --filter @beatzball/litro-router build
RUN pnpm --filter @beatzball/litro build
# Re-link bins now that framework dist/cli/ exists (pnpm warned during install)
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @beatzball/litro-docs-ssr build

# Stage 2: Runtime
FROM node:20-slim

WORKDIR /app
COPY --from=builder /app/docs-ssr/dist/ dist/

ENV PORT=3000
EXPOSE 3000

CMD ["node", "dist/server/server/index.mjs"]
