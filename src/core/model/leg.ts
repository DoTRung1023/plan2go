import type { LatLng } from "./place";

/**
 * Every way of getting from one point to the next, in the order they are
 * offered. The type is read off the list rather than written twice, so a mode
 * that is added here is a mode every exhaustive table in the product has to
 * answer for.
 *
 * Flying is not one of them. Nobody sells us flight availability, the Routes
 * API has no such mode, and a straight line at an assumed speed offered a
 * flight between any two points on earth, which was worse than not offering one
 * at all.
 */
export const TRAVEL_MODES = ["drive", "transit", "walk", "cycle"] as const;

export type TravelMode = (typeof TRAVEL_MODES)[number];

/** Where an estimate came from, so the UI can say how trustworthy it is. */
export type TravelSource = "haversine" | "google-routes";

export interface TravelEstimate {
  readonly mode: TravelMode;
  /** Whole minutes. Providers round before returning. */
  readonly durationMinutes: number;
  /** Whole metres. */
  readonly distanceMeters: number;
  readonly source: TravelSource;
  /**
   * The shape of the route, in order, when the provider knows it. Null when it
   * does not, and whoever draws it falls back to the line between the two ends.
   * The engine ignores this: a leg takes as long as it takes whichever way it
   * is drawn on a map.
   */
  readonly path: readonly LatLng[] | null;
}

/** Why a leg could not be estimated, kept for the message shown to the user. */
export type UnresolvedReason =
  | "provider-unavailable"
  | "no-route"
  | "missing-coordinates"
  | "not-requested";

/**
 * A leg is either estimated or explicitly unresolved. There is no third state,
 * so the time engine never has to guess what a missing number meant.
 */
export type LegResolution =
  | { readonly status: "resolved"; readonly estimate: TravelEstimate }
  | { readonly status: "unresolved"; readonly reason: UnresolvedReason };

export interface TravelRequest {
  readonly from: LatLng;
  readonly to: LatLng;
  readonly mode: TravelMode;
}
