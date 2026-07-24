FROM oven/bun:slim AS base
WORKDIR /app

FROM base AS pruner
RUN bun install -g turbo
COPY . .
RUN turbo prune @workspace/api --docker

FROM base AS deps
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/bun.lock ./bun.lock
RUN bun install --frozen-lockfile --ignore-scripts

FROM deps AS build
COPY --from=pruner /app/out/full/ .
RUN bun run --cwd apps/api build


FROM base AS prod-deps
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/bun.lock ./bun.lock
RUN bun install --production --frozen-lockfile --ignore-scripts --linker=hoisted

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=prod-deps /app/ /app/
COPY --from=build /app/apps/api/dist /app/apps/api/dist
COPY --from=build /app/packages/db/ /app/packages/db/
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

EXPOSE 8080
WORKDIR /app/apps/api
ENTRYPOINT ["/app/entrypoint.sh"]
