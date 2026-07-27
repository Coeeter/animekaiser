# AnimeKaiser

AnimeKaiser is an anime discovery, library, synchronization, and streaming application. It is a Bun and Turborepo monorepo built with TanStack Start, React, Effect, Drizzle, and Better Auth.

## Workspace

- `apps/web` - Browser application for discovery, profiles, libraries, and watching.
- `apps/api` - API server, authentication composition, HTTP routes, and workers.
- `packages/domain` - Shared domain models and RPC contracts.
- `packages/db` - PostgreSQL schema, database access, and migrations.
- `packages/auth` - Better Auth server and web client configuration.
- `packages/core` - Backend application services and integrations.
- `packages/rpc` - Effect RPC server definitions and handlers.
- `packages/ui` - Shared React UI components and styles.

See each workspace README for package-specific details.

## Requirements

- Bun 1.3.3 or newer
- Node.js 20 or newer
- PostgreSQL
- Redis for the API's key-value and cache integrations

## Getting started

```bash
bun install
cp .env.example .env
bun dev
```

The web app runs on port 3000. The API runs from `apps/api` and uses the environment variables documented in `.env.example`.

## Commands

```bash
bun dev              # Start all development tasks
bun build            # Build all workspaces
bun typecheck        # Type-check all workspaces
bun lint             # Check formatting and lint rules
bun test             # Run unit and integration tests
bun test:e2e         # Run Playwright end-to-end tests
bun format           # Format the repository
```

Database commands are available in `packages/db`:

```bash
bun run --cwd packages/db dev
bun run --cwd packages/db db:generate
bun run --cwd packages/db db:migrate
bun run --cwd packages/db db:studio
```

## Architecture

The API composes infrastructure adapters in `apps/api`, while business behavior lives in `packages/core`. `packages/domain` contains the shared contracts consumed by both server and client. Persistent data is owned by `packages/db`; external library providers and streaming sources are integrated through core services.
