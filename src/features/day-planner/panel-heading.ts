/**
 * The panel's gutter: what its edge keeps clear on either side, at the top and
 * down the list alike, so the trip's row, the day's card and the stops under
 * them all stand on one left edge and one right. Fourteen, the room a card
 * needs from the edge of the sunken ground to read as laid on it.
 *
 * Twenty on a phone, where nothing is laid on a card and the trip's name and
 * the day's times are written straight on the page, as design 1b of
 * "PlanToGo iPhone" draws them.
 */
export const GUTTER = "px-[14px] max-lg:px-5";

/**
 * The block at the top of the panel, shared by the form an editor gets and
 * the plain heading a reader gets, so the two are drawn alike. Two things
 * laid on the panel's sunken ground, one under the other, with the room the
 * gutter gives at the top and between them.
 *
 * The first is the trip itself: its name, its dates and what can be done to
 * it, on one pill of raised paper. A pill rather than a band across the top,
 * because it is one row about one thing and a floating control is what this
 * product draws that as; the shadow is the floating control's. Padded to the
 * name's line, which at the title step is thirty, so the row is fifty with
 * the name the tallest thing in it and the controls beside it sized under
 * that. Eighteen in from the left edge to the name and twelve to the button
 * at the right, so the name sits in from the pill's curve and the round
 * button sits in its end. It does not clip, since the calendar and the trip's
 * menu hang out of it over the day.
 *
 * On a phone there is no pill. The name is the page's headline, the dates are
 * a line under it, and the round buttons stand at the right of the name, the
 * way design 1b heads the page: a grid of the name's column and one for each
 * button, with whatever goes under the name placing itself in the second row.
 */
export const HEADING_BAND =
  "flex items-center gap-[10px] rounded-pill border border-rule bg-paper-raised py-[10px] pr-3 pl-[18px] shadow-sm max-lg:grid max-lg:grid-cols-[minmax(0,1fr)_auto_auto] max-lg:items-start max-lg:gap-x-2 max-lg:gap-y-1 max-lg:rounded-none max-lg:border-0 max-lg:bg-transparent max-lg:p-0 max-lg:shadow-none";

/**
 * The line under the trip's name on a phone: its dates and how many days they
 * come to. On a desk the dates are on the name's row instead.
 */
export const HEADING_DATES =
  "text-small font-medium text-ink-muted tabular-nums lg:hidden max-lg:col-start-1 max-lg:row-start-2";

/**
 * The second is the strip of days, on one pill of paper, a step up from the
 * ground and a step under the raised cards the stops are on. The pill holds
 * the strip close, seven in from every edge, so it reads as one control made
 * of days rather than a shelf they stand on. Three over the strip, which
 * carries four of its own as room for a focus ring, makes seven; nothing
 * under it, where the strip keeps seven of its own for the same ring and its
 * scrollbar; seven either side, four of which the strip reaches out into for
 * the ring as well.
 *
 * Sixty tall, so its ends are thirty round: a pill while it holds the strip
 * alone, and the same corners rather than a swollen one when a sentence
 * under the strip makes it taller. The day pills stand eight in from its
 * edge at twenty two, so each curve runs alongside the other. It clips what
 * it holds to that shape, since a strip scrolled under its ends would
 * otherwise show a cut off day outside the curve.
 *
 * There is no line under the strip naming the open day any more. The tab
 * says which day it is and its date, and when the day leaves is set on the
 * day itself, on the time it leaves at.
 *
 * On a phone the strip stands on the page with nothing round it, and runs out
 * to the window's edges as it scrolls, so it does not clip.
 */
export const HEADING_BODY =
  "mt-3 overflow-hidden rounded-[30px] border border-rule bg-paper px-[7px] pt-[3px] pb-0 max-lg:mt-[14px] max-lg:overflow-visible max-lg:rounded-none max-lg:border-0 max-lg:bg-transparent max-lg:p-0";
