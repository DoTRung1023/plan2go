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
    600: "#B2622D"
    700: "#8C491A"
    800: "#643312"
    900: "#402310"
  sage: "#7A8A5E"
  sage-ramp:
    100: "#F0FAE1"
    200: "#E1EECC"
    600: "#728157"
    700: "#56633F"
    800: "#3D472B"
    900: "#272E1B"
  neutral-ramp:
    200: "#EEE7DB"
    300: "#DCD3C4"
    400: "#C0B6A5"
    600: "#82796A"
    700: "#645C50"
    900: "#2E2B25"
typography:
  headline:
    fontFamily: Baloo 2
    fontSize: 32px
    lineHeight: 1.25
    fontWeight: 600
  title:
    fontFamily: Baloo 2
    fontSize: 23px
    lineHeight: 1.25
    fontWeight: 600
  lead:
    fontFamily: Baloo 2
    fontSize: 20px
    lineHeight: 1.25
    fontWeight: 600
  place:
    fontFamily: Baloo 2
    fontSize: 16px
    lineHeight: 1.25
    fontWeight: 600
  time:
    fontFamily: Baloo 2
    fontSize: 14.5px
    lineHeight: 1.1
    fontWeight: 600
    fontVariantNumeric: tabular-nums
  body:
    fontFamily: Be Vietnam Pro
    fontSize: 14px
    lineHeight: 1.5
    fontWeight: 400
  small:
    fontFamily: Be Vietnam Pro
    fontSize: 13px
    lineHeight: 1.4
    fontWeight: 400
  meta:
    fontFamily: Be Vietnam Pro
    fontSize: 12px
    lineHeight: 1.45
    fontWeight: 400
  micro:
    fontFamily: Be Vietnam Pro
    fontSize: 11.5px
    lineHeight: 1.4
    fontWeight: 400
  label:
    fontFamily: Be Vietnam Pro
    fontSize: 10.5px
    lineHeight: 1
    fontWeight: 600
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
    backgroundColor: "{colors.terracotta-ramp.200}"
    textColor: "{colors.terracotta-ramp.900}"
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

The map keeps no hues of its own. Driving is `terracotta-700`, walking `terracotta-600`,
and public transport `sage-700`: two steps of the accent and the second voice, all three
already in the ramps above.

It kept three of its own for a while, spread as far apart on the wheel as three colours
could be, on the argument that a route in the product's own colour reads as the route
the product is recommending. That argument does not survive the drawing. What a route is
is settled by its pattern and by the key beside it, and a map whose ground, markers and
lines all come from one family reads as one thing rather than as a chart laid over a
map. Driving and walking are deliberately close, because the pattern is what separates
them and a line of separated marks says "on foot" without being read; transport is the
one line that is not a shade of the accent, and is therefore the one told apart at a
glance. There was a fourth mode once, cycling, with a cobalt of its own; it went when
the mode did.

There are two accents and they are not interchangeable. Terracotta is the product: the
stop numbers, the active day, the primary action, the route lines, and anything the plan
wants to tell you about itself, which in this product means a conflict. Sage is the
second voice and it carries the ends of a day and today in the strip. Everything else is
paper and ink.

- **paper:** the page, the day's card on the planner, a leg, and an end of the day
  still to be chosen.
- **paper-raised:** stop cards, the trip's row, floating controls, inputs, the search
  panel, menus.
- **paper-sunken:** the planner's ground, wells, the map gutter, a hovered control.
- **rule:** hairlines and card borders, drawn as ink at low opacity so one value works
  over all three surfaces.
- **rule-strong:** the border of a control under the pointer, and dashed outlines.
- **ink, ink-muted, ink-faint:** primary text, secondary text, and placeholders.
- **terracotta:** the accent. 100 and 200 are tinted fills, 200 being the conflict block
  and the error block, the base is the accent itself, 600 is hover, 700 is pressed and is
  the step to use for accent coloured text, 800 is the active day tab.
