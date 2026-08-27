import type { IsoDate } from "@/core/model/day";
import { clockToMinutes } from "@/core/time/minutes";
import { createEditToken, hashEditToken } from "../ownership/edit-token";
import type { TripRepository } from "../repositories/trip-repository";

/** A new day begins at 9:00 am until the traveller says otherwise. */
const DEFAULT_START_AT_MINUTES = clockToMinutes(9, 0);

export interface NewTripRequest {
  /** The city, as the traveller wrote it. */
  readonly title: string;
  readonly timeZone: string;
  readonly startDate: IsoDate;
  readonly dayCount: number;
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
    startAtMinutes: DEFAULT_START_AT_MINUTES,
    editTokenHash: hashEditToken(editToken),
  });
  return { slug, editToken };
}
