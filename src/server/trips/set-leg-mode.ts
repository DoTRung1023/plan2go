import type { DayId } from "@/core/model/day";
import type { TravelMode } from "@/core/model/leg";
import type { LegModeSet, TripRepository } from "../repositories/trip-repository";

export interface SetLegModeRequest {
  readonly slug: string;
  /** Every token this browser holds. The write finds nothing without one. */
  readonly editTokenHashes: readonly string[];
  readonly dayId: DayId;
  /** The stop the leg arrives at, or null for the leg out to where the day ends. */
  readonly stopId: string | null;
  readonly mode: TravelMode;
}

/**
 * Change how one leg of a day is travelled.
 *
 * Nothing is recalculated here. The mode is the only thing stored, and the
 * times follow from it the next time the day is read, so a mode and the times
 * built on it cannot be saved out of step with each other.
 */
export function setLegMode(
  request: SetLegModeRequest,
  repository: TripRepository,
): Promise<LegModeSet> {
  return repository.setLegMode({
    slug: request.slug,
    editTokenHashes: request.editTokenHashes,
    dayId: request.dayId,
    stopId: request.stopId,
    mode: request.mode,
  });
}
