---
description: Rules for persistence, route handlers, and the Prisma schema.
paths:
  - "src/server/**"
  - "src/app/api/**"
  - "prisma/**"
---

# Data and API

Keys are server side. No API key, secret, or upstream URL is ever exposed through a
`NEXT_PUBLIC_` variable or shipped to the browser.

Check the cache before any paid call. The cache is our own table, keyed by exactly the
inputs that determine the answer and nothing else. A cache keyed by something the
caller can vary freely is not a cache.

Rate limit every public route handler by IP, from the first commit rather than before
launch.

Zod at every boundary: request bodies, query parameters, upstream responses, and
anything read from a cookie. Types are inferred from the schema with `z.infer`. Never
hand write an interface that runs alongside a schema, because the two drift.

Mutations require a valid edit token. Reads never do. A read path that checks the token
has broken sharing.

No raw SQL. No `$queryRaw`, no `$executeRaw`. If Prisma cannot express it, that is a
schema conversation, not an escape hatch.

Repositories return core model types. Prisma types stop at the repository boundary and
never travel upwards.