- **sage:** the second accent. 100 and 200 mark today in the day strip, 600 is the marker
  for the ends of a day, 700 draws the public transport route line.
- **neutral:** the warm greys behind everything, used for the drive tint and the map's
  own geometry.

Every ramp is generated in OKLCH on one shared lightness scale, so the same step of any
ramp carries the same visual weight. Only the steps the product spends are declared, so
the ramps above have gaps in them; the scale is the authority, not the list. A step that
is needed later is computed from that scale and added back, never chosen by eye to sit
between the two steps that happen to survive around it.

Prefer a ramp step to an ad hoc `color-mix()`.

Never `#FFFFFF`, never `#000000`, on any surface, border, or text.

No dark theme. The ground is warm paper, and paper does not invert. Do not add a
`prefers-color-scheme: dark` block.

No status hues. There is no red, no amber, no green. A conflict is carried by the
terracotta block plus the sentence naming it, with the real numbers in the sentence.

Contrast floor: `ink` on `paper` is the body pairing. The accent to ground pair is
tuned to 3:1, which is enough for icons, large type and interface chrome and not enough
for paragraphs, so accent coloured text at body size uses `terracotta-700`.

## Typography

Two families, no more, and both of them carry Vietnamese. Baloo 2 for display, falling
back to Be Vietnam Pro, system-ui, sans-serif. Be Vietnam Pro for body, falling back to
system-ui, -apple-system, "Segoe UI", sans-serif. Both are loaded with the latin,
latin-ext and vietnamese subsets named explicitly.

That is a requirement and not a preference. This product is read in cities whose place
names it cannot spell without it: a face carrying latin only drops out of the typeface
part way through "Nhà hát Lớn Hà Nội" and hands the rest to whatever the system has, and
the stacked marks Vietnamese depends on, a tone over a circumflex in ế or ộ, come back
undersized and out of position. A face considered for this product is checked for
vietnamese before it is checked for anything else.

Baloo 2 is variable from 400 to 800, where the display face before it had one weight
that was already heavy. Headings ask for 600, which is what 400 used to give. They still
never ask the browser to synthesise a weight the face does not have.

Nothing in the display face is set under 1.25 line height where a place name can reach
it. Two marks stacked above a letter need the room, and a line box tight enough for
English clips the upper one.

Display carries times, place names, durations and the day heading. Body carries
everything else.

Ten steps and no others. Every size in the planner is one of them, set with its own
line height and, where it is a pill, with `text-step/none` rather than a second leading
utility fighting the first. Lead is the heading of what opens over the page: the place
open in the sheet, and the question asked before a trip is deleted. Small is the tier the interface is mostly made of,
tab labels, menu rows, the words on a leg, which used to be a scatter of 13px and 13.5px
chosen one component at a time. A number that is not on the scale is a number that has
not been thought about, and the marketing page, which the scale does not govern, is the
one place such a number may appear. Every element that renders a time or a duration sets
`font-variant-numeric: tabular-nums` so numbers stack in a column.

- **headline:** the trip name, the one line about the whole trip, a step over every
  other heading.
- **title:** the heading of an empty day, the printed day, and a page that has nothing
  to show.
- **place:** a place name, and the time against an anchor row.
- **time:** when a stop is arrived at and left, on its card.
- **body:** running text.
- **meta:** secondary text, addresses, the words in a leg row.
- **micro:** the second line of a search result, and the sentence in a conflict.
- **label:** the small heading above a value. Sentence case, 600, never uppercase. The one
  uppercase heading in the product is the day's number on a day tab, which is set at the
  micro step rather than this one, over the date the way a calendar heads a column.

There was an eleventh, tick, at 9.5px, for the date and the stop count under a day
tab's name. It went when the tab became the day's number over its date, which is set at
the micro and small steps, and nothing else ever spent it.

Body text is left aligned. Never centred, except a single line inside an empty state.

## Layout

