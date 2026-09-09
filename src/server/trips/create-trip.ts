import type { IsoDate } from "@/core/model/day";
import type { LatLng, Place } from "@/core/model/place";
import { createEditKey, hashEditKey } from "../ownership/edit-key";
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
  /** What that city is called, so the product can name it rather than point. */
  readonly cityName: string | null;
  /**
   * Where the first day begins, or null when the traveller skipped the
   * question. It is the trip's first checkpoint: somewhere the day sets off
   * from rather than somewhere it spends time.
   */
  readonly startPlace: Place | null;
}

export interface CreatedTripResult {
  readonly slug: string;
  /**
   * Goes into the edit link and nowhere else. This is the only moment it exists
   * in the clear, so a caller that loses it cannot ask for it again.
   */
  readonly editKey: string;
}

/**
 * Opens a trip and hands back the one key that authorises changes to it.
 *
 * The days come out empty apart from the one thing the traveller may have been
 * asked: where the first of them begins. Every other end of every other day is
 * left unset, because at this point nobody knows where they are staying or
 * whether they are staying anywhere at all.
 */
export async function createTrip(
  request: NewTripRequest,
  repository: TripRepository,
): Promise<CreatedTripResult> {
  const editKey = createEditKey();
  const { slug } = await repository.create({
    title: request.title,
    timeZone: request.timeZone,
    startDate: request.startDate,
    dayCount: request.dayCount,
    centre: request.centre,
    cityName: request.cityName,
    startPlace: request.startPlace,
    startAtMinutes: DEFAULT_START_AT_MINUTES,
    editKeyHash: hashEditKey(editKey),
  });
  return { slug, editKey };
}
