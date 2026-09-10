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
 *
 * Neither the padding nor the ground is baked into the shell, and that is
 * deliberate. Two Tailwind utilities for one property do not resolve by the
 * order they are written in a class string, they resolve by the order the
 * generated stylesheet happens to put them in, so a shared value that some
 * fields then override is a coin toss rather than a default. Each field states
 * its own, once.
 */
export const FIELD_SHELL =
  "w-full rounded-pill border border-rule text-[16px] leading-[1.2] text-ink";

/** A field that is only a field. */
export const FIELD_PAD = "px-5 py-[17px]";

/**
 * A field with a word at the right end. The room for it is kept clear here
 * rather than taken by the word itself, so a long value is cut short by the
 * padding instead of running underneath it.
 */
export const FIELD_PAD_ACTION = "py-[17px] pr-24 pl-5";

export const FIELD_GROUND = "bg-paper-raised";

/** Not answered yet, and waiting on the field above rather than switched off. */
export const FIELD_WAITING = "bg-transparent";

export const FIELD_LABEL = "text-[14px] leading-none font-semibold text-ink-muted";

/** The label and its field, which are one thing and are spaced as one. */
export const FIELD_STACK = "flex flex-col gap-2";

/**
 * The word at the right end of a field that opens something. Taken out of the
 * flow so that its own padding cannot make the pill taller than the three
 * fields beside it that have no such word.
 */
export const FIELD_CHANGE =
  "absolute top-1/2 right-3 -translate-y-1/2 rounded-pill px-2 py-[6px] text-[14px] leading-none font-bold text-terracotta-700";
