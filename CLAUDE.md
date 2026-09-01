# plan2go

## What this is

plan2go is a no-login planner for a multi-day trip, used by a parent organising a
family holiday in a city they have never visited and cannot judge distances in. They
drop stops on a map, see real travel times, reorder until the day actually works, and
hand the result to the people travelling with them as a read-only link or a printed
page. The hard part of this product is the time engine, everything else is typing.

## Non-negotiables

**Identity.** No authentication. A random slug at `/t/[slug]` identifies a trip. An edit
token in an httpOnly cookie authorises mutations. `Trip.userId` is nullable and stays
that way until accounts exist.

**Stack.** Next.js App Router, TypeScript, Prisma, Tailwind, the Google Maps
JavaScript API, Vitest. Postgres only, never SQLite, deployed to Vercel. Package
manager is pnpm.

**Paid APIs.** Google Places and Google Routes are server side only. Never
`NEXT_PUBLIC_`. Every call goes through our own route handler, is rate limited by IP,
and is cached in our own table keyed by the inputs that determine the answer. Check the
cache before any paid call.

The map is the one exception, and it is a separate key. The Maps JavaScript API
authenticates from the browser, so `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY` is exposed on
purpose and is restricted in the Google Cloud console to that one API and to our own
referrers. It never authorises Places or Routes. `GOOGLE_MAPS_API_KEY` is the server
key, is read only by `src/server/places/google-key.ts`, and never reaches the browser.
Two keys, and the rule above holds for everything the server pays for.

**The time engine.** `src/core` is pure TypeScript. No React, no Next, no Prisma, no
network, no `Date.now()`. Anything external is an interface in `src/core/ports` with an
implementation in `src/adapters`. The haversine travel provider is the working fake;
the Google one arrives later and must not change the engine.

**Dependency direction.** `app` to `features` to `server` and `adapters` to `core`.
`core` imports nothing internal. This is enforced by lint, not by good intentions.

**Sharing.** The share artifact is a read-only web page first and a print stylesheet
second. No PDF library.

**Design.** `DESIGN.md` is the source of truth for anything under `src/app/t/`,
`src/features/`, or `src/ui/`, and it overrides the vendored `design-taste-frontend`
skill there. That skill governs the marketing page and the share view only.

## Conventions

Kebab-case filenames everywhere. Tests colocated beside their source as
`thing.test.ts`, never in a mirrored tree. No barrel `index.ts` files. Do not create a
new top-level folder without asking.

## State of the repo

Postgres is hosted on Neon and the first migration is applied. Credentials live in
`.env`, which the Prisma CLI reads and Next.js reads as well, so one file serves both.
`DATABASE_URL` is the pooled connection and `DIRECT_URL` is the direct one that
migrations need.

Do not create a local database and do not switch the provider to sqlite. Development
and production run the same dialect.

## Commands

```
pnpm dev          # next dev
pnpm build        # next build
pnpm typecheck    # tsc --noEmit
pnpm lint         # eslint, zero warnings tolerated
pnpm test         # vitest run
pnpm test:watch   # vitest
pnpm db:generate  # prisma generate
```

## Definition of done

A change is done when `pnpm typecheck`, `pnpm lint`, and `pnpm test` all pass, new
behaviour in `src/core` has a colocated test, user-facing copy follows the writing
rules, and nothing was added to the top level without being asked for. Not before.

## Anti-slop list

No feature that was not asked for. Propose it instead.

No `TODO`, no stubbed return, no "implementation omitted" comment. If it is not built,
it does not have a file yet.

No `any` and no type assertion used to quiet the compiler. Fix the type.

No empty `catch`, and no `catch` that only logs.

No dependency without one line saying why, asked before it is installed.

Delete replaced code. Do not comment it out.

When a requirement is ambiguous, ask one question. Do not invent an answer.

Durations are integer minutes. No floats, no seconds, no milliseconds in the domain.

Conflicts are returned as data. Never thrown, never silently corrected.

Every word in the product follows `.claude/rules/writing.md`, which is always loaded.
