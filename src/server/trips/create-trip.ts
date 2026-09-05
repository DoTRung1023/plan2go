import type { IsoDate } from "@/core/model/day";
import type { LatLng } from "@/core/model/place";
import { createEditToken, hashEditToken } from "../ownership/edit-token";
import type { TripRepository } from "../repositories/trip-repository";
import { DEFAULT_START_AT_MINUTES } from "./day-start";

export interface NewTripRequest {
  /** What the traveller calls the trip. A trip is not one city. */
  readonly title: string;
  readonly timeZone: string;
  readonly startDate: IsoDate;
  readonly dayCount: number;
  /** The city the trip is in, for the map to open on. */
  readonly centre: LatLng | null;
}

export interface CreatedTripResult {
  readonly slug: string;
  /** Handed to the browser once as an httpOnly cookie. Never stored in the clear. */
  readonly editToken: string;
}

/**
 * Opens a trip and hands back the one token that authorises changes to it. The
 * days come out empty: no stops, and neither end of the day set, because at
 * this point nobody knows where the traveller is staying or whether they are
 * staying anywhere at all.
 */
export async function createTrip(
  request: NewTripRequest,
  repository: TripRepository,
): Promise<CreatedTripResult> {
  const editToken = createEditToken();
  const { slug } = await repository.create({
    title: request.title,
    timeZone: request.timeZone,
    startDate: request.startDate,
    dayCount: request.dayCount,
    centre: request.centre,
    startAtMinutes: DEFAULT_START_AT_MINUTES,
    editTokenHash: hashEditToken(editToken),
  });
  return { slug, editToken };
}
