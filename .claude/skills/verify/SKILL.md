---
name: verify
description: How to build, launch and drive plan2go in a real browser to observe a change at its surface. Use when verifying a change in the trip editor, the search field, or the front door.
---

# Verifying plan2go at the surface

## Launch

```
pnpm dev -p <port>          # from plan2go/, reads .env (Neon DB + Google keys)
```

Ready in about two seconds. Any port works for the app, but the Maps browser key is
referrer restricted, so on a port other than the one allowed in the Google Cloud
console the map panel says "The map is not switched on for this address" and the
Next dev overlay shows two issues. The search field, the day list and every server
route still work, so that is fine for anything that is not the map itself.

## Driver

Playwright is not a project dependency. Install it in the scratchpad, not here, and
launch the installed Google Chrome so the version of the cached Chromium does not
matter:

```js
const { chromium } = require("playwright");
const browser = await chromium.launch({ channel: "chrome", headless: true });
```

## Getting a trip

Every dev run writes to the one shared Neon database, so open a fresh trip rather than
touching one that exists. Front door at `/`:

1. `#cityPlaceId` is a Google backed search over cities anywhere; fill it, wait for
   `[role="listbox"][aria-label="City"] [role="option"]` and click one.
2. Dates are prefilled. Click `button[type="submit"]`.

It lands on `/t/<slug>/edit/<key>`. The key in the URL is the whole of the edit
authority, there is no cookie. `/t/<slug>` on its own is the read only share view and
has no search field.

Every trip opened this way is a row in the shared database. Delete them when done with
`db.trip.deleteMany({ where: { slug: { in: [...] } } })`, which cascades.

## The search field

The bar is `.place-search .search-bar`; its field is `input[aria-keyshortcuts="/"]`,
which has no placeholder attribute (the empty field's words are an overlay,
`.search-words`). The bar carries `data-active` while it is in use, and
`.search-scrim` covers the page then. Both panels hang inside `.search-bar`, are drawn
from the classes in `panel-styles.ts`, and are mounted only while open, with no
transition, so wait for them to exist. The place list is the element the field's
`aria-controls` names, a `[role="listbox"]` labelled "Popular in <city>" or "Places that
match"; the city panel is `[role="dialog"][aria-label^="The city"]`, opened by
`.search-pill`, with its own field inside it. A
`MutationObserver` on `.place-search`, installed before the click, gives a
timestamped transcript of everything the panels say, which is the evidence for
anything about loading states. `.search-toast` is the sentence at the foot of the
map after a move or an add, gone after 2.4 s.

Routes worth intercepting with `page.route`: `**/api/places/nearby**` (the city
recommendations, asked once per mount), `**/api/places/search**` (typed search,
250 ms debounce, two letter minimum) and `**/api/places/preview**` (the look at a
chosen place, which needs the edit key). Delay `nearby` to hold its waiting line still
for a screenshot.

## Adding a place

Choosing from the search list does not add. It looks the place up (`/api/places/preview`),
pins it on the map as `.trip-map-candidate`, pans there, and opens the sheet
`section[role="dialog"][aria-label="<place name>"]` with `button:has-text("Add to Day N")`
at the top. Pressing that adds the stop and the sheet slides away. Every row ends in a
plus, `button[aria-label="Add <name> to Day N"]` titled `Add to Day N`, which adds
straight away without the look. Once the place is on the day it is a disabled tick,
labelled `<name> is on Day N` and titled `On Day N`. An empty day offers
`button:has-text("Find a place")`, which focuses the search field; a reader without the
edit key gets no such button.

## Gotchas

- After Escape the field keeps focus, so clicking it again fires no focus event and the
  panel does not reopen. Blur first (click the map) before refocusing in a script.
- Choosing a place closes the panel and opens the sheet; the field is cleared. Refocus
  it to see the list again.

## Legs and drag

- Playwright's `dragTo` does not fire the HTML5 drop here. Dispatch `dragstart` on the
  card, `dragover` and `drop` on the target, `dragend` on the card, all with one
  `DataTransfer` handle from `page.evaluateHandle(() => new DataTransfer())`.
- A drop reorders on screen at once (`useOptimistic`) and shows "Working out the new
  times." with `aria-busy` until the server answers; wait for that line to go before
  reading times.
- `button:has-text("Change")` index 0 is not a leg. Legs start at index 1.
- Every leg with a route has a "Live times in Google Maps" link under the row, in the
  mode the leg uses. Rides are no longer listed on screen; they still go to the PDF
  behind the "Distance of each leg" switch.

## The pane's width

- On a desktop the list pane can be resized from `button[title="Drag to resize"]`, the
  grip astride its left edge. Drag it, press ArrowLeft/ArrowRight with it focused, or
  double click it to go back to the laid out width. The width is `--pane` on `main`
  and is kept in `localStorage` under `plan2go.pane` (a reset removes it); the pane
  never goes under 400px and the map keeps 480px.

## The dates field

- The pill is `button[aria-haspopup="dialog"]`; its calendar is
  `[role="dialog"][aria-label="Choose the dates"]`. Name the dialog: in dev the Next
  error overlay for the map key is a dialog too, and a bare `[role="dialog"]` hits both.
- Days are `button[data-date="YYYY-MM-DD"]`. The heading `p[aria-live]` reads "Choose
  the first day" or "Now choose the last day". The first click sets the start and the
  field's Last day follows the pointer; the second click commits.
- In the trip header the Save dates footer only appears once the range differs from
  the saved one, and saving leaves the panel open.

## A place, opened

- `button[title="Place details"]` on a card, or `.trip-map-stop` on the map, opens
  `section[role="dialog"][aria-label="<place name>"]`. It reads "Looking up X." until
  `/api/places/card` answers; pictures come from `/api/places/photo`.
- A second dev server cannot start while one is running for this project. Drive the
  running one, or `pnpm build && npx next start -p <port>` for a production copy.
- After `pnpm db:push` a dev server started earlier still holds the old Prisma client
  and answers 502 on anything using a new table. Restart it.
