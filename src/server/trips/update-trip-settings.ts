import { daysBetween } from "@/core/time/zoned";
import type { SettingsUpdated, TripRepository } from "../repositories/trip-repository";
import { DEFAULT_START_AT_MINUTES } from "./day-start";
import type { TripSettings } from "./trip-settings-input";

/**
 * Applies what the traveller changed. They pick the two ends of the trip and
 * storage counts the days between them, which is the only place the two ways of
 * saying the same thing meet.
 *
 * Days keep their stops when the dates move underneath them, because moving a
 * trip forward a week does not change what is planned on its second day. That
 * is free now: a day's date is its position added to the trip's first day, so
 * moving the trip writes one column however long it is.
 *
 * Pulling the last day earlier is the one destructive edit: the days past the
 * new end go, and the stops on them go with them, which is why the form says
 * how many before it is submitted.
 */
export function updateTripSettings(
  change: TripSettings,
  editKeyHash: string,
  repository: TripRepository,
): Promise<SettingsUpdated> {
  return repository.updateSettings({
    slug: change.slug,
    editKeyHash,
    title: change.title,
    startDate: change.startDate,
    dayCount: daysBetween(change.startDate, change.endDate) + 1,
    startAtMinutes: DEFAULT_START_AT_MINUTES,
  });
}