**Desktop, 1024px and up.** Two panes, map left and list right.

```
grid-template-columns: minmax(0, 1fr) clamp(520px, 40%, 660px);
```

The map fills its pane edge to edge, with no frame of its own. The list pane is a
column the height of the viewport: the trip name and the day tabs are fixed at the top,
and only the day itself scrolls, so what is being read is always named above it.

The list pane stands on sunken paper, and everything on it is laid on that ground 14px
in from the edge, 12px apart. The trip comes first, on a pill of raised paper under a
floating control's shadow: its name at the title step, its dates, and its menu, one row
about the whole trip. Under it the days, on one card of paper at the `row` radius: the
strip of tabs and nothing else, held close: seven in from every edge, so the card reads
as one control made of days. Each tab is a pill 44px tall, the height a finger needs,
with two lines centred in it, **DAY 1** over **Sat 26**: the number uppercase at the
micro step, the date at the small step, both 600, four apart. Every tab is as wide as
the widest date needs, 82px, so the row reads as days rather than words, and they stand
four apart. The chosen day is on `terracotta-800` with its date in `paper` and its
number at 85 percent of it; the rest are in `ink-muted`, and today in sage as before.
Under the pointer a day that is not chosen takes `paper-sunken`, the step every control
on paper takes, with its words in `ink`, and today goes from sage 100 to 200. After the
last tab, eight off, the button that adds a day: a 32px dashed ring in `rule-strong`
with a 15px plus in `ink-muted`, still shorter than the tabs so it reads as an offer.
Under the pointer its dash takes the whole accent, its plus `terracotta-700`, over the
same `paper-sunken`. The focus ring is drawn outside every tab and the button, as it is
everywhere, and the strip keeps four pixels round them so no ring is clipped. When the day leaves
is set on the day itself. Then the day itself: stops on raised cards, legs between them on pills of paper, and the ends of the
day on shorter rows of paper inside a hairline, dashed where an end is not there yet.
A day with no stops says so straight on the ground, with no card under it, since a card
on the day is a stop: between the two ends, on the same edges as every card and row, and
twelve under the start of the day when there is one. The next place is offered as the next number on the rail, drawn dashed at the foot of
the last stop card, where a place found in the search is added. Three surfaces, each a step up from the one it sits on, and
nothing drawn edge to edge.

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
top of each other. Each says when the place it stands at is open, in the same words and
the same clock a stop card uses: a hotel that locks its doors at eleven is as much use
to know about as a museum that shuts at five.

