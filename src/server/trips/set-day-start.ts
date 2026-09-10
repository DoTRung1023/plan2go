import type { DayId } from "@/core/model/day";
import { MINUTES_PER_DAY } from "@/core/time/minutes";
import type { DayStartSet, TripRepository } from "../repositories/trip-repository";

export interface SetDayStartRequest {
  readonly slug: string;
  /** The hash of the key out of the edit link. No key, no write. */
  readonly editKeyHash: string;
  readonly dayId: DayId;
  /** Minutes from local midnight. */
  readonly startAtMinutes: number;
}

/**
 * Change when a day begins.
 *
 * Nothing is recalculated here. The start is the only thing stored, and every
 * time on the day follows from it the next time the day is read, so a start
 * and the times built on it cannot be saved out of step with each other.
 *
 * Held to the day's own clock. A start past midnight is a different day, and
 * one before it is not a time at all.
 */
export function setDayStart(
  request: SetDayStartRequest,
  repository: TripRepository,
): Promise<DayStartSet> {
  const minutes = Math.round(request.startAtMinutes);
  return repository.setDayStart({
    slug: request.slug,
    editKeyHash: request.editKeyHash,
    dayId: request.dayId,
    startAtMinutes: Math.min(MINUTES_PER_DAY - 1, Math.max(0, minutes)),
  });
}
