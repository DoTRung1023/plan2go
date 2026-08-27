<div align="center">
  <img src="logo/logo+text.png" alt="plan2go" width="360">
</div>

> A no-login planner for a multi-day trip. Add places, see how far apart they really are, and see how long a day actually takes.

A trip lives at `/t/[slug]`. The slug is the whole read capability, so anyone with the
link can see the trip. An edit token in an httpOnly cookie authorises changes.

## Features

- **Times a whole day.** Arrival and departure per stop, waiting, travel, and totals, in
  whole minutes.
- **Names conflicts in sentences**, with the numbers in them: "Fish Market closes at
  4:00 pm and you arrive at 4:30 pm". Never "Timing issue detected".
- **Gets time zones right.** Midnight rollover and daylight saving in the trip's own
  zone, not the browser's.
- **Days start and end where you choose**, and the two need not be the same place.
  Neither is required.
- **Pays for a place once.** Google Places results are stored in our own tables, so a
  saved trip renders without touching a paid API again.
- **No accounts.** A slug in the URL, an edit token in a cookie.

Not built yet: real routing, so travel times are straight line estimates. The share and
print pages. Reordering or removing stops. Changing stay length. Route lines on the map,
and dropping a pin to add a stop.

## Getting started

Node 20.9 or newer, pnpm 9.15.9, a Neon Postgres database, and a Google Maps Platform
key with Places API (New) enabled.

```bash
pnpm install
cp .env.example .env    # then fill in the three values below
pnpm exec prisma migrate deploy
pnpm dev
```

### Environment

| Variable | |
| --- | --- |
| `DATABASE_URL` | Pooled Postgres, the `-pooler` host, with `pgbouncer=true` |
| `DIRECT_URL` | Same host, no pooler, no `pgbouncer` |
| `GOOGLE_MAPS_API_KEY` | Places API (New) enabled. Server side only, never `NEXT_PUBLIC_` |

> [!NOTE]
> The file is `.env`, not `.env.local`, because the Prisma CLI reads only `.env`.
> Next.js reads both, so one file serves the app and the migrations.

The app runs without the Google key. Place search answers 503 and says so.

### Database

Postgres on Neon. Migrations are committed, so a fresh checkout applies them with
`prisma migrate deploy`. `DIRECT_URL` exists because migrations run DDL a pooler cannot
carry. Postgres in development too, never sqlite.

> [!WARNING]
> `pnpm db:migrate` authors a new migration from a changed schema and resets a database
> it finds out of step. Never point it at production.

## Scripts

```bash
pnpm dev          # next dev
pnpm build        # next build
pnpm typecheck    # tsc --noEmit
pnpm lint         # eslint, zero warnings
pnpm test         # vitest run
pnpm db:generate  # prisma generate
```

## Deploying

Vercel, from `main`.

> [!IMPORTANT]
> Set all three variables for Production and Preview. The build succeeds without them,
> because nothing touches Postgres at build time, and then every trip page fails at
> request time. Variables are baked into a deployment, so redeploy after changing one.

The build does not run migrations. Apply them to production before shipping a schema
change.

## Architecture

```
src/core       time engine and domain model, pure TypeScript
src/core/ports interfaces for anything external
src/adapters   implementations: haversine travel, Google Places
src/server     storage, ownership, rate limiting
src/features   interface, one folder per feature
src/app        routes, which compose the features
```

Dependencies point one way, `app` to `features` to `server` and `adapters` to `core`,
and ESLint fails the build otherwise. `src/core` has no framework, database or network
in it. `src/server` returns core types, so no Prisma type travels above it. Features do
not import each other. Tests sit beside their source as `thing.test.ts`.

`CLAUDE.md` holds the working rules. `DESIGN.md` is the source of truth for
`src/app/t/`, `src/features/` and `src/ui/`.
