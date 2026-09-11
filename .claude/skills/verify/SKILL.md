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

1. `#country` opens a listbox; fill `input[placeholder="Type a country"]`, click the
   option in `[role="listbox"][aria-label="Country"]`.
2. `#cityPlaceId` is a Google backed search; wait for
   `[role="listbox"][aria-label="City"] [role="option"]` and click one.
3. Dates are prefilled. Click `button[type="submit"]`.

It lands on `/t/<slug>/edit/<key>`. The key in the URL is the whole of the edit
authority, there is no cookie. `/t/<slug>` on its own is the read only share view and
has no search field.

Every trip opened this way is a row in the shared database. Delete them when done with
`db.trip.deleteMany({ where: { slug: { in: [...] } } })`, which cascades.

## The search field

`input[role="combobox"][placeholder^="Add a place"]`. Its panel is `div.top-full`
inside the nearest `div.relative`. A `MutationObserver` on that container, installed
before the click, gives a timestamped transcript of everything the panel says, which
is the evidence for anything about loading states.

Routes worth intercepting with `page.route`: `**/api/places/nearby**` (the city
recommendations, asked once per mount) and `**/api/places/search**` (typed search,
250 ms debounce, two letter minimum). Delay `nearby` to hold its waiting line still
for a screenshot.

## Gotchas

- After Escape the field keeps focus, so clicking it again fires no focus event and the
  panel does not reopen. Blur first (click the map) before refocusing in a script.
- Choosing a place hides the panel for about a second while it lands, then the panel
  closes. Refocus to see the list again.

## Legs and drag

- Playwright's `dragTo` does not fire the HTML5 drop here. Dispatch `dragstart` on the
  card, `dragover` and `drop` on the target, `dragend` on the card, all with one
  `DataTransfer` handle from `page.evaluateHandle(() => new DataTransfer())`.
- A drop reorders on screen at once (`useOptimistic`) and shows "Working out the new
  times." with `aria-busy` until the server answers; wait for that line to go before
  reading times.
- `button:has-text("Change")` index 0 is not a leg. Legs start at index 1.
- A public transport leg lists its rides in `ol li` under the row and a "Live times in
  Google Maps" link. Rows cached before rides were asked for show only the link until
  the hourly transit expiry; `legCache.deleteMany({ mode: "TRANSIT" })` forces a fresh
  ask (one Routes call per transit leg viewed).
