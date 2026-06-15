# Kaiser Agent Guide

## Architecture

- `packages/domain` owns domain types and API contracts. Keep it free of infrastructure dependencies.
- `packages/db` owns Postgres and Drizzle schema, including auth tables, anime details, user library entries, jobs, conflicts, and streaming provider mappings.
- `packages/auth` owns Better Auth server configuration and typed client helpers. Auth tables still belong in `packages/db`.
- `packages/core` owns service contracts and implementations. Export runtime-specific implementations from explicit subpaths such as `@workspace/core/server` and `@workspace/core/native`.
- `apps/api` is the server composition root. Wire environment, DB, auth, Redis cache, HTTP handlers, and in-process job workers here.

## Domain Rules

- Anime identity is always MAL-backed. Do not introduce separate local anime IDs.
- Discovery data may come from MAL, Jikan, AniList, or other sources, but records without a MAL ID must not enter the domain surface.
- User library writes update Kaiser locally first, then enqueue outbound sync jobs for linked external providers.
- Library conflicts are user-resolved. Do not silently overwrite local edits with external list values.
- Streaming resolution persists only stable anime-to-provider title mappings. Do not persist playable stream data.

## Implementation Rules

- Keep Redis out of `packages/db`. Define cache needs in `core` and wire the `ioredis` implementation in `apps/api`.
- Use Postgres as the durable job queue. The API process may run the worker loop initially.
- Keep client-safe imports clean: desktop/mobile code should not import DB, Redis, Better Auth server config, or server-only SDKs through root `core` exports.
- Prefer existing Effect service/layer patterns in the repo when adding services.
- Update `CONTEXT.md` when domain language is resolved. Keep it a glossary only, not an implementation spec.
- Before marking implementation work done, verify from the repository root with `bun typecheck` and `bun lint`. Do not run these checks from package directories.
