import type { DayId, DayPlan } from "@/core/model/day";
import type { LegResolution } from "@/core/model/leg";
import type { LatLng, Place } from "@/core/model/place";
import type { Stop } from "@/core/model/stop";
import type { Trip } from "@/core/model/trip";
import type { PlacesProvider } from "@/core/ports/places-provider";
import type { TravelProvider } from "@/core/ports/travel-provider";
import { legRequestsFor } from "@/core/time/leg-requests";
import type { TripRepository } from "../repositories/trip-repository";
import { fastestTravelMode } from "./leg-modes";

/** A new stop gets an hour, until the traveller says otherwise. */
const DEFAULT_STAY_MINUTES = 60;

/** What the new stop goes by while it is only being measured, before storage gives it an id. */
const MEASURED_ID = "being-added";

/**
 * The moment the day will set out for a new last stop, in minutes since the
 * epoch, found the way the page finds it when it next draws the day: the stop
 * put on the end, each leg before it answered the way the day travels it, and
 * the answers handed back to the engine as it goes. Null when nothing travels
 * to the new stop, or the moment cannot be worked out.
 *
 * Known before the leg is asked about, because a leg sets out when the one
 * before it has arrived and the stay there is over, and none of that is about
 * the new stop. So the way to it can be asked at its own moment, and what is
 * paid for here is what the page then finds rather than asks for again.
 */
export async function momentToReach(
  day: DayPlan,
  place: Place,
  travel: TravelProvider,
): Promise<number | null> {
  // Whichever way the new stop is reached, the day sets out for it at the
  // same moment, so the way it is given here does not matter.
  const stop: Stop = {
    id: MEASURED_ID,
    place,
    stayMinutes: DEFAULT_STAY_MINUTES,
    travelMode: "walk",
    note: null,
  };
  const next: DayPlan = { ...day, stops: [...day.stops, stop] };
  const toNew = legRequestsFor(next).length - (day.end === null ? 1 : 2);
  if (toNew < 0) {
    return null;
  }

  const answered: LegResolution[] = [];
  for (let index = 0; index < toNew; index += 1) {
    const request = legRequestsFor(next, answered)[index];
    if (request === undefined) {
      return null;
    }
    answered.push(await travel.estimate(request));
  }
  return legRequestsFor(next, answered)[toNew]?.departAt ?? null;
}

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
 *
 * The travel provider is made for the trip once it has been read, so every
 * leg already on the day is answered from one read of our own table rather
 * than one read a leg, which is what finding the way in's moment asks for.
 */
export async function addStopFromSearch(
  request: AddStopRequest,
  repository: TripRepository,
  provider: PlacesProvider,
  travelFor: (trip: Trip | null) => Promise<TravelProvider>,
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
  const travel = await travelFor(trip);
  // The way in is asked at the moment the day will set out on it, which is
  // known already, so the page drawn after this finds the answer kept. The
  // way out's moment turns on which way in wins, so it is asked with none,
  // as before, rather than after the way in has been answered: waiting on
  // it would put a second question to the provider behind the first.
  const leaves = day === undefined ? null : await momentToReach(day, place, travel);
  // A new last stop is also where the leg out to the day's end now starts
  // from, and the way home from somewhere else was an answer to a different
  // question. Asked again, the way every leg with new ends is. Both legs run
  // between points already known, so both are measured at once.
  const end = day?.end ?? null;
  const [wayIn, wayOut] = await Promise.all([
    fastestTravelMode(travelsFrom(day), place.position, travel, leaves),
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
