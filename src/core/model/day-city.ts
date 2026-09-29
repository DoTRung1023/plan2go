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
 * every day straight after it that was in the same city and has nothing
 * planned on it yet, up to the first that was somewhere else or has a stop.
 *
 * A trip is planned as runs of days in one city, so moving the first day of
 * a run is moving the run, and the traveller should not have to move each
 * day of it by hand. But a later day with a stop on it has been planned in
 * its city, and moving it would leave its stops in a city the day is no
 * longer in, so it stays, and so does every day after it: those follow it
 * rather than the day moved. The day chosen moves whatever is on it, since
 * it is the one asked about. Days before it stay where they are: nobody
 * changing Thursday means Monday too. Empty when the day is not on the trip.
 */
export function cityRun(days: readonly DayPlan[], dayId: DayId): readonly DayId[] {
  const from = days.findIndex((day) => day.id === dayId);
  const first = days[from];
  if (first === undefined) {
    return [];
  }

  const run: DayId[] = [first.id];
  for (const day of days.slice(from + 1)) {
    if (!sameCity(day.city, first.city) || day.stops.length > 0) {
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

/** One stay: days one after another in the same city, by where they fall in the trip. */
export interface CityStay {
  readonly city: DayCity | null;
  /** The stay's first day and its last, counted from zero along the trip. */
  readonly first: number;
  readonly last: number;
}

/**
 * The trip as the stays it is made of, in order: each run of days one after
 * another in one city. A city left and come back to is two stays, since the
 * traveller arrives in it twice. Days with no city make a stay of their own,
 * as they share the same nowhere.
 */
export function cityStays(days: readonly DayPlan[]): readonly CityStay[] {
  const stays: CityStay[] = [];
  days.forEach((day, index) => {
    const current = stays[stays.length - 1];
    if (current !== undefined && sameCity(current.city, day.city)) {
      stays[stays.length - 1] = { ...current, last: index };
    } else {
      stays.push({ city: day.city, first: index, last: index });
    }
  });
  return stays;
}
