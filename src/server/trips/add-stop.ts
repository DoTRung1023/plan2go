import type { DayId, DayPlan } from "@/core/model/day";
import type { TravelMode } from "@/core/model/leg";
import type { LatLng, Place } from "@/core/model/place";
import type { Stop } from "@/core/model/stop";
import type { PlacesProvider } from "@/core/ports/places-provider";
import type { TravelProvider } from "@/core/ports/travel-provider";
import { legPoints } from "@/core/time/day-points";
import { answerLegsInOrder, legRequestsFor } from "@/core/time/leg-requests";
import { editKeyHashMatches } from "../ownership/edit-key";
import type { TripRepository } from "../repositories/trip-repository";
import type { TravelFor } from "./leg-modes";
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
  const toNew = legPoints(next).length - (day.end === null ? 1 : 2);
  if (toNew < 0) {
    return null;
  }

  const answered = await answerLegsInOrder(next, (request) => travel.estimate(request), toNew);
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
 * The quickest way to a new last stop, asked at the moment the day will set
 * out on it, which is known already, so the page drawn after this finds the
 * answer kept.
 */
async function wayInTo(
  day: DayPlan | undefined,
  place: Place,
  travel: TravelProvider,
): Promise<TravelMode> {
  const leaves = day === undefined ? null : await momentToReach(day, place, travel);
  return fastestTravelMode(travelsFrom(day), place.position, travel, leaves);
}

/**
 * Put a searched place onto a day.
 *
 * The trip's own copy is checked first, so the details call is paid for once
 * per place per trip and never again, which is also what lets a saved trip be
 * rendered years later without touching the provider.
 *
 * The key is checked before anything is spent. Nothing here is paid for, a
 * details call, a leg of the day timed, or a way in or out measured, until the
 * key has been compared with the trip's own, so a plain link with a made up
 * key costs three reads of our own tables and is turned away. The write below
 * checks the key again, and is still what authorises the change.
 *
 * Everything that does not wait on anything else is asked for at once. Adding
 * a place is the slowest thing a person does often here: the trip, the key
 * and the trip's copy of the place are read together, then the place and what
 * is already known about the day's legs, then the way in and the way out. The
 * way out runs between points known before anything is measured, so it does
 * not wait for the way in's moment to be worked out. Only the two writes are
 * left in a line, and those have to be: the first is what says the key is good.
 */
export async function addStopFromSearch(
  request: AddStopRequest,
  repository: TripRepository,
  provider: PlacesProvider,
  travelFor: TravelFor,
): Promise<AddStopResult> {
  const [storedHash, stored, trip] = await Promise.all([
    repository.findEditKeyHash(request.slug),
    repository.findPlaceByProviderId(request.slug, request.providerPlaceId),
    repository.findBySlug(request.slug),
  ]);
  if (storedHash === null || !editKeyHashMatches(request.editKeyHash, storedHash)) {
    return { status: "refused" };
  }

  // Only the day the stop goes on is timed, so only its legs are read.
  const day = trip?.days.find((candidate) => candidate.id === request.dayId);
  const [place, travel] = await Promise.all([
    stored ?? provider.details(request.providerPlaceId, request.session),
    travelFor(day === undefined ? [] : [day]),
  ]);
  if (place === null) {
    return { status: "no-such-place" };
  }

  // A new last stop is also where the leg out to the day's end now starts
  // from, and the way home from somewhere else was an answer to a different
  // question. Asked again, the way every leg with new ends is. Its moment
  // turns on which way in wins, so it is asked with none rather than behind
  // the way in: waiting on it would put a second question to the provider
  // behind the first.
  const end = day?.end ?? null;
  const [wayIn, wayOut] = await Promise.all([
    wayInTo(day, place, travel),
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
