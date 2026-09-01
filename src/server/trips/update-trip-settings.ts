import type { SettingsUpdated, TripRepository } from "../repositories/trip-repository";
import { DEFAULT_START_AT_MINUTES } from "./day-start";
import type { TripSettings } from "./trip-settings-input";

export interface TripSettingsChange extends TripSettings {
  readonly slug: string;
}

/**
 * Applies what the traveller changed. Days keep their stops when the dates move
 * underneath them, because moving a trip forward a week does not change what is
 * planned on its second day. Shortening a trip is the one destructive edit: the
 * days past the new end go, and the stops on them go with them, which is why
 * the form says how many before it is submitted.
 */
export function updateTripSettings(
  change: TripSettingsChange,
  repository: TripRepository,
): Promise<SettingsUpdated> {
  return repository.updateSettings({
    slug: change.slug,
    title: change.title,
    timeZone: change.timeZone,
    startDate: change.startDate,
    dayCount: change.dayCount,
    startAtMinutes: DEFAULT_START_AT_MINUTES,
  });
}
