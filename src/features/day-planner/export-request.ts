/**
 * What the traveller asked to take away on paper. The format is not in here
 * because there is one: the browser's print window, where saving as a PDF is.
 */
export interface ExportRequest {
  /** The days to put on paper, in the trip's own order, each on a sheet of its own. */
  readonly dayIds: readonly string[];
  /** A sheet in front of the days: the trip's name, its dates, and every day at a glance. */
  readonly cover: boolean;
  /** A map of each day above its list. */
  readonly map: boolean;
  /** The note written on each stop. */
  readonly notes: boolean;
  /** How each stop is reached from the one before: the way, how long, how far. */
  readonly legs: boolean;
  /** The street address under each place. */
  readonly addresses: boolean;
  /** A ruled sheet after each day, for writing on. */
  readonly ruled: boolean;
}

/** One string per distinct request, for telling one set of sheets from the next. */
export function exportRequestKey(request: ExportRequest): string {
  return [
    request.dayIds.join(","),
    request.cover ? "cover" : "",
    request.map ? "map" : "",
    request.notes ? "notes" : "",
    request.legs ? "legs" : "",
    request.addresses ? "addresses" : "",
    request.ruled ? "ruled" : "",
  ].join("|");
}
