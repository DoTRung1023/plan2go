/**
 * The kinds of place a search can be narrowed to with one press rather than
 * by typing. Named here, with nothing about how any provider finds them, so
 * the list the reader is offered and the list the server will answer are the
 * same list.
 */
export const PLACE_KINDS = [
  "cafe",
  "street-food",
  "museum",
  "temple",
  "market",
  "viewpoint",
  "park",
  "nightlife",
  "hotel",
  "shopping",
] as const;

export type PlaceKind = (typeof PLACE_KINDS)[number];
