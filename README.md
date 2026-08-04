# AnimeKaiser

AnimeKaiser is an anime tracking application: a personal library with per-title
status and episode progress, a discovery catalogue built on public anime
metadata, and two-way synchronisation of that library with external tracking
services (AniList and MyAnimeList). Playback sources are resolved by a separate
streaming service, and watch progress is recorded against the library.

**Status:** active development. Self-hosted only — there is no hosted instance
and no public deployment. Interfaces, database schema, and RPC contracts change
without notice, and migrations are not guaranteed to be stable across commits.

## What it does

**Library management.** Each user owns a library of entries keyed by MyAnimeList
ID, carrying watch status, episode count, score, and privacy. Libraries can be
public or private per user, with public profile pages and aggregate stats.

**External list synchronisation.** Users link AniList and/or MyAnimeList
accounts over OAuth. Linking triggers a one-time import that reconciles the
remote list into the local library; afterwards, local mutations are pushed back
to every linked provider. Sync is event-sourced: each outbound change becomes a
`library_sync_event` row processed by a background worker, so failures are
visible, individually retryable, and do not block the write path. OAuth refresh
tokens are rotated by a separate worker.

**Discovery.** Catalogue browse, search, seasonal schedule, and a random-title
endpoint, backed by AniList's GraphQL API and Jikan (the MyAnimeList REST
mirror), with a Redis-backed cache in front of both.

**Streaming.** Source resolution and media proxying live in a separate service
that this repository does not contain. AnimeKaiser talks to it over a typed RPC
contract (`StreamingClient`, wired in `apps/api/src/infra/streaming.ts`) and
stores only the stable anime-to-provider mappings it returns. The service
reports which providers it supports at runtime, so no provider is named here.
Set `STREAMING_SERVICE_URL` and `STREAMING_SECRET` to point at your own
implementation; without them, streaming features report as unavailable and the
rest of the application is unaffected.

The web app has a player, subtitle rendering, and server/audio-track selection.
Watch progress from the player populates watch history and the "continue
watching" row.

## Architecture

Bun workspaces orchestrated by Turborepo. Two applications and six packages.

### Applications

| Path       | Role                                                                                                                                                                        |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api` | Backend. Composes the Effect layer graph: Postgres, Redis, Better Auth, R2 media storage, HTTP routes, the RPC server, and three background workers (library import, library sync, token refresh). Entry point is `src/app.ts`. |
| `apps/web` | TanStack Start browser application. File-based routes in `src/routes`, feature modules in `src/features`, state via `effect-atom`. Talks to the API over the RPC WebSocket.   |

### Packages

| Path               | Role                                                                                                                                    |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/domain`  | Infrastructure-free `effect/Schema` models and `@effect/rpc` contracts. The single shared contract between server and client. `KaiserRpcs` in `src/rpc.ts` merges every RPC group. |
| `packages/db`      | Drizzle schema, migrations, and the `Database` service. Schema is split by concern: `auth`, `profile`, `library`, `external-list-account`, `history`, `streaming`. |
| `packages/core`    | Backend business services — anime metadata, profiles, library import/sync, external-list OAuth, watch history, stream resolution. Depends on `db` and `domain`, never on HTTP composition. |
| `packages/rpc`     | Effect RPC server: handler layers per domain group, plus authentication middleware and request logging. `RpcLive` mounts the group at `/rpc` over WebSocket with NDJSON serialisation. |
| `packages/auth`    | Better Auth server and web client configuration. Auth tables live in `packages/db`.                                                      |
| `packages/ui`      | Shared React components, hooks, and global styles, exported through `components/*` entry points.                                          |

### Request path

The web app calls a typed RPC method defined in `packages/domain`. The request
arrives at `packages/rpc`'s handler layer, which resolves a service from
`packages/core`, which reads or writes through `packages/db`. HTTP concerns
(CORS, auth callbacks) are the only things that live directly in
`apps/api/src/routes`.

