---
name: plan2go
description: Warm cream paper, over-rounded shapes, a terracotta accent with sage as a second voice, and the times louder than anything else on the page.
omitted:
  - spacing
colors:
  paper: "#F5EAD8"
  paper-raised: "#F9F4ED"
  paper-sunken: "#EBDDC5"
  ink: "#201E1D"
  ink-muted: "ink at 68 percent"
  ink-faint: "ink at 55 percent"
  rule: "ink at 13 percent"
  rule-strong: "ink at 28 percent"
  terracotta: "#C67139"
  terracotta-ramp:
    100: "#FFF2EB"
    200: "#FFE1D0"
    300: "#FFC6A5"
    400: "#F6A06B"
    500: "#D67F48"
    600: "#B2622D"
    700: "#8C491A"
    800: "#643312"
    900: "#402310"
  sage: "#7A8A5E"
  sage-ramp:
    100: "#F0FAE1"
    200: "#E1EECC"
    300: "#CCDBB2"
    400: "#AEBF92"
    500: "#8FA073"
    600: "#728157"
    700: "#56633F"
    800: "#3D472B"
    900: "#272E1B"
  neutral-ramp:
    100: "#F9F4ED"
    200: "#EEE7DB"
    300: "#DCD3C4"
    400: "#C0B6A5"
    500: "#A19786"
    600: "#82796A"
    700: "#645C50"
    800: "#474238"
    900: "#2E2B25"
typography:
  title:
    fontFamily: Caprasimo
    fontSize: 24px
    lineHeight: 1.14
  place:
    fontFamily: Caprasimo
    fontSize: 17.5px
    lineHeight: 1.2
  time:
    fontFamily: Caprasimo
    fontSize: 15px
    lineHeight: 1.1
    fontVariantNumeric: tabular-nums
  body:
    fontFamily: Figtree
    fontSize: 14px
    lineHeight: 1.5
    fontWeight: 400
  meta:
    fontFamily: Figtree
    fontSize: 12px
    lineHeight: 1.45
    fontWeight: 400
  micro:
    fontFamily: Figtree
    fontSize: 11.5px
    lineHeight: 1.4
    fontWeight: 400
  label:
    fontFamily: Figtree
    fontSize: 10.5px
    lineHeight: 1
    fontWeight: 600
  tick:
    fontFamily: Figtree
    fontSize: 9.5px
    lineHeight: 1
    fontVariantNumeric: tabular-nums
rounded:
  chip: 14px
  row: 18px
  panel: 20px
  card: 22px
  pill: 999px
shadows:
  sm: "0 1px 3px neutral-900 at 16 percent"
  md: "0 3px 10px neutral-900 at 16 percent"
  lg: "0 12px 32px neutral-900 at 22 percent"
components:
  stop-card:
    backgroundColor: "{colors.paper-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
  stop-number:
    backgroundColor: "{colors.terracotta}"
    textColor: "{colors.paper}"
    rounded: "{rounded.pill}"
  leg-row:
    backgroundColor: transparent
    textColor: "{colors.ink}"
    rounded: "{rounded.row}"
  day-tab-active:
    backgroundColor: "{colors.terracotta-ramp.800}"
    textColor: "{colors.paper}"
    rounded: "{rounded.pill}"
  day-tab-inactive:
    backgroundColor: transparent
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.pill}"
  conflict-block:
    backgroundColor: "{colors.sage-ramp.200}"
    textColor: "{colors.sage-ramp.900}"
    rounded: "{rounded.chip}"
  stop-marker:
    backgroundColor: "{colors.terracotta}"
    textColor: "{colors.paper}"
    rounded: "{rounded.pill}"
  endpoint-marker:
    backgroundColor: "{colors.sage-ramp.600}"
    textColor: "{colors.paper}"
    rounded: "13px 13px 13px 4px"
  map-control:
    backgroundColor: "{colors.paper-raised}"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.pill}"
---

# plan2go design

## Overview

Warm cream paper, over-rounded shapes, a terracotta accent with sage as a second
voice, and the times louder than anything else on the page.

This file is the source of truth for `src/app/t/`, `src/features/`, and `src/ui/`. It
overrides the vendored `design-taste-frontend` skill inside the app shell.

The token values above are mirrored in the `@theme` block of `src/app/globals.css`.
When one changes the other changes in the same commit.

## Colors

