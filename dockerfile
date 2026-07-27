FROM oven/bun:slim AS base
WORKDIR /app

FROM base AS pruner
RUN bun install -g turbo
COPY . .
RUN turbo prune @animekaiser/api --docker

FROM base AS deps
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/bun.lock ./bun.lock
RUN bun install --frozen-lockfile --ignore-scripts

FROM deps AS build
COPY --from=pruner /app/out/full/ .
RUN bun run --cwd apps/api build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app/apps/api/dist /app/apps/api/dist
COPY --from=build /app/packages/db/drizzle /app/packages/db/drizzle

EXPOSE 8080
WORKDIR /app/apps/api
CMD ["bun", "./dist/index.js"]
