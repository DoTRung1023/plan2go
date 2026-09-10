import type { TravelMode } from "@/core/model/leg";

/**
 * How each way of getting somewhere is drawn, in one table.
 *
 * The map and the key beside it read from the same row, so a line on the map
 * and the sample in the key can never drift apart.
 *
 * Only walking is patterned. Three broken lines crossing one another read as
 * texture rather than as three routes, so the rest are drawn continuous and
 * the colour is what tells them apart. Walking keeps its dots because a route
 * made of separated marks is the one that says "on foot" without being told,
 * and every leg says its mode in words in the list besides.
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
  /** Read at runtime, because Google is handed a colour and not a class. */
  readonly colorProperty: string;
  /** Paints the same colour in the key. */
  readonly inkClass: string;
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
    // The accent at its pressed weight. Routes were kept off terracotta for a
    // while, on the argument that a line in the product's own colour reads as
    // the line the product is recommending; the design canvas puts them back on
    // it, and the argument does not survive contact with the drawing. What a
    // route is is settled by the pattern and the key beside it, and a map whose
    // ground, markers and lines are all one family reads as one thing rather
    // than as a chart that happens to be over a map.
    label: "Driving",
    colorProperty: "--color-terracotta-700",
    inkClass: "text-terracotta-700",
    weight: 4.6,
    dashArray: null,
    roundCaps: false,
    drawn: { kind: "solid" },
  },
  transit: {
    mode: "transit",
    // Sage, the second voice, which is the one thing on the map that is not a
    // shade of the accent and is therefore the line told apart at a glance.
    label: "Transport",
    colorProperty: "--color-sage-700",
    inkClass: "text-sage-700",
    weight: 4.6,
    dashArray: null,
    roundCaps: false,
    drawn: { kind: "solid" },
  },
  walk: {
    mode: "walk",
    label: "Walking",
    // One step up the accent from driving. The two are close on purpose: the
    // pattern is what separates them, and it is the strongest signal of the
    // three, because a line of separated marks is the one that says "on foot"
    // without being read.
    colorProperty: "--color-terracotta-600",
    inkClass: "text-terracotta-600",
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
