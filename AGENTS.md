# AnimeKaiser Agent Guide

## Architecture

- `packages/domain` owns domain types and API contracts. Keep it free of infrastructure dependencies.
- `packages/db` owns Postgres and Drizzle schema, including auth tables, anime details, user library entries, jobs, conflicts, and streaming provider mappings.
- `packages/auth` owns Better Auth server configuration and typed client helpers. Auth tables still belong in `packages/db`.
- `packages/core` owns backend business services, grouped by feature at the package root.
- `apps/api` is the server composition root. Keep external adapters in `infra`, HTTP endpoints in `routes`, and background processes in `workers`.

## Domain Rules

- Anime identity is always MAL-backed. Do not introduce separate local anime IDs.
- Discovery data may come from MAL, Jikan, AniList, or other sources, but records without a MAL ID must not enter the domain surface.
- User library writes update AnimeKaiser locally first, then enqueue outbound sync jobs for linked external providers.
- Library imports overwrite matching local entries, preserve local-only entries, and never enqueue outbound sync.
- Streaming resolution persists only stable anime-to-provider title mappings. Do not persist playable stream data.

## Implementation Rules

- Keep Redis out of `packages/db`. Define storage behavior in `core` and wire the shared `ioredis` key-value adapter in `apps/api`.
- Use Postgres as the durable job queue. The API process may run the worker loop initially.
- Client applications must not import `core`; shared client contracts belong in `domain` and `rpc/client`.
- Prefer `Effect.Service` when a service and its sole implementation live together. Use `Context.Tag` for seams implemented by another package.
- Prefer existing Effect service/layer patterns in the repo when adding services.
- Generate and commit migration SQL manually. The API applies pending migrations on startup.
- Update `CONTEXT.md` when domain language is resolved. Keep it a glossary only, not an implementation spec.
- Never fix formatting or auto-fixable lint issues manually. Run `bun format`, then `bun lint:fix`, and use `bun lint:fix --unsafe` when the unsafe fixes are appropriate and reviewed.
- Before marking implementation work done, verify from the repository root with `bun typecheck` and `bun lint`. Do not run these checks from package directories.
