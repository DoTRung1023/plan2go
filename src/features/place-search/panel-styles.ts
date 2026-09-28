/**
 * The panel that hangs under the search field, shared by everything that
 * opens one there: the places that match, and the cities the city pill
 * offers. One set of classes, so the two read as the same list and a change
 * to one is a change to both.
 *
 * As wide as the field, 8px under it, at the `panel` radius under a panel's
 * shadow, and no taller than 330px, past which it scrolls.
 */
export const PANEL =
  "absolute top-full right-0 left-0 z-30 mt-2 flex max-h-[330px] flex-col overflow-hidden rounded-panel border border-rule bg-paper-raised shadow-md";

/**
 * Where the rows scroll. Only the bar's own width on the right: the room a
 * row leaves beside whatever sits at its end is the row's own, so it can
 * match what that mark has on its other side.
 */
export const PANEL_LIST =
  "scroll-line min-h-0 overflow-x-hidden overflow-y-auto py-[7px] pr-[2px] pl-[3px]";

/** The small heading over the rows: "Popular in Hanoi", "Matching places". */
export const PANEL_LABEL = "px-[7px] pt-1 pb-[9px] text-label font-semibold text-ink-muted";

/** The one sentence the panel has when the rows are not doing the talking. */
export const PANEL_LINE = "px-[7px] py-[10px] text-meta text-ink-muted";

/** A row, with whatever sits at its end: a plus, a tick, or nothing. */
export const ROW = "flex items-center rounded-chip pr-[6px]";

/** The row under the pointer or the arrow keys. */
export const ROW_ACTIVE = "bg-terracotta-100";

/**
 * The row's own button, its mark and then its words. Close on its right, so
 * the words run up to whatever is at the end of the row.
 */
export const ROW_BUTTON =
  "flex min-w-0 flex-1 items-center gap-[7px] rounded-chip py-2 pr-[6px] pl-[7px] text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-terracotta";

/**
 * The mark at the front of a row: a pin, or a city's dot in the pin's place,
 * and the glass at the front of a field that lines up with them. Its colour
 * is the caller's, since a pin is the accent and a glass is not.
 */
export const ROW_MARK = "grid h-[15px] w-[15px] shrink-0 place-items-center";

/** A place's pin, in the accent, on every row that has one. */
export const ROW_PIN = "text-terracotta";

/**
 * Wrapped greedily rather than prettily: the page keeps a last line from
 * being one word, which in a row this narrow moved a word down that fitted
 * and left the line short beside the mark at the end.
 */
export const ROW_WORDS = "min-w-0 text-wrap";

export const ROW_NAME = "block text-meta font-semibold text-ink";

export const ROW_LINE = "block text-micro text-ink-muted";

/** What sits at the end of a row, on the same 26px either way. */
export const ROW_END = "grid h-[26px] w-[26px] shrink-0 place-items-center rounded-pill";
