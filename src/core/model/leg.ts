import type { LatLng } from "./place";

/**
 * Every way of getting from one point to the next, in the order they are
 * offered. The type is read off the list rather than written twice, so a mode
 * that is added here is a mode every exhaustive table in the product has to
 * answer for.
 */
export const TRAVEL_MODES = ["drive", "transit", "walk", "cycle", "flight"] as const;

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
