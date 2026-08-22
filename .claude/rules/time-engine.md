---
description: Rules for the pure time engine and everything else under src/core.
paths:
  - "src/core/**"
---

# Time engine

Pure functions only. No React, no Next, no Prisma, no network, no file system, no
environment variables. Anything external is an interface in `src/core/ports`, passed in
as an argument.

Durations are integer minutes. No floats on durations, no seconds, no milliseconds.
Providers round before they return, so the engine never has to.

No `Date.now()` and no `new Date()` reading the clock inside the engine. The current
time is injected by the caller. A function whose answer depends on when it ran cannot
be tested.

`computeDay` is total. It returns a result for every input, including an empty day, an
unresolvable leg, and a stop that opens after you arrive. It never throws for a
plausible plan, and it never returns undefined for a case nobody thought about.

Conflicts are returned as data on the result. Never thrown, never logged, never
silently clamped into a plan that looks fine. If the arithmetic produces an impossible
day, the impossible day is the answer, with the conflict attached.

## Tests required

Every change to the engine keeps these passing, colocated as `*.test.ts`:

- midnight rollover, where a day ends after 24:00 local
- daylight saving in the trip time zone, both the day that loses an hour and the day
  that gains one
- a stop with a zero minute stay
- an unresolvable leg, where the provider could not answer
