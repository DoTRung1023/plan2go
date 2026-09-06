import type { TripDeleted, TripRepository } from "../repositories/trip-repository";

export interface DeleteTripRequest {
  readonly slug: string;
  /** Every token this browser holds. The write finds nothing without one. */
  readonly editTokenHashes: readonly string[];
}

/**
 * Removes a trip for good.
 *
 * Nothing survives it: the days, the stops on them, the places they point at
 * and the trip itself all go, and the slug stops resolving, so a link already
 * handed out stops working. That is the whole difference between this and
 * starting another trip, which leaves the one being read exactly where it is.
 *
 * There is no undo behind this, which is why the button that calls it asks
 * first.
 */
export function deleteTrip(
  request: DeleteTripRequest,
  repository: TripRepository,
): Promise<TripDeleted> {
  return repository.delete({
    slug: request.slug,
    editTokenHashes: request.editTokenHashes,
  });
}
