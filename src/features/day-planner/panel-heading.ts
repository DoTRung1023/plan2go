/**
 * The two surfaces of the block at the top of the panel, shared by the form an
 * editor gets and the plain heading a reader gets, so the two are drawn alike.
 *
 * The block is a card on the panel's paper, and the row that names the trip
 * sits on a sunken band across the top of it, under a rule, with the days and
 * the open day's line on raised paper beneath. The band is the one thing on
 * the panel that is about the whole trip rather than a day in it, and the
 * change of surface says so without a heading saying it.
 *
 * The band rounds its own top corners, a pixel inside the card's, because the
 * card cannot clip: the calendar and the trip's menu hang out of it over the
 * list, and a clipped card would cut them off.
 */
export const HEADING_BAND =
  "rounded-t-[calc(var(--radius-card)-1px)] border-b border-rule bg-paper-sunken px-[22px] py-[17px]";

/**
 * Ten rather than fourteen over the strip of days: the strip carries four of
 * its own, as room for a focus ring, so the pills sit fourteen under the rule.
 */
export const HEADING_BODY = "px-[22px] pt-[10px] pb-[15px]";

/**
 * The line naming the open day, closed off from the strip above it by a rule
 * inset to the body's padding. Ten under the strip, which with the strip's own
 * four puts the rule fourteen under the pills, the same as the pills sit under
 * the band.
 */
export const HEADING_DAY_LINE =
  "mt-[10px] flex items-center gap-[22px] border-t border-rule pt-[13px]";