Background work is dispatched through Postgres `LISTEN`/`NOTIFY` rather than a
separate queue: `DatabaseListenerLive` in `apps/api/src/infra/database.ts` wakes
the workers.

## Tech stack

- **Runtime / tooling:** Bun 1.3.3, Turborepo, TypeScript 7, Biome
- **Backend:** Effect 3, `@effect/platform` HTTP, `@effect/rpc`, Drizzle ORM, Postgres 17, Redis 8
- **Auth:** Better Auth (email/password, passkeys, OAuth account linking)
- **Frontend:** TanStack Start, React 19, TanStack Router, `effect-atom`, Tailwind
- **External services:** AniList GraphQL, Jikan, Resend (transactional email), Cloudflare R2 (profile media)
- **Testing:** `bun test` for unit tests, Playwright for end-to-end

## Local setup

### Prerequisites

- Bun 1.3.3 or newer
- Node.js 20 or newer
- Docker, or a local Postgres 17 and Redis 8

### Steps

```bash
bun install
cp .env.example .env
```

Start Postgres and Redis. The repository ships a compose file for both:

```bash
bun run --cwd packages/db dev     # docker compose up: postgres:17 + redis:8
```

Apply migrations, then start everything:

```bash
bun run --cwd packages/db db:migrate
bun dev
```

The web app serves on `http://localhost:3000`, the API on `http://localhost:8080`.

### Environment variables

All of these are read in `apps/api/src/env.ts`; everything without a default is
required and the API refuses to start without it. See `.env.example` for the
full template.

| Variable                                    | Notes                                                              |
| ------------------------------------------- | ------------------------------------------------------------------ |
| `DATABASE_URL`, `REDIS_URL`                  | Match the compose file defaults out of the box.                     |
| `PORT`, `ENV`                                | Default to `8080` and `dev`.                                        |
| `APP_URL`, `VITE_API_URL`, `BETTER_AUTH_URL` | Origins for CORS, the client, and auth callbacks.                   |
| `BETTER_AUTH_SECRET`                         | Any high-entropy string. Change it outside development.             |
| `AUTH_COOKIE_DOMAIN`                         | Leave empty on localhost.                                           |
| `MAL_CLIENT_ID` / `MAL_CLIENT_SECRET`        | MyAnimeList OAuth app. Required for MAL sync.                       |
| `ANILIST_CLIENT_ID` / `ANILIST_CLIENT_SECRET`| AniList OAuth app. Required for AniList sync.                       |
| `RESEND_API_KEY`, `AUTH_EMAIL_FROM`          | Verification and password-reset email.                              |
| `R2_*`                                       | S3-compatible bucket for profile media. Any S3-compatible endpoint works. |
| `DISCORD_ALERT_WEBHOOK_URL`                  | Optional. Fatal startup/runtime crashes post here.                  |

## Commands

```bash
bun dev              # All development tasks
bun build            # Build all workspaces
bun typecheck        # Type-check all workspaces
bun lint             # Biome check
bun format           # Biome format --write
bun test             # Unit tests
bun test:e2e         # Playwright end-to-end tests
```

Database:

```bash
bun run --cwd packages/db dev          # Start Postgres + Redis via Docker
bun run --cwd packages/db db:generate  # Generate a migration from schema changes
bun run --cwd packages/db db:migrate   # Apply migrations
bun run --cwd packages/db db:studio    # Drizzle Studio
```

## Tests

Unit tests run under Bun's test runner and need no external services:

```bash
bun test
```

End-to-end tests use Playwright and require a running API, web app, Postgres,
and Redis. Install the browser once, then run:

```bash
bun test:e2e:install
bun test:e2e
```

`KAISER_E2E_PASSWORD` overrides the throwaway account password used by the
onboarding spec.

## Screenshots

<!-- TODO: add screenshots — library view, discovery, sync activity, profile. -->

## License

[GNU Affero General Public License v3.0](./LICENSE).

If you run a modified version of this software as a network service, the AGPL
requires you to make its source available to that service's users.
