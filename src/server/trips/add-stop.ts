import type { DayId } from "@/core/model/day";
import type { PlacesProvider } from "@/core/ports/places-provider";
import type { TripRepository } from "../repositories/trip-repository";

/** A new stop gets an hour, until the traveller says otherwise. */
const DEFAULT_STAY_MINUTES = 60;

export interface AddStopRequest {
  readonly slug: string;
  readonly dayId: DayId;
  readonly providerPlaceId: string;
  readonly session: string | null;
}

export type AddStopResult =
  | { readonly status: "added"; readonly placeName: string }
  | { readonly status: "no-such-day" }
  | { readonly status: "no-such-place" };

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
): Promise<AddStopResult> {
  const stored = await repository.findPlaceByProviderId(request.slug, request.providerPlaceId);
  const place = stored ?? (await provider.details(request.providerPlaceId, request.session));

  if (place === null) {
    return { status: "no-such-place" };
  }

  const added = await repository.addStop({
    slug: request.slug,
    dayId: request.dayId,
    place,
    stayMinutes: DEFAULT_STAY_MINUTES,
    travelMode: "walk",
  });

  return added.status === "no-such-day"
    ? { status: "no-such-day" }
    : { status: "added", placeName: place.name };
}
