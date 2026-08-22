---
description: Rules for feature components and generic primitives.
paths:
  - "src/features/**"
  - "src/ui/**"
---

# UI

Defer to `DESIGN.md`. It holds the palette, the type scale, the radius system, the two
layouts, the motion policy, the print rules, and the banned list. Where it disagrees
with any general design guidance, including the vendored `design-taste-frontend` skill,
`DESIGN.md` wins.

A component that would be meaningless in another product belongs to a feature, not to
`ui/`. A stop card, a day tab, a conflict notice, and a leg row are features. A button,
a text field, and a visually hidden label are primitives.

`src/ui` may not import from `src/core`. If a primitive needs a domain type to be
useful, it is not a primitive.

Every feature folder owns its own components, hooks, and tests. Features do not import
from each other. Shared behaviour moves down to `ui` or `core`, not sideways.

Server components by default. `"use client"` is added to the smallest component that
genuinely needs interactivity, never to a page or a layout.
