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
[Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill), file
`skills/taste-skill/SKILL.md`, at commit `3c7017d636c3a4aad378433ea6d0cfa6c921da4a`.
It is committed rather than tracked as a dependency, so a change upstream cannot
silently alter what the agent does.

| | sha256 | bytes |
| --- | --- | --- |
| Upstream at that commit | `aa194351b246b8b4799099d4ed7b033d29eab6e6e3d58d8d2172978be7b3ec89` | 87,253 |
| The file in this repo | `30987722d8fa1dd28daa9a1cec4ec172bb17ca9e268bda7835c1ac6b5cd4a580` | 87,658 |

The two differ by one addition and nothing else: an eight line project override after
the frontmatter, saying that `DESIGN.md` is dominant for anything under `src/app/t/`,
`src/features/`, or `src/ui/`, and that the skill governs the marketing page and the
share view only. Verified against upstream on 2026-08-27, when `main` still pointed at
the same bytes as the pinned commit.

To check the committed copy has not drifted:

```
shasum -a 256 .agents/skills/design-taste-frontend/SKILL.md
```

To re-sync, download the upstream file, re-apply the override block, and read the diff
before accepting it. These are standing instructions to an agent, not a library.
