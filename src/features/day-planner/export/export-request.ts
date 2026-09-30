import type { Ink, MapSize, Orientation, PaperSize, TextSize } from "./paper";

/**
 * What the traveller asked to take away on paper. The format is not in here
 * because there is one: the browser's print window, where saving as a PDF is.
 */
export interface ExportRequest {
  /**
   * The days to put on paper, in the trip's own order, each on a sheet of its
   * own. None when the cover alone is asked for, as the trip at a glance.
   */
  readonly dayIds: readonly string[];
  /** A sheet in front of the days: the trip's name, its dates, and every day at a glance. */
  readonly cover: boolean;
  /** A map of each day above its list. */
  readonly map: boolean;
  /** How much of the sheet the map takes. */
  readonly mapSize: MapSize;
  /** The note written on each stop. */
  readonly notes: boolean;
  /** How each stop is reached from the one before: the way, how long, how far. */
  readonly legs: boolean;
  /** The street address under each place. */
  readonly addresses: boolean;
  /** A ruled sheet after each day, for writing on. */
  readonly ruled: boolean;
  /** When each place is open, under its address. */
  readonly hours: boolean;
  /**
   * What is wrong with a visit, a place closed that day or shut before the
   * stop is done, said under the stop it is about.
   */
  readonly warnings: boolean;
  /** The paper the sheets are made for, and which way up. */
  readonly paper: PaperSize;
  readonly orientation: Orientation;
  /** How big the words are, for eyes and for paper that is small. */
  readonly text: TextSize;
  /** In the map's colours, or in ink alone for a printer without any. */
  readonly ink: Ink;
}

/**
 * What the export is until anything is chosen: everything there is to put on
 * the page, the cover and a ruled sheet after each day among it, so what the
 * window opens on is the whole trip and a choice only ever takes away.
 */
export const DEFAULT_EXPORT: Omit<ExportRequest, "dayIds"> = {
  cover: true,
  map: true,
  mapSize: "large",
  notes: true,
  legs: true,
  addresses: true,
  ruled: true,
  hours: true,
  warnings: true,
  paper: "a4",
  orientation: "portrait",
  text: "medium",
  ink: "colour",
};

/** One string per distinct request, for telling one set of sheets from the next. */
export function exportRequestKey(request: ExportRequest): string {
  return [
    request.dayIds.join(","),
    request.cover ? "cover" : "",
    request.map ? `map-${request.mapSize}` : "",
    request.notes ? "notes" : "",
    request.legs ? "legs" : "",
    request.addresses ? "addresses" : "",
    request.ruled ? "ruled" : "",
    request.hours ? "hours" : "",
    request.warnings ? "warnings" : "",
    request.paper,
    request.orientation,
    request.text,
    request.ink,
  ].join("|");
}
