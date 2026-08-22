# plan2go design

A printed travel guide, not a dashboard. Warm paper under warm ink, one accent, and
the times louder than anything else on the page.

This file is the source of truth for `src/app/t/`, `src/features/`, and `src/ui/`. It
overrides the vendored `design-taste-frontend` skill inside the app shell.

## Colour

There is one accent. Terracotta. Olive appears in exactly one place, the home base
marker. Everything else is paper and ink.

```
--paper            #F7F2E8   page surface
--paper-raised     #FDFAF3   stop cards, tab strip, floating map controls
--paper-sunken     #EDE6D8   wells, the map gutter, the inactive tab strip
--rule             #D9CFBB   hairlines, card borders
--rule-strong      #C4B79C   the rule under an active tab, table dividers

--ink              #23201B   primary text, times, place names
--ink-muted        #5C554A   travel legs, durations, secondary text
--ink-faint        #8A8173   labels, units, the "min" after a number

--terracotta       #B4552F   the accent: active tab, selected stop, route lines,
                             the rule beside a conflict, primary action
--terracotta-deep  #8E4225   hover and active states of the accent
--terracotta-wash  #F0DDD2   selected row background, conflict block background

--olive            #4A5233   the home base marker and its label. Nothing else.
```

Never `#FFFFFF`, never `#000000`, on any surface, border, or text.

No dark theme. The surface is paper, and paper does not invert. Do not add a
`prefers-color-scheme: dark` block.

No status hues. There is no red, no amber, no green. A conflict is carried by a
terracotta left rule plus the sentence naming it, never by colour alone.

Contrast floor: `--ink` on `--paper` is the body pairing. `--ink-faint` is only for
text at 12px or larger that repeats information available elsewhere.

## Type

Two families, no more.

```
--font-display  "Bitter", Georgia, "Times New Roman", serif
--font-body     "Source Sans 3", "Segoe UI", system-ui, sans-serif
```

Display slab carries times, place names, and the day date. Body sans carries
everything else. Every element that renders a time or a duration sets
`font-variant-numeric: tabular-nums` so numbers stack in a column.

```
--text-time-lead   32px / 36px   display 600   tabular   arrival time on a stop card
--text-time        20px / 24px   display 600   tabular   departure, leg durations, totals
--text-place       18px / 24px   display 600             place name
--text-body        16px / 24px   body 400
--text-meta        14px / 20px   body 400      --ink-muted
--text-label       12px / 16px   body 600      0.08em tracking, uppercase, --ink-faint
```

Inside a stop card the arrival time is the largest element and the place name is one
step smaller. If a design puts the place name above the time in size or weight, it is
wrong.

Body text is left aligned. Never centred, except a single line inside an empty state.

## Radius

One system, three stops, nothing else.

```
--radius        6px    cards, tabs, inputs, buttons, the conflict block
--radius-panel  10px   the map pane, the mobile map sheet
--radius-pill   999px  map markers and the map expand toggle only
```

## Elevation

No shadows. The one exception is a control floating over the map:

```
--shadow-map-control  0 1px 3px rgba(35, 32, 27, 0.18)
```

Everything else separates with `--rule` or with a change of surface between `--paper`,
`--paper-raised`, and `--paper-sunken`.

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

## The map

Stop markers are `--paper-raised` circles with a 2px `--terracotta` ring and the stop
number in `--ink`.

The home base marker is `--olive`, and it is a different shape from the stop markers,
not merely a different colour.

Route lines are all `--terracotta`. The transport mode is carried by the stroke
pattern, so that colour is never the only thing distinguishing them:

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

Focus is a 2px `--terracotta` ring at 2px offset, visible immediately, on every
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
`--rule-strong`, and text stays `--ink`. Times keep the display slab and stay the
loudest thing on the page.

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