There are two accents and they are not interchangeable. Terracotta is the product: the
stop numbers, the active day, the primary action, the route lines. Sage is the second
voice and it carries the ends of a day and anything the plan wants to tell you about
itself, which in this product means a conflict. Everything else is paper and ink.

- **paper:** the page, and the ground the whole product sits on.
- **paper-raised:** stop cards, floating controls, inputs, the search panel.
- **paper-sunken:** wells, the map gutter, a hovered control.
- **rule:** hairlines and card borders, drawn as ink at low opacity so one value works
  over all three surfaces.
- **rule-strong:** the border of a control under the pointer, and dashed outlines.
- **ink, ink-muted, ink-faint:** primary text, secondary text, and placeholders.
- **terracotta:** the accent, with a 100 to 900 ramp. 100 and 200 are tinted fills, the
  base is the accent itself, 600 is hover, 700 is pressed and is the step to use for
  accent coloured text, 800 is the active day tab.
- **sage:** the second accent, with the same ramp. 200 is the conflict block, 600 is
  the marker for the ends of a day, 700 draws the public transport route line.
- **neutral 100 to 900:** the warm greys behind everything, used for the drive tint,
  the waiting band, and the map's own geometry.

Each ramp is generated in OKLCH on one shared lightness scale, so the same step of any
ramp carries the same visual weight. Prefer a ramp step to an ad hoc `color-mix()`.

Never `#FFFFFF`, never `#000000`, on any surface, border, or text.

No dark theme. The ground is warm paper, and paper does not invert. Do not add a
`prefers-color-scheme: dark` block.

No status hues. There is no red, no amber, no green. A conflict is carried by the sage
block plus the sentence naming it, with the real numbers in the sentence.

Contrast floor: `ink` on `paper` is the body pairing. The accent to ground pair is
tuned to 3:1, which is enough for icons, large type and interface chrome and not enough
for paragraphs, so accent coloured text at body size uses `terracotta-700`.

## Typography

Two families, no more. Caprasimo for display, falling back to Georgia, "Times New
Roman", serif. Figtree for body, falling back to "Segoe UI", system-ui, sans-serif.

Caprasimo has one weight and it is already heavy. Headings never ask for bold on top of
it, because a browser with only the one weight will synthesise the rest.

Display carries times, place names, durations and the day heading. Body carries
everything else. Every element that renders a time or a duration sets
`font-variant-numeric: tabular-nums` so numbers stack in a column.

- **title:** the trip name, and the heading of an empty day.
- **place:** a place name, and the time against an anchor row.
- **time:** the arrival time on a stop card.
- **body:** running text.
- **meta:** secondary text, addresses, the words in a leg row.
- **micro:** the second line of a search result, and the sentence in a conflict.
- **label:** the small heading above a value. Sentence case, 600, never uppercase.
- **tick:** the two lines under the name of a day tab, the date and the stop count.

Body text is left aligned. Never centred, except a single line inside an empty state.

## Layout

**Desktop, 1024px and up.** Two panes, map left and list right.

```
grid-template-columns: minmax(0, 1fr) clamp(520px, 40%, 660px);
```

The map fills its pane edge to edge, with no frame of its own. The list pane is a
column the height of the viewport: the trip name and the day tabs are fixed at the top,
and only the day itself scrolls, so what is being read is always named above it.

**Mobile, below 1024px.** One column. The map collapses to a sticky strip 140px tall at
the top of the viewport, with the day tabs stuck directly beneath it. The page is the
scrolling surface.

The strip carries one control, a pill button reading **Expand map**. Expanded, the map
covers the viewport and the same button reads **Collapse map**. Both states show the
word. Neither is an icon on its own.

## Elevation and depth

Three steps, all tuned to the cream ground rather than to a white one.

```
--shadow-sm   a floating control: the search field, the zoom pair, a map marker
--shadow-md   a panel that opens over the page: the search results, the calendar
--shadow-lg   reserved, for a layer over the whole viewport
```

Everything that is not floating separates with `rule` or with a change of surface
between `paper`, `paper-raised`, and `paper-sunken`.

## Shapes

Over-round, and never sharp. `chip` for tinted inline blocks, `row` for the leg row and
the anchor rows, `panel` for a panel that opens over the page, `card` for a stop card,
and `pill` for every button, input, tab, and marker.

Round shapes need air to read as soft, so nothing is crowded and nothing is drawn with
hairline only geometry.

## Components

Token values for each component are in the front matter. The rules the token schema
cannot express are here.

