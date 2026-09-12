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
  /** The hash of the key out of the edit link. No key, no write. */
  readonly editKeyHash: string;
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
 *
 * Everything that does not wait on anything else is asked for at once. Adding
 * a place is the slowest thing a person does often here, and it used to be
 * four waits one behind the other: the trip read, then the way in, then the
 * write, then the way out. The trip read has no bearing on which place this
 * is, and both legs are measured between points that are known before either
 * is written, so only the two writes are left in a line, and those have to be:
 * the first is what says the key is good.
 */
export async function addStopFromSearch(
  request: AddStopRequest,
  repository: TripRepository,
  provider: PlacesProvider,
  travel: TravelProvider,
): Promise<AddStopResult> {
  // The trip is read for the point the new leg starts at, which is a
  // different question from which place this is, so neither waits on the
  // other. The write below is still what authorises the change, so this tells
  // an outsider nothing they could not have read from the trip's own page.
  const [stored, trip] = await Promise.all([
    repository.findPlaceByProviderId(request.slug, request.providerPlaceId),
    repository.findBySlug(request.slug),
  ]);
  const place: Place | null =
    stored ?? (await provider.details(request.providerPlaceId, request.session));

  if (place === null) {
    return { status: "no-such-place" };
  }

  const day = trip?.days.find((candidate) => candidate.id === request.dayId);
  // A new last stop is also where the leg out to the day's end now starts
  // from, and the way home from somewhere else was an answer to a different
  // question. Asked again, the way every leg with new ends is. Both legs run
  // between points already known, so both are measured at once.
  const end = day?.end ?? null;
  const [wayIn, wayOut] = await Promise.all([
    fastestTravelMode(travelsFrom(day), place.position, travel),
    end === null ? null : fastestTravelMode(place.position, end.place.position, travel),
  ]);

  const added = await repository.addStop({
    slug: request.slug,
    editKeyHash: request.editKeyHash,
    dayId: request.dayId,
    place,
    stayMinutes: DEFAULT_STAY_MINUTES,
    travelMode: wayIn,
  });
  if (added.status === "refused") {
    return { status: "refused" };
  }

  if (wayOut !== null) {
    await repository.setLegMode({
      slug: request.slug,
      editKeyHash: request.editKeyHash,
      dayId: request.dayId,
      stopId: null,
      mode: wayOut,
    });
  }

  return { status: "added", placeName: place.name };
}
