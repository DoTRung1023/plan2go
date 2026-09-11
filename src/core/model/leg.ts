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
 *
 * Cycling is not one of them either, and for the nearer version of the same
 * reason: the Routes API returns no cycling route at all across much of the
 * world, so a mode that looked like the other three was in practice answered by
 * a straight line at an assumed speed. A number nobody can act on is worse than
 * a mode that was never offered. Adding it back means a provider that actually
 * covers it, behind the same port.
 */
export const TRAVEL_MODES = ["drive", "transit", "walk"] as const;

export type TravelMode = (typeof TRAVEL_MODES)[number];

/** Where an estimate came from, so the UI can say how trustworthy it is. */
export type TravelSource = "haversine" | "google-routes";

/**
 * What is ridden on a public transport leg, folded to the handful the product
 * has a word and a glyph for. Read off the list, like the modes, so storage
 * can check a row against it.
 */
export const TRANSIT_VEHICLES = ["bus", "tram", "train", "ferry", "other"] as const;

export type TransitVehicle = (typeof TRANSIT_VEHICLES)[number];

/**
 * One vehicle ridden on a public transport leg, boarding to alighting.
 *
 * The line is what is written on the front of the vehicle and on the stop, and
 * the headsign is where it says it is going, which between them are how a
 * traveller standing at a stop tells the right one from the others. No times:
 * nothing here is asked for a departure time, so an answer is the service
 * running when it was asked, and a time on it would be a promise nobody made.
 */
export interface TransitRide {
  readonly vehicle: TransitVehicle;
  /** "GLNELG", "190", "Seaford". Null when the provider names no line. */
  readonly line: string | null;
  readonly headsign: string | null;
  readonly boardAt: string | null;
  readonly alightAt: string | null;
  /** Stops ridden through, counting the one alighted at. Null when unknown. */
  readonly stops: number | null;
  /** Whole minutes on board. */
  readonly durationMinutes: number;
}

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
  /**
   * What is ridden, in order, when the mode is public transport and the
   * provider broke the journey into vehicles. Null for every other mode, and
   * for a provider that only knows the total.
   */
  readonly rides: readonly TransitRide[] | null;
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
