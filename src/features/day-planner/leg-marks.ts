import type { TravelMode } from "@/core/model/leg";
import { CarIcon, TrainIcon, WalkIcon } from "@/ui/icons";
import { legInk } from "@/features/trip-map/route-style";

/** The mode in words, so the map's stroke pattern is never the only source. */
export const MODE_WORDS: Readonly<Record<TravelMode, string>> = {
  walk: "Walk",
  drive: "Drive",
  transit: "Public transport",
};

/** The mode as a glyph, the same one on screen and on paper. */
export const MODE_ICON: Readonly<Record<TravelMode, typeof WalkIcon>> = {
  walk: WalkIcon,
  drive: CarIcon,
  transit: TrainIcon,
};

/**
 * How much of the leg's ink the disc behind its glyph is washed with. Enough
 * to be the same colour as the line on the map at a glance, not so much that
 * six discs down a day read as six badges.
 */
const DISC_WASH = "16%";

/**
 * The disc behind the glyph on a closed row, in the leg's own ink: the glyph
 * in it outright, and the disc a wash of it. The map draws each leg in the
 * next colour along, and this is the same colour on the row that names the
 * leg, so the two are matched by eye across the page. The mode is the glyph
 * and the word, never the colour.
 *
 * The wash is laid over nothing, so it takes the colour of whatever the row
 * is on; a disc that has to hide something behind it, the thread on a
 * printed sheet, names the paper it is on instead.
 */
export function legDisc(
  index: number,
  over = "transparent",
): { readonly color: string; readonly backgroundColor: string } {
  const ink = `var(${legInk(index)})`;
  return { color: ink, backgroundColor: `color-mix(in srgb, ${ink} ${DISC_WASH}, ${over})` };
}
