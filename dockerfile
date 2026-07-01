FROM oven/bun:alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat
RUN bun install -g turbo

FROM base AS pruner
WORKDIR /app
COPY . .
RUN turbo prune @workspace/api --docker

FROM base AS dev-dependencies
WORKDIR /app
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/bun.lock ./bun.lock
RUN bun install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=dev-dependencies /app /app
COPY --from=pruner /app/out/full/ .
RUN turbo run build --filter=@workspace/api

FROM oven/bun:alpine AS runner
WORKDIR /app

COPY --from=builder /app/apps/api/dist ./dist

EXPOSE 8080

CMD ["bun", "./dist/index.js"]
