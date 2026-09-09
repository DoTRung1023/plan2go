import type { DayId } from "@/core/model/day";
import type { Place } from "@/core/model/place";
import type { PlacesProvider } from "@/core/ports/places-provider";
import type { DayEnd, TripRepository } from "../repositories/trip-repository";

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
  place: Place,
  repository: TripRepository,
): Promise<void> {
  const trip = await repository.findBySlug(request.slug);
  if (trip === null) {
    return;
  }

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
    place,
    label: request.label,
  });
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

  if (request.which === "end" && place !== null) {
    await offerToTheNextDay(request, place, repository);
  }

  return { status: "set", placeName: place?.name ?? null };
}
