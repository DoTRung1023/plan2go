/**
 * What every field on the starter page is drawn in.
 *
 * They sit one under another in a single card, so any difference between them
 * reads as a difference in kind rather than as a difference in what they are
 * asking for. One pill, stated once.
 *
 * The values come from the design canvas in storage/, mapped onto this
 * product's own tokens rather than copied as raw colours: its accent is our
 * terracotta, its surface our paper-sunken, its ink alphas our ink-muted and
 * ink-faint. Nothing here reaches for a value the palette does not already have.
 */
export const FIELD_PILL =
  "w-full rounded-pill border border-rule bg-paper-raised px-5 py-[17px] text-[16px] leading-[1.2] text-ink";

/** Not answered yet, and waiting on the field above rather than switched off. */
export const FIELD_WAITING = "border-rule bg-transparent";

export const FIELD_LABEL = "text-[14px] leading-none font-semibold text-ink-muted";

/** The label and its field, which are one thing and are spaced as one. */
export const FIELD_STACK = "flex flex-col gap-2";

/**
 * The word at the right end of a field that opens something. Terracotta because
 * it is the one part of the row that does anything.
 */
export const FIELD_CHANGE =
  "shrink-0 rounded-pill px-2 py-[6px] text-[14px] leading-none font-bold text-terracotta-700";
