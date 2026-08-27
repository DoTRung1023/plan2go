---
name: plan2go
description: A printed travel guide, not a dashboard. Warm paper under warm ink, one accent, and the times louder than anything else on the page.
omitted:
  - spacing
colors:
  paper: "#F7F2E8"
  paper-raised: "#FDFAF3"
  paper-sunken: "#EDE6D8"
  rule: "#D9CFBB"
  rule-strong: "#C4B79C"
  ink: "#23201B"
  ink-muted: "#5C554A"
  ink-faint: "#8A8173"
  terracotta: "#B4552F"
  terracotta-deep: "#8E4225"
  terracotta-wash: "#F0DDD2"
  olive: "#4A5233"
typography:
  time-lead:
    fontFamily: Bitter
    fontSize: 32px
    lineHeight: 36px
    fontWeight: 600
    fontVariantNumeric: tabular-nums
  time:
    fontFamily: Bitter
    fontSize: 20px
    lineHeight: 24px
    fontWeight: 600
    fontVariantNumeric: tabular-nums
  place:
    fontFamily: Bitter
    fontSize: 18px
    lineHeight: 24px
    fontWeight: 600
  body:
    fontFamily: Source Sans 3
    fontSize: 16px
    lineHeight: 24px
    fontWeight: 400
  meta:
    fontFamily: Source Sans 3
    fontSize: 14px
    lineHeight: 20px
    fontWeight: 400
  label:
    fontFamily: Source Sans 3
    fontSize: 12px
    lineHeight: 16px
    fontWeight: 600
    letterSpacing: 0.08em
    textTransform: uppercase
rounded:
  card: 6px
  panel: 10px
  pill: 999px
components:
  stop-card:
    backgroundColor: "{colors.paper-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
  day-tab-active:
    backgroundColor: "{colors.paper-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
  day-tab-inactive:
    backgroundColor: "{colors.paper-sunken}"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.card}"
  conflict-block:
    backgroundColor: "{colors.terracotta-wash}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
  stop-marker:
    backgroundColor: "{colors.paper-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
  home-base-marker:
    backgroundColor: "{colors.olive}"
    textColor: "{colors.paper}"
  map-control:
    backgroundColor: "{colors.paper-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
---

# plan2go design

## Overview

A printed travel guide, not a dashboard. Warm paper under warm ink, one accent, and
the times louder than anything else on the page.

This file is the source of truth for `src/app/t/`, `src/features/`, and `src/ui/`. It
overrides the vendored `design-taste-frontend` skill inside the app shell.

The token values above are mirrored in the `@theme` block of `src/app/globals.css`.
When one changes the other changes in the same commit.

## Colors

There is one accent. Terracotta. Olive appears in exactly one place, the home base
marker. Everything else is paper and ink.

- **paper:** page surface.
- **paper-raised:** stop cards, tab strip, floating map controls.
- **paper-sunken:** wells, the map gutter, the inactive tab strip.
- **rule:** hairlines, card borders.
- **rule-strong:** the rule under an active tab, table dividers.
- **ink:** primary text, times, place names.
- **ink-muted:** travel legs, durations, secondary text.
- **ink-faint:** labels, units, the "min" after a number.
- **terracotta:** the accent. Active tab, selected stop, route lines, the rule beside
  a conflict, primary action.
- **terracotta-deep:** hover and active states of the accent.
- **terracotta-wash:** selected row background, conflict block background.
- **olive:** the home base marker and its label. Nothing else.

Never `#FFFFFF`, never `#000000`, on any surface, border, or text.

No dark theme. The surface is paper, and paper does not invert. Do not add a
`prefers-color-scheme: dark` block.

No status hues. There is no red, no amber, no green. A conflict is carried by a
terracotta left rule plus the sentence naming it, never by colour alone.

Contrast floor: `ink` on `paper` is the body pairing. `ink-faint` is only for text at
12px or larger that repeats information available elsewhere.

## Typography

Two families, no more. Bitter for display, falling back to Georgia, "Times New Roman",
serif. Source Sans 3 for body, falling back to "Segoe UI", system-ui, sans-serif.

