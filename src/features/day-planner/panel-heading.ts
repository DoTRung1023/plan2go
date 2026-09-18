/**
 * The panel's gutter: what its edge keeps clear on either side, at the top and
 * down the list alike, so the trip's name and the cards under it line up.
 */
export const GUTTER = "px-5 lg:px-[26px]";

/**
 * The two surfaces of the block at the top of the panel, shared by the form an
 * editor gets and the plain heading a reader gets, so the two are drawn alike.
 *
 * Each runs the full width of the panel: the row that names the trip on a
 * sunken band across the top, under a rule, and the days and the open day's
 * line on raised paper beneath, closed by another. The band is the one thing
 * on the panel that is about the whole trip rather than a day in it, and the
 * change of surface says so without a heading saying it. Neither clips, since
 * the calendar and the trip's menu hang out of the band over the list.
 */
export const HEADING_BAND = `border-b border-rule bg-paper-sunken py-[11px] ${GUTTER}`;

/**
 * Ten rather than fourteen over the strip of days: the strip carries four of
 * its own, as room for a focus ring, so the pills sit fourteen under the rule.
 */
export const HEADING_BODY = `border-b border-rule bg-paper-raised pt-[10px] pb-[15px] ${GUTTER}`;

/**
 * The line naming the open day, closed off from the strip above it by a rule
 * inset to the gutter. Thirteen under the strip, which with the seven the
 * strip keeps under its pills puts the rule twenty under them.
 */
export const HEADING_DAY_LINE =
  "mt-[13px] flex items-center gap-[22px] border-t border-rule pt-[13px]";
