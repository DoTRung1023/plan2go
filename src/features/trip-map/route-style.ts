import type { TravelMode } from "@/core/model/leg";

/**
 * How each way of getting somewhere is drawn, in one table.
 *
 * The map and the key beside it read from the same row, so a line on the map
 * and the sample in the key can never drift apart.
 *
 * The pattern is the mode and nothing else: a continuous line is a drive, a
 * dashed one is public transport, and a route made of separated marks is the
 * one that says "on foot" without being told. Colour says which leg, not
 * which mode, and the key is drawn in the panel's own muted ink for the same
 * reason: a sample in a colour would say the colour meant something.
 *
 * A dash in the sample is the length the map actually draws, because the two
 * are read one after the other and a sample that only resembled the line would
 * be worse than none.
 */
export interface RouteStroke {
  readonly mode: TravelMode;
  /**
   * The word in the key, and only there. The key is one line along the foot of
   * the map with three samples on it, so each word is as short as it can be
   * and still be the mode: the panel beside it has room to say "Public
   * transport" in full and does.
   */
  readonly label: string;
  readonly weight: number;
  /** The sample drawn in the key. Null is a solid line. */
  readonly dashArray: string | null;
  readonly roundCaps: boolean;
  /**
   * What Google draws. A dashed or dotted line there is a repeated symbol
   * rather than a stroke pattern, so the shape of it is spelled out here.
   */
  readonly drawn:
    | { readonly kind: "solid" }
    | { readonly kind: "dots"; readonly repeat: string }
    | { readonly kind: "dashes"; readonly scale: number; readonly repeat: string };
}

const STROKES: Readonly<Record<TravelMode, RouteStroke>> = {
  drive: {
    mode: "drive",
    label: "Driving",
    weight: 4.6,
    dashArray: null,
    roundCaps: false,
    drawn: { kind: "solid" },
  },
  transit: {
    mode: "transit",
    label: "Transport",
    weight: 4.6,
    // Nine of line to five of gap: long enough that a dash still reads as a
    // piece of route where the line bends, short enough that three of them
    // fit in the sample.
    dashArray: "9 5",
    roundCaps: false,
    drawn: { kind: "dashes", scale: 4.5, repeat: "14px" },
  },
  walk: {
    mode: "walk",
    label: "Walking",
    weight: 5,
    dashArray: "0.5 8",
    roundCaps: true,
    drawn: { kind: "dots", repeat: "9px" },
  },
};

/** In the order Google lists them, which is the order the key is read in. */
export const ROUTE_STROKES: readonly RouteStroke[] = [
  STROKES.drive,
  STROKES.transit,
  STROKES.walk,
];

/** Total by construction: the table has a row for every mode there is. */
export function routeStroke(mode: TravelMode): RouteStroke {
  return STROKES[mode];
}

/**
 * The ink each leg of a day is drawn in, by its place in the day, round and
 * round. Two legs in the same mode one after the other are the same pattern,
 * and where they run along the same road they were one line; the colour is
 * what makes them two. The order alternates the accent with sage and the
 * warm grey, so no two neighbours are near each other on the same ramp, and
 * six is more legs than most days have before it comes round again.
 *
 * Read at runtime as custom properties, because Google is handed a colour and
 * not a class. The printed map keeps its own copy of these, in hex, as it
 * does of the rest of the palette.
 */
const LEG_INKS: readonly string[] = [
  "--color-terracotta-700",
  "--color-sage-700",
  "--color-terracotta",
  "--color-neutral-700",
  "--color-sage-600",
  "--color-terracotta-900",
];

export function legInk(index: number): string {
  return LEG_INKS[index % LEG_INKS.length] ?? LEG_INKS[0] ?? "--color-terracotta-700";
}