Display slab carries times, place names, and the day date. Body sans carries
everything else. Every element that renders a time or a duration sets
`font-variant-numeric: tabular-nums` so numbers stack in a column.

- **time-lead:** arrival time on a stop card.
- **time:** departure, leg durations, totals.
- **place:** place name.
- **body:** running text.
- **meta:** secondary text, set in `ink-muted`.
- **label:** set in `ink-faint`.

Inside a stop card the arrival time is the largest element and the place name is one
step smaller. If a design puts the place name above the time in size or weight, it is
wrong.

Body text is left aligned. Never centred, except a single line inside an empty state.

## Layout

**Desktop, 1024px and up.** Two panes. Map left, list right.

```
grid-template-columns: minmax(420px, 1fr) minmax(400px, 480px);
```

The map pane is sticky and fills the viewport height. The list pane scrolls on its own.
Day tabs sit at the top of the list pane and stay stuck while the list scrolls.

**Mobile, below 1024px.** One column. The map collapses to a sticky strip 140px tall at
the top of the viewport, with the day tabs stuck directly beneath it. The list is the
scrolling surface underneath.

The strip carries one control, a pill button reading **Expand map**. Expanded, the map
covers the viewport and the same button reads **Collapse map**. Both states show the
word. Neither is an icon on its own.

## Elevation & Depth

No shadows. The one exception is a control floating over the map:

```
--shadow-map-control  0 1px 3px rgba(35, 32, 27, 0.18)
```

Everything else separates with `rule` or with a change of surface between `paper`,
`paper-raised`, and `paper-sunken`.

## Shapes

One radius system, three stops, nothing else. `card` for cards, tabs, inputs, buttons,
and the conflict block. `panel` for the map pane and the mobile map sheet. `pill` for
map markers and the map expand toggle only.

## Components

Token values for each component are in the front matter. The rules the token schema
cannot express are here.

The home base marker is a different shape from the stop markers, not merely a different
colour. Stop markers carry a 2px `terracotta` ring and the stop number in `ink`.

A conflict block is identified by a terracotta left rule plus the sentence naming the
conflict. The wash background alone is never the signal.

## The map

Route lines are all `terracotta`. The transport mode is carried by the stroke pattern,
so that colour is never the only thing distinguishing them:

```
walk      2px   dash 1 6     round caps
cycle     2px   dash 4 4
drive     3px   solid
transit   3px   dash 12 6
```

Every leg also states its mode in words in the list, so the pattern is a reminder and
not the only source of the fact.

## Motion

Nothing animates except reordering a stop.

Reordering: `transform` over 160ms `ease-out` on the card being moved and on the cards
displacing around it. Nothing else, no opacity, no scale.

No transitions on hover, focus, tab switching, panel opening, or map interaction. Those
changes are instant.

Focus is a 2px `terracotta` ring at 2px offset, visible immediately, on every
interactive element.

Under `prefers-reduced-motion: reduce`, reordering is instant too.

## Print

The printed page is a first class target, not a fallback.

One column, full width. No map, no tabs, no controls, no navigation.

```
@page { margin: 16mm; }
```

Every stop card sets `break-inside: avoid`. Every day after the first sets
`break-before: page`.

Surfaces print as unpainted paper. Backgrounds are removed, hairlines drop to 0.5pt in
`rule-strong`, and text stays `ink`. Times keep the display slab and stay the loudest
thing on the page.

A footer on every page carries the trip title and the date of the day. The share link
is printed once, in the footer of the first page.

## Banned in this product

Skeleton shimmer. While travel times are resolving, show the last known value, or a
single line of text saying what is being worked out.

Toasts for anything already visible on screen.

Icons without a text label.

Pure white or pure black, anywhere.

A second accent hue, or red, amber, and green used as status.

Gradients, glassmorphism, backdrop blur, mesh backgrounds.

Shadows outside the one floating map control token.

Numbers that count up or animate into place. Times appear at their value.

Anything that only appears on hover, since half the users are on a phone.

Emoji used as interface iconography.

Full width hero imagery inside the app shell.

A modal for anything that could be edited in place.

Placeholder text standing in for a label.

Card grids of three equal boxes.

A third type family.
