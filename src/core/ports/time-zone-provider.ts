import type { LatLng } from "../model/place";

/**
 * Which zone's clock a point on the earth keeps.
 *
 * A trip needs one before it has any days, and the traveller has already said
 * which city they are going to, so nobody is asked a second time. Null when it
 * could not be worked out, which is a reason to fall back rather than to stop.
 */
export interface TimeZoneProvider {
  readonly name: string;
  lookup(point: LatLng): Promise<string | null>;
}
