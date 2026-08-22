# plan2go

A no-login planner for a multi-day trip. Drop stops on a map, see real distances and
travel times, reorder until the day works, then share a read-only link or a printed
page.

A trip lives at `/t/[slug]`. There are no accounts. The slug identifies the trip and an
edit token in an httpOnly cookie authorises changes to it.

## Running it

```
pnpm install
pnpm dev
```

Node 20.9 or newer, pnpm 9.15.9 (pinned in `packageManager`).

```
pnpm typecheck    # tsc --noEmit
pnpm lint         # eslint, zero warnings tolerated
pnpm test         # vitest run
pnpm build        # next build
```

## The database is not connected yet

**The first migration is pending.** There is no `DATABASE_URL` and that is deliberate.
`prisma/schema.prisma` is written against Postgres and `.env.example` names the two
variables it needs, with no values.

When the hosted Postgres exists, copy `.env.example` to `.env.local`, fill in
`DATABASE_URL` and `DIRECT_URL`, and run the first migration:

```
pnpm exec prisma migrate dev --name init
```

Do not switch the provider to sqlite and do not create a local database to get around
this. Development and production run the same dialect.

`pnpm exec prisma generate` works today without a connection string, which is why the
project typechecks.

## Layout

`src/core` is the time engine and the domain model, pure TypeScript with no framework,
database, or network in it. Everything external is an interface in `src/core/ports`
with an implementation in `src/adapters`. Dependencies point one way, from `app`
through `features` to `server` and `adapters` and down to `core`, and ESLint fails the
build if they do not.

`CLAUDE.md` holds the working rules. `DESIGN.md` holds the visual direction and is the
source of truth for anything under `src/app/t/`, `src/features/`, or `src/ui/`.

## Vendored design skill

`.agents/skills/design-taste-frontend/SKILL.md` came from
[Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) (`skills/taste-skill/SKILL.md`,
sha256 `6d838b246d0e35d0b53f4f23f98ba7a1dd561937e64f7d0c7553b0928e376c3e`). It is
committed rather than tracked as a dependency, and carries a project override at the
top saying that `DESIGN.md` wins inside the app shell. Do not re-sync it from upstream
without reading the diff.
