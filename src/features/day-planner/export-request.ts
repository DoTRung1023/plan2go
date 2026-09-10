/**
 * What the traveller asked to take away on paper. The format is not in here
 * because there is one: the browser's print window, where saving as a PDF is.
 */
export interface ExportRequest {
  /** The days to put on paper, in the trip's own order. */
  readonly dayIds: readonly string[];
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
    request.map ? "map" : "",
    request.notes ? "notes" : "",
    request.legDetails ? "legs" : "",
  ].join("|");
}
