import type { TravelMode } from "@/core/model/leg";

/**
 * How each way of getting somewhere is drawn, in one table.
 *
 * The map and the key beside it read from the same row, so a line on the map
 * and the sample in the key can never drift apart. The mode is carried by the
 * stroke pattern as well as by the colour, and every leg says its mode in words
 * in the list, so the pattern is a reminder rather than the only source.
 *
 * Flights are the one mode Google offers that this table does not: a day in a
 * city is planned point to point on the ground, and the engine has no flight to
 * estimate. Adding one is a change to the travel provider first.
 */
export interface RouteStroke {
  readonly mode: TravelMode;
  /** The words in the key. Google's own name for the mode, where it has one. */
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
    label: "Driving",
    colorProperty: "--color-terracotta-700",
    inkClass: "text-terracotta-700",
    weight: 3.4,
    dashArray: null,
    roundCaps: false,
    drawn: { kind: "solid" },
  },
  transit: {
    mode: "transit",
    label: "Public transport",
    colorProperty: "--color-sage-700",
    inkClass: "text-sage-700",
    weight: 3.4,
    dashArray: "11 6",
    roundCaps: false,
    drawn: { kind: "dashes", scale: 3, repeat: "17px" },
  },
  walk: {
    mode: "walk",
    label: "Walking",
    colorProperty: "--color-terracotta-600",
    inkClass: "text-terracotta-600",
    weight: 4,
    dashArray: "0.5 8",
    roundCaps: true,
    drawn: { kind: "dots", repeat: "9px" },
  },
  cycle: {
    mode: "cycle",
    label: "Cycling",
    colorProperty: "--color-neutral-700",
    inkClass: "text-neutral-700",
    weight: 3.4,
    dashArray: "6 5",
    roundCaps: false,
    drawn: { kind: "dashes", scale: 1.6, repeat: "10px" },
  },
};

/** In the order Google lists them, which is the order the key is read in. */
export const ROUTE_STROKES: readonly RouteStroke[] = [
  STROKES.drive,
  STROKES.transit,
  STROKES.walk,
  STROKES.cycle,
];

/** Total by construction: the table has a row for every mode there is. */
export function routeStroke(mode: TravelMode): RouteStroke {
  return STROKES[mode];
}
