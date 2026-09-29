import { colorsAfterMove } from "@/core/model/city-colors";
import type { DayId } from "@/core/model/day";
import type { LatLng } from "@/core/model/place";
import { cityRun } from "@/core/model/day-city";
import type { PlacesProvider } from "@/core/ports/places-provider";
import { placeDetailsFor } from "../places/place-details";
import type { TripRepository } from "../repositories/trip-repository";

export interface SetDayCityRequest {
  readonly slug: string;
  /** The hash of the key out of the edit link. No key, no write. */
  readonly editKeyHash: string;
  readonly dayId: DayId;
  /** The city chosen, as the provider knows it. */
  readonly providerPlaceId: string;
}

/** The city the days are in now, as it was written to them. */
export interface CitySet {
  readonly providerPlaceId: string;
  readonly name: string;
  readonly position: LatLng;
}

export type SetDayCityResult =
  | { readonly status: "set"; readonly city: CitySet; readonly days: number }
  | { readonly status: "refused" }
  | { readonly status: "no-such-city" };

/**
 * Move a day to another city, and with it the days after it that were in the
 * same city as it and have nothing planned on them yet, up to the first that
 * was somewhere else or has a stop on it.
 *
 * The city is looked up rather than trusted from the page, so the map opens
 * where it actually is, and from our own table when it was looked up lately,
 * which a city chosen on the front page or for another day will have been.
 * Nothing on the days moves: a stop is a place, and it stays where it is.
 *
 * The trip is read first to know which days move. It is not the
 * authorisation: that is the key, and it is checked inside the query that
 * does the writing.
 */
export async function setDayCity(
  request: SetDayCityRequest,
  repository: TripRepository,
  places: PlacesProvider,
): Promise<SetDayCityResult> {
  const trip = await repository.findBySlug(request.slug);
  const moving = trip === null ? [] : cityRun(trip.days, request.dayId);
  if (moving.length === 0) {
    return { status: "refused" };
  }

  const city = await placeDetailsFor(request.providerPlaceId, places, null);
  if (city === null) {
    return { status: "no-such-city" };
  }

  const providerPlaceId = city.providerPlaceId ?? request.providerPlaceId;
  const set: CitySet = { providerPlaceId, name: city.name, position: city.position };
  const written = await repository.setDayCity({
    slug: request.slug,
    editKeyHash: request.editKeyHash,
    dayIds: moving,
    city: set,
    colors: colorsAfterMove(trip?.days ?? [], request.dayId, { providerPlaceId, name: city.name }),
  });

  return written.status === "set"
    ? { status: "set", city: set, days: moving.length }
    : { status: "refused" };
}
