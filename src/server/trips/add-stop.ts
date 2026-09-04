import type { DayId, DayPlan } from "@/core/model/day";
import type { LatLng, Place } from "@/core/model/place";
import type { PlacesProvider } from "@/core/ports/places-provider";
import type { TravelProvider } from "@/core/ports/travel-provider";
import type { TripRepository } from "../repositories/trip-repository";
import { fastestTravelMode } from "./leg-modes";

/** A new stop gets an hour, until the traveller says otherwise. */
const DEFAULT_STAY_MINUTES = 60;

export interface AddStopRequest {
  readonly slug: string;
  /** Every token this browser holds. The write finds nothing without one. */
  readonly editTokenHashes: readonly string[];
  readonly dayId: DayId;
  readonly providerPlaceId: string;
  readonly session: string | null;
}

export type AddStopResult =
  | { readonly status: "added"; readonly placeName: string }
  | { readonly status: "refused" }
  | { readonly status: "no-such-place" };

/**
 * Where the leg to a new stop starts: the stop before it, or the point the day
 * starts at when there is none. Null when the day begins at this stop, which
 * means nothing travels to it and there is no mode to choose.
 */
function travelsFrom(day: DayPlan | undefined): LatLng | null {
  if (day === undefined) {
    return null;
  }
  const last = day.stops[day.stops.length - 1];
  if (last !== undefined) {
    return last.place.position;
  }
  return day.start === null ? null : day.start.place.position;
}

/**
 * Put a searched place onto a day.
 *
 * The trip's own copy is checked first, so the details call is paid for once
 * per place per trip and never again, which is also what lets a saved trip be
 * rendered years later without touching the provider.
 */
export async function addStopFromSearch(
  request: AddStopRequest,
  repository: TripRepository,
  provider: PlacesProvider,
  travel: TravelProvider,
): Promise<AddStopResult> {
  const stored = await repository.findPlaceByProviderId(request.slug, request.providerPlaceId);
  const place: Place | null =
    stored ?? (await provider.details(request.providerPlaceId, request.session));

  if (place === null) {
    return { status: "no-such-place" };
  }

  // Read for the point the new leg starts at. The write below is still what
  // authorises the change, so this tells an outsider nothing they could not
  // have read from the trip's own page.
  const trip = await repository.findBySlug(request.slug);
  const day = trip?.days.find((candidate) => candidate.id === request.dayId);

  const added = await repository.addStop({
    slug: request.slug,
    editTokenHashes: request.editTokenHashes,
    dayId: request.dayId,
    place,
    stayMinutes: DEFAULT_STAY_MINUTES,
    travelMode: await fastestTravelMode(travelsFrom(day), place.position, travel),
  });

  return added.status === "refused"
    ? { status: "refused" }
    : { status: "added", placeName: place.name };
}