An end's row is laid on a stop card's grid to the pixel: the name and address on the
stops' left edge, in words rather than as a button, and at the top right the time, on
the stops' right edge so the day's times stand in one column, with the tools under it.
A reader gets the glyph that opens the place. Someone who may edit gets one tool
instead, three dots, which opens a menu drawn with the trip menu's rows: **About this
place**, **Change start point**, and under a rule **Remove start point** (or the end's).
An end has three things to do to it and a row a third shorter than a card, so they are
words in a menu rather than three glyphs in a row. The tool is drawn at 55 percent
until the pointer is over the row, as a card's are, and whole while its menu is open.
The menu opens down from the start of the day and up from its end, over the day.

A stop says when it is arrived at and when it is left, the pair at the top right with an
arrow between them. The second is the first plus the stay set underneath, which is
arithmetic a person should not have to do to find out when they are done somewhere.

A conflict is a terracotta block carrying the sentence that names it, with a warning
triangle beside the words. The accent rather than the second voice: sage is what the ends
of a day are drawn in, and a conflict wearing it shared a colour with the thing it was
often about. The triangle for the same reason the clock is gone, which is that a clock
said only that this concerned the time, and every line on a stop card does. The tint
alone is never the signal.

A stop card carries its own controls and, on the last card of the day, one other,
described below. The two that act on the whole
stop, moving it and taking it off the day, sit under the two times at the top right,
because they are about the row rather than about anything inside it. The address under
the name runs on beneath the times as far as the tools reach, which are narrower than
the times, rather than stopping at the name's width: a street and a suburb that broke
early against the times mostly read on one line. The tools are drawn at 55 percent
until the pointer is over the card and never hidden, since half the people using this
have no pointer to hover with. How long the stop lasts is a pill with a clock on it
that opens two columns, hours and minutes, the same columns the day's leaving time
opens, and writes when it closes; the opening hours sit beside it in words, and the
note is either a field or the one line offering to start one. Removing is immediate: a stop is a search away from
coming back, and a dialog asking twice would be a modal over something editable in
place.

When the day leaves is set where that time shows, on the day rather than above it: on
the start point's time when the day has one, and otherwise on the first stop's arrival,
which with nothing before it is the moment the day sets out. One of the two carries it,
never both, and it defaults to 09:00. For someone who may edit, that time is a pill: the
time in the times' own face, step and `terracotta-700`, with the stay's 12px chevron
after it in the arrow's `terracotta-700` at 65 percent, quieter than the time as the
stay's chevron is quieter than its words, inside a dashed 1px edge in `terracotta` at 55 percent, the weight a hovered
card's edge is drawn at, over `terracotta` at 10 percent. Under the pointer, and while
the picker is open, it does what the dashed row offering an end of the day does: the
dash takes the whole accent and the paper lifts to `paper-raised`. The tint alone sank
with the card, which sinks under the same pointer, and left only a darker edge to tell
the two apart; raised paper is opaque and comes up out of the sunken card instead. The
picker is the same two columns the stay opens, hanging from the pill's right end. The pill takes
exactly the room the plain time takes: the time's own line height, with 1px of padding
and 1px of edge above and below given back by a 2px margin, so the time sits where a
reader's plain time does and nothing else on the card or the row moves. Across, the
whole times line is 7px apart as it is seen: the edge to the time, the time to the
chevron, the chevron to the edge, the edge to the arrow, and the arrow to the next time.
The chevron and the arrow carry some margin inside their own boxes, so what is written
is 6px of padding on the left, 5px before the chevron as before the arrow, and 4px
after it. A reader
without the edit link gets the plain time in both places.

The last card on the day ends with the stop that would come next, as a slot on the
rail. Under the disc, where the thread runs on to it, is the number that stop would
get, in a 30px circle drawn with the leaving time's edge, the other dashed outline in
the accent a card carries: 1px, dashed, in `terracotta` at 55 percent. The digit is the disc's face and step, in `terracotta-700`. Beside it, on
the left edge of the name above, **Add a place** at the small step in `terracotta-700`,
the stay's step, and at the right, "from" and the time this stop is left, at the micro
step in `ink-muted`, the step the opening hours are in. That is when the way to the next
place would begin, not when the next place would start: the leg between them comes
first. The slot is the card's second row, 13px under its body, as far as the body
is from the card's edge, and the thread stops 13px short of the ring. The whole row is
one button that takes the traveller to the search field. It runs from the ring's left
edge to where the times end, and the time sits 10px in from that end, as the stay's
words do from its edge. Under the pointer the row is a pill as tall as
the ring in `neutral-200`, the fill the card's tools take under the pointer, and
the ring's dash takes the whole accent, as every dashed control's does; the words stay
as they are. With the keyboard on it the focus ring draws the same pill,
with no fill, as on every other control. The card behind it does not sink the way it
does under the pointer, and this stop's marker on the map is let go: the slot is about
the stop after this one.
It is on the last card because that is where a place found in the search goes, and it
is the one control on a card about the day rather than the stop. A reader without the
edit link does not get it, and the thread ends at the foot of the card as on every
other.

A leg opens. Closed it is one line, the mode and how long it takes, with **Change** at
the end of it. Open it is a sunken panel of every way of covering the same ground, one
tile each, carrying the mode, the time and the distance, with the one in use outlined
in terracotta and its dot filled. Choosing leaves the panel open, because the outline
moving and the times below changing are the answer and trying a second mode should not
mean opening it again. Collapse is what closes it. While the new times are being worked
out the tiles stay on screen at reduced opacity under a line of text saying what is
happening, which is what this product does instead of a skeleton.

## A place, opened

A stop, or an end of a day, can be opened to see what its place is like, from **About
this place** on its row or by pressing its marker on the map. What opens is a sheet over
the left edge of the map: a card 408px wide, standing 8px in from the map's edge and
8px short of the top and bottom of the window, rounded at the `panel` radius and edged
with `rule` under `shadow-md`, with the map still in sight beside it, and the whole
window on a phone. The map frames the day, or the place a search is looking at,
in what is left of it beside the sheet, so nothing it is showing is under the sheet.
The search field stays in the map's corner, floating over the top of the sheet: a 48px
pill, 16px in from the sheet's sides and 20px down from its top, so over the sheet it
sits in it the way a map search sits in the panel it opened, and over the map alone it
is the same field in the same place. Inside, the sheet keeps 24px at each side. While
the sheet is open the field holds the place's name, as a map search does: the place is
what was searched for, whether it was found in the field or opened from the day, and
the cross on the field is what closes the sheet, drops the pin and empties the field. It slides in from the left and slides back out the same way. On a desk the tab
on its free edge, halfway down, pointing the way it goes, puts it aside rather than
closing it: the map is seen whole, exactly as it was, and the pin, the name in the
field and the place stay; the tab waits at the window's edge, pointing back, and
brings the sheet back, as does opening anything. The map is framed for a sheet
opening or closing and never moved for one going aside or coming back. On a phone a close button in
the corner closes it, and so does Escape anywhere. The picture comes first because it answers
fastest; then the name, the kind of place and its rating out of five with a filled
terracotta star; then the sentence the provider has for it, a strip of more pictures, the
address and the ways to reach it, and what people say, each with their stars and how
long ago. Any picture opens as large as the window allows, with the next and the last a
press or an arrow key away. Nothing in the sheet changes the trip. It is asked for when
opened and never before, because it is the dearest question the place provider answers,
and it is shown whole once its words and pictures are all here rather than as they
arrive. Every picture and rating in it is credited to where it came from.

## The map

A line is drawn between each pair of points in travel order, under the markers. The
pattern is the mode and nothing else, and the colour is the leg:

```
drive      4.6px  solid
transit    4.6px  dash 9 5
walk       5px    dash 0.5 8, round
```

Each leg of a day takes the next ink in this order and the seventh starts again:
terracotta-700, sage-700, terracotta, neutral-700, sage-600, terracotta-900. Two legs
in the same mode one after the other are the same pattern, and where they run along
the same road they were one line; the colour is what makes them two. The order
alternates the accent with sage and the warm grey, so no two neighbours sit on the
same ramp.

One table in `src/features/trip-map/route-style.ts` holds the three pattern rows and
the ink order, and both the map and the key read from it, so a line and the sample
that explains it cannot drift apart. Google draws a dash or a dot as a symbol repeated
along an invisible line rather than as a stroke pattern, which is why each row also
says what shape it repeats, and a dash in the key is the length the map actually draws.
The printed map cannot pattern a line at all, so on paper the colour is all that tells
one leg from the next.

Every leg also states its mode in words in the list, so the pattern is a reminder and
not the only source of the fact.

The route key sits in the bottom left and lists all three modes, in the order Google
lists them, whenever the day has a line on it. It is the notation, so it does not
change with the modes this particular day happens to use, and its samples are drawn in
the same muted ink as its words: a coloured sample would say the colour meant something. The markers have no key of
their own, because a numbered disc in the order you visit them and a named marker for
the ends of the day explain themselves.

The map's own geometry is styled onto the warm ramp: cream ground, raised roads, sunken
parks, and water in neutral 300 rather than a blue. Photography was tried in its place
and taken out again. It is somebody else's palette, it dictates the page from
underneath, and a product whose whole surface is one warm ramp cannot have its largest
element opt out of it. Every one of Google's controls is off and ours are drawn over the
map instead: the search in the top left, the route key in the bottom left, and in the
bottom right the button that fills the screen with the zoom pair under it, where a thumb
reaches first. What the map is drawn on is not offered as a choice. There is one ground,
and it is the product's own.

## Motion

Three things animate: reordering a stop, the trip's actions unfolding, and a place's
sheet arriving and leaving.

Reordering: `transform` over 160ms `ease-out` on the card being moved and on the cards
displacing around it. Nothing else, no opacity, no scale.

The trip's actions: `grid-template-columns` from `0fr` to `1fr` over 200ms `ease-out`,
so the row grows from nothing without anything having to know how wide the buttons are.
It is the one hover transition in the product, and it earns the exception because the
movement is the affordance: a group that simply appeared would read as the row
rearranging itself rather than as something folded away that has opened.

A place's sheet: `transform` from wholly off the left edge of the window to its place,
200ms `ease-out` on opening, and back out the same way, 160ms `ease-in` on closing.
Nothing else moves, no opacity. It is laid over the map, and a sheet that appeared in
one frame read as the map being replaced rather than covered; sliding out is how it
says where it went. The picture viewer it opens is the whole window and appears at once.

Nothing else. No transitions on focus, tab switching, any other panel opening, or map
interaction, and no other transition on hover. Those changes are instant.

Focus is a 2px `terracotta` ring at 2px offset, visible immediately, on every
interactive element.

Under `prefers-reduced-motion: reduce`, reordering and the sheet are instant too.

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

A day on paper is read down its times: the trip's name and dates on a line over the
day's own name, a strip under them saying when it leaves, when it is done, how many
stops and how long is spent travelling, the map if it was asked for, and then the
day down a dashed thread with each time in a column of its own on the left, the
marker beside it, and the place, its address, its hours and the note on it to the
right. The trip's name, never a city's: a trip's days can be in different cities. A
day longer than a sheet runs on to the next under its name, marked continued, with
its numbers and map on the first alone; the rows are measured and dealt so that a
sheet is never fuller than a page, and a row is never cut in two. A cover can go in
front of the days, the trip's name and dates and every day at a glance, and a ruled
sheet after each day for writing on. A footer on every sheet says it was made with
plan2go and which sheet it is of how many, counting every sheet.

The export is chosen in a window over the whole page, the deepest shadow's one use:
the choices down a column on the left, the days as chips with a word that takes all
of them or just the open one, then what goes on the page as boxes with a line under
each saying what it means, then the paper as rows of pills, its size, which way up,
how much of it the map takes, how big the words are and whether it is in the map's
colours or in ink alone, then
the file's name, and the sheets on the right exactly as they will print, redrawn as
each choice changes, with the name of the one at the top held over them. The sheets
are drawn at the paper's own size and the page rule is told the same size and way up,
so what is chosen here is what comes out and nothing is shrunk or turned to fit. The
one format is in the button's own words, Export PDF.

The file is drawn on the server. The export is spelled out in the address of a page
that holds the sheets and nothing else, a browser of our own opens that page, waits
for the sheets to be dealt and every map to arrive, and prints it with the same
stylesheet the preview is drawn with. The file comes back as a download under the name
in the field, so what was looked at and what comes out are one thing, the same on
every reader's machine, and nothing of a print window, no header, no date, no address,
is in it. While it is drawn the button says so, and a file that could not be drawn is
a sentence under the button saying what happened and what to do. The browser's own
print command still prints the preview while the dialog is open, and the open day
while it is not.

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
is a rule drawn as a gradient, which is the only gradient in the product. The page
behind the question that deletes a trip is dimmed and blurred, which is the only blur:
it is the one question that cannot be left half answered, and the ground going quiet
is what says so.

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
