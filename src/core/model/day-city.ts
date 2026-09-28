import type { DayCity, DayId, DayPlan } from "./day";

/** What tells one city from another: where it is does not come into it. */
export type CityIdentity = Pick<DayCity, "providerPlaceId" | "name">;

/**
 * Whether two days are in the same city. By the provider's identifier when
 * both have one, since two cities can share a name; by name when either is a
 * city kept from before identifiers were, which is the only thing known
 * about it. Two days with no city at all are in the same nowhere.
 */
export function sameCity(a: CityIdentity | null, b: CityIdentity | null): boolean {
  if (a === null || b === null) {
    return a === b;
  }
  if (a.providerPlaceId !== null && b.providerPlaceId !== null) {
    return a.providerPlaceId === b.providerPlaceId;
  }
  return a.name === b.name;
}

/**
 * The days that move when one day is moved to another city: that day, and
 * every day straight after it that was in the same city, up to the first
 * that was somewhere else.
 *
 * A trip is planned as runs of days in one city, so moving the first day of
 * a run is moving the run, and the traveller should not have to move each
 * day of it by hand. Days before the one moved stay where they are: nobody
 * changing Thursday means Monday too. Empty when the day is not on the trip.
 */
export function cityRun(days: readonly DayPlan[], dayId: DayId): readonly DayId[] {
  const from = days.findIndex((day) => day.id === dayId);
  const first = days[from];
  if (first === undefined) {
    return [];
  }

  const run: DayId[] = [];
  for (const day of days.slice(from)) {
    if (!sameCity(day.city, first.city)) {
      break;
    }
    run.push(day.id);
  }
  return run;
}

/**
 * Every city the trip goes to, once each, in the order the trip reaches it.
 * A city left and come back to is listed where it was first reached.
 */
export function citiesOf(days: readonly DayPlan[]): readonly DayCity[] {
  const cities: DayCity[] = [];
  for (const day of days) {
    if (day.city !== null && !cities.some((city) => sameCity(city, day.city))) {
      cities.push(day.city);
    }
  }
  return cities;
}
