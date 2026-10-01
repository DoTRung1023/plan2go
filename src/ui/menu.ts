/**
 * One row of a menu. A word with a glyph in front of it, the way every menu
 * anybody has used is drawn, so nothing here has to be learned. Every menu in
 * the product draws its rows with this, so any two are the same rows at the
 * same height. Forty on a phone, where the rows are pressed one under the
 * other with a finger.
 */
export const MENU_ITEM =
  "flex w-full items-center gap-[10px] rounded-chip border-0 bg-transparent px-3 py-[9px] text-left text-small/none font-semibold text-ink hover:bg-neutral-200 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-terracotta max-lg:min-h-10";

/** The line in a menu between what changes a thing and what ends it. */
export const MENU_RULE = "mx-[10px] my-[5px] h-px bg-rule";