The day runs down a dotted thread on the left, drawn as a repeating gradient rather
than a dotted border, which rounds its dots off at this width. A stop hangs on the
thread behind a numbered terracotta disc. A leg hangs on the same thread with no card
of its own, because it is what happens between two stops rather than a thing in itself.

The start and end of a day are a different shape from a stop, not merely a different
colour: a sage square with one corner cut, against the terracotta discs. A day may
start and end in the same place, in which case there is one marker rather than two on
top of each other.

A conflict is a sage block carrying the sentence that names it, with a clock beside the
words. The tint alone is never the signal.

A stop card carries its own controls and no others. The two that act on the whole
stop, moving it and taking it off the day, sit under the arrival time at the top right,
because they are about the row rather than about anything inside it. They are drawn at
55 percent until the pointer is over the card and never hidden, since half the people
using this have no pointer to hover with. How long the stop lasts is a stepper in a
pill, the opening hours sit beside it in words, and the note is either a field or the
one line offering to start one. Removing is immediate: a stop is a search away from
coming back, and a dialog asking twice would be a modal over something editable in
place.

A leg opens. Closed it is one line, the mode and how long it takes, with **Change** at
the end of it. Open it is a sunken panel of every way of covering the same ground, one
tile each, carrying the mode, the time and the distance, with the one in use outlined
in terracotta and its dot filled. Choosing leaves the panel open, because the outline
moving and the times below changing are the answer and trying a second mode should not
mean opening it again. Collapse is what closes it. While the new times are being worked
out the tiles stay on screen at reduced opacity under a line of text saying what is
happening, which is what this product does instead of a skeleton.

## The map

A line is drawn between each pair of points in travel order, under the markers. The
mode is carried by the stroke pattern as well as by the colour, so colour is never the
only thing distinguishing them:

```
drive      3.4px  solid                terracotta-700
transit    3.4px  dash 11 6            sage-700
walk       4px    dash 0.5 8, round    terracotta-600
cycle      3.4px  dash 6 5             neutral-700
flight     3.4px  dash 16 10           terracotta-800
```

One table in `src/features/trip-map/route-style.ts` holds those five rows, and both the
map and the key read from it, so a line and the sample that explains it cannot drift
apart. Google draws a dash or a dot as a symbol repeated along an invisible line rather
than as a stroke pattern, which is why each row also says what shape it repeats, and a
dash in the key is the length the map actually draws.

Every leg also states its mode in words in the list, so the pattern is a reminder and
not the only source of the fact.

The route key sits in the bottom left and lists all five modes, in the order Google
lists them, whenever the day has a line on it. It is the notation, so it does not
change with the modes this particular day happens to use. The longest dash is flying,
which reads as the longest stride between two points. The markers have no key of their
own, because a numbered disc in the order you visit them and a named marker for the
ends of the day explain themselves.

The map's own geometry is styled onto the warm ramp: cream ground, raised roads, sunken
parks, and water in neutral 300 rather than a blue. Google's controls are off and ours
are drawn over it, so the only things on the map are the day's lines and markers, the
search in the top left corner, the zoom pair in the bottom right, and the route key in
the bottom left.

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
neutral 400, and text stays `ink`. Times keep the display face and stay the loudest
thing on the page.

A footer on every page carries the trip title and the date of the day. The share link
is printed once, in the footer of the first page.

## Banned in this product

Skeleton shimmer. While travel times are resolving, show the last known value, or a
single line of text saying what is being worked out.

Toasts for anything already visible on screen.

An icon standing in for a word. An icon only control is allowed where its meaning is
conventional, which in this product means close, clear, and zoom, and it carries an
accessible name. Nothing this product actually knows about, a mode of travel, a day, a
conflict, is ever an icon alone.

Pure white or pure black, anywhere.

A third accent, or red, amber, and green used as status.

Decorative gradients, glassmorphism, backdrop blur, mesh backgrounds. The dotted thread
is a rule drawn as a gradient, which is the only gradient in the product.

Shadows on anything that is not floating over something else.

Numbers that count up or animate into place. Times appear at their value.

Anything that only appears on hover, since half the users are on a phone.

Emoji used as interface iconography.

Full width hero imagery inside the app shell.

A modal for anything that could be edited in place.

Placeholder text standing in for a label. A field whose label would crowd the shape it
lives in, the search pill on the map, carries a visually hidden label and repeats it in
the placeholder.

Card grids of three equal boxes.

A third type family.
