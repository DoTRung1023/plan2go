import type { DayEndpoint, DayId, DayPlan } from "@/core/model/day";
import type { Place } from "@/core/model/place";
import type { PlacesProvider } from "@/core/ports/places-provider";
import type { TravelProvider } from "@/core/ports/travel-provider";
import type { Trip } from "@/core/model/trip";
import type { DayEnd, TripRepository } from "../repositories/trip-repository";
import { refreshLegModes } from "./leg-modes";

export interface SetDayEndpointRequest {
  readonly slug: string;
  /** The hash of the key out of the edit link. No key, no write. */
  readonly editKeyHash: string;
  readonly dayId: DayId;
  readonly which: DayEnd;
  /** Null clears that end, so the day goes back to beginning at its first stop. */
  readonly providerPlaceId: string | null;
  /** What the traveller calls the point, "Hotel", or null to leave it unnamed. */
  readonly label: string | null;
  readonly session: string | null;
}

export type SetDayEndpointResult =
  | { readonly status: "set"; readonly placeName: string | null }
  | { readonly status: "refused" }
  | { readonly status: "no-such-place" };

/** The day with one of its ends changed, which is what the legs are refreshed against. */
function withEnd(day: DayPlan, which: DayEnd, endpoint: DayEndpoint | null): DayPlan {
  return which === "start" ? { ...day, start: endpoint } : { ...day, end: endpoint };
}

/**
 * Put the fastest mode on whichever leg now runs to or from the changed end.
 *
 * A start point gives the first stop a leg it did not have, and an end point
 * gives the last stop one out. Neither has a mode yet that means anything, so
 * each is answered the way a moved stop's leg is: every way is asked and the
 * quickest is taken, as a starting point the traveller can change. Taking an
 * end off changes no leg that is left, and nothing is asked.
 */
async function refreshLegsAt(
  request: SetDayEndpointRequest,
  before: DayPlan,
  which: DayEnd,
  endpoint: DayEndpoint | null,
  repository: TripRepository,
  travel: TravelProvider,
): Promise<void> {
  await refreshLegModes(
    {
      slug: request.slug,
      editKeyHash: request.editKeyHash,
      before,
      after: withEnd(before, which, endpoint),
    },
    repository,
    travel,
  );
}

/**
 * Where a day ends is, ordinarily, where the next one starts, so setting one
 * offers it to the other.
 *
 * Offered and not imposed. It is only written when the next day has nothing of
 * its own, so a night train that finishes Tuesday in Hanoi and begins Wednesday
 * in Hue is left exactly as the traveller set it, and changing where a day ends
 * later never reaches forward and overwrites a decision already made.
 */
async function offerToTheNextDay(
  request: SetDayEndpointRequest,
  endpoint: DayEndpoint,
  trip: Trip,
  repository: TripRepository,
  travel: TravelProvider,
): Promise<void> {
  const at = trip.days.findIndex((day) => day.id === request.dayId);
  const next = at === -1 ? undefined : trip.days[at + 1];
  if (next === undefined || next.start !== null) {
    return;
  }

  await repository.setDayEndpoint({
    slug: request.slug,
    editKeyHash: request.editKeyHash,
    dayId: next.id,
    which: "start",
    place: endpoint.place,
    label: endpoint.label,
  });
  await refreshLegsAt(request, next, "start", endpoint, repository, travel);
}

/**
 * Set where a day begins or where it finishes.
 *
 * These two are the only checkpoints a trip has: a point the day passes through
 * on its way, taking none of the day's time, as against a stop, which is one of
 * the things the day is actually for.
 *
 * The trip's own copy of the place is checked before the provider, so the
 * details call is paid for once per place per trip. A hotel that is the end of
 * five days and the start of five more is looked up once.
 */
export async function setDayEndpoint(
  request: SetDayEndpointRequest,
  repository: TripRepository,
  provider: PlacesProvider,
  travel: TravelProvider,
): Promise<SetDayEndpointResult> {
  let place: Place | null = null;

  if (request.providerPlaceId !== null) {
    const stored = await repository.findPlaceByProviderId(
      request.slug,
      request.providerPlaceId,
    );
    place = stored ?? (await provider.details(request.providerPlaceId, request.session));
    if (place === null) {
      return { status: "no-such-place" };
    }
  }

  // Read for the legs the change gives new ends to, and for the day after
  // this one. The write below is still what authorises the change, so this
  // tells an outsider nothing they could not have read from the trip's page.
  const trip = await repository.findBySlug(request.slug);
  const before = trip?.days.find((day) => day.id === request.dayId);

  const written = await repository.setDayEndpoint({
    slug: request.slug,
    editKeyHash: request.editKeyHash,
    dayId: request.dayId,
    which: request.which,
    place,
    label: request.label,
  });
  if (written.status === "refused") {
    return { status: "refused" };
  }

  const endpoint: DayEndpoint | null =
    place === null ? null : { place, label: request.label };
  if (before !== undefined) {
    await refreshLegsAt(request, before, request.which, endpoint, repository, travel);
  }

  if (request.which === "end" && endpoint !== null && trip !== null) {
    await offerToTheNextDay(request, endpoint, trip, repository, travel);
  }

  return { status: "set", placeName: place?.name ?? null };
}
