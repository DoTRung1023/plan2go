/**
 * The day on a phone, drawn to design 1b of "PlanToGo iPhone": a rail down
 * the left of the window, every line of the day laid on the same three
 * columns. The times stand in the first, fifty wide and set to its right edge
 * so they read as one column; the marks hang on the rail in the second,
 * twenty six wide, the stops' discs and the ends' markers; and the words take
 * the rest. Ten between each.
 */
export const RAIL_ROW = "grid grid-cols-[50px_26px_minmax(0,1fr)] gap-x-[10px]";

/** A mark on the rail, the column's own width, so the line through it runs down its middle. */
export const RAIL_MARK = "grid h-[26px] w-[26px] shrink-0 place-items-center rounded-pill";

/**
 * An end of the day on the rail: not a disc, as a stop is, but the sage square
 * with one corner cut that a desk's rows and the map draw an end as, at the
 * size the map draws it, which is the rail's own width.
 */
export const RAIL_END_MARK =
  "grid h-[26px] w-[26px] shrink-0 place-items-center rounded-[11px_11px_11px_3.5px] bg-sage-600 text-paper";
