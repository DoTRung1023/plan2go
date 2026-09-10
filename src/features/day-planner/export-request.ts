/**
 * What the traveller asked to take away on paper. The format is not in here
 * because there is one: the browser's print window, where saving as a PDF is.
 */
export interface ExportRequest {
  /** The days to put on paper, in the trip's own order. */
  readonly dayIds: readonly string[];
  /**
   * Each day starting a sheet of its own, which is the usual way, or the days
   * running on one after another, which spends less paper on short days. A
   * day too long for one sheet runs onto a second either way.
   */
  readonly separateSheets: boolean;
  /** A map of each day above its list. */
  readonly map: boolean;
  /** The note written on each stop. */
  readonly notes: boolean;
  /** How far each leg is, beside how long it takes. */
  readonly legDetails: boolean;
}

/** One string per distinct request, for telling one sheet from the next. */
export function exportRequestKey(request: ExportRequest): string {
  return [
    request.dayIds.join(","),
    request.separateSheets ? "separate" : "flow",
    request.map ? "map" : "",
    request.notes ? "notes" : "",
    request.legDetails ? "legs" : "",
  ].join("|");
}
