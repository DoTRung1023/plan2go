/**
 * The panel's gutter: what its edge keeps clear on either side, at the top and
 * down the list alike, so the trip's row, the day's card and the stops under
 * them all stand on one left edge and one right. Fourteen, the room a card
 * needs from the edge of the sunken ground to read as laid on it.
 */
export const GUTTER = "px-[14px]";

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
 */
export const HEADING_BAND =
  "flex items-center gap-[10px] rounded-pill border border-rule bg-paper-raised py-[10px] pr-3 pl-[18px] shadow-sm";

/**
 * The second is the strip of days, on one card of paper, a step up from the
 * ground and a step under the raised cards the stops are on. The card holds
 * the strip close, seven in from every edge, so it reads as one control made
 * of days rather than a shelf they stand on. Three over the strip, which
 * carries four of its own as room for a focus ring, makes seven; nothing
 * under it, where the strip keeps seven of its own for the same ring and its
 * scrollbar; seven either side, four of which the strip reaches out into for
 * the ring as well.
 *
 * There is no line under the strip naming the open day any more. The tab
 * says which day it is and its date, and when the day leaves is set on the
 * day itself, on the time it leaves at.
 */
export const HEADING_BODY =
  "mt-3 rounded-row border border-rule bg-paper px-[7px] pt-[3px] pb-0";
