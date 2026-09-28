import type { DayId, DayPlan } from "./day";
import type { CityIdentity } from "./day-city";
import { cityRun } from "./day-city";

/**
 * How many colours there are for cities. A trip with more cities than this
 * goes round again, so the seventh city shares the first one's colour.
 */
export const CITY_COLOR_COUNT = 6;

/**
 * Which colour each city on a trip holds, by city key, as a slot from 0 up to
 * CITY_COLOR_COUNT. A slot rather than a colour: what each slot looks like
 * is the stylesheet's business, and this is only which one a city has.
 */
export type CityColors = Readonly<Record<string, number>>;

/** The key a city's colour is kept under: its identifier, or its name when it has none. */
export function cityKey(city: CityIdentity): string {
  return city.providerPlaceId ?? `name:${city.name}`;
}

/**
 * The colours as they should stand for the cities the days are in, given the
 * colours as they were.
 *
 * A city keeps the colour it has for as long as any day is in it, whatever
 * else changes on the trip, so a dot never changes colour under the reader
 * because some other day moved. A city no day is in any more gives its colour
 * up, and a city new to the trip takes the first colour nobody holds, in the
 * order the trip reaches the new cities. With every colour held it goes round
 * again from the first.
 *
 * `cities` is the city of each day, in trip order, null for a day with none.
 */
export function settleCityColors(
  stored: CityColors,
  cities: readonly (CityIdentity | null)[],
): CityColors {
  const inUse: string[] = [];
  for (const city of cities) {
    if (city === null) {
      continue;
    }
    const key = cityKey(city);
    if (!inUse.includes(key)) {
      inUse.push(key);
    }
  }

  const settled: Record<string, number> = {};
  for (const key of inUse) {
    const slot = stored[key];
    if (slot !== undefined && Number.isInteger(slot) && slot >= 0 && slot < CITY_COLOR_COUNT) {
      settled[key] = slot;
    }
  }

  for (const key of inUse) {
    if (settled[key] !== undefined) {
      continue;
    }
    const held = new Set(Object.values(settled));
    const free = Array.from({ length: CITY_COLOR_COUNT }, (_unused, slot) => slot).find(
      (slot) => !held.has(slot),
    );
    settled[key] = free ?? Object.keys(settled).length % CITY_COLOR_COUNT;
  }

  return settled;
}

/** The colour each city holds now, read off the days that are in it. */
function colorsOf(days: readonly DayPlan[]): CityColors {
  const colors: Record<string, number> = {};
  for (const day of days) {
    if (day.city !== null) {
      colors[cityKey(day.city)] = day.city.color;
    }
  }
  return colors;
}

/**
 * Every city's colour once a day is moved to a city, with the run of days that
 * moves with it: what the write stores, and what the page shows the moment
 * the city is chosen, worked out the one way so the two cannot disagree.
 */
export function colorsAfterMove(
  days: readonly DayPlan[],
  dayId: DayId,
  city: CityIdentity,
): CityColors {
  const moving = new Set(cityRun(days, dayId));
  return settleCityColors(
    colorsOf(days),
    days.map((day) => (moving.has(day.id) ? city : day.city)),
  );
}

/**
 * The colour a city would have if the day were moved to it: its own colour
 * when the trip already goes there, and otherwise the one it will be given
 * once the move is written.
 */
export function colorAfterMove(
  days: readonly DayPlan[],
  dayId: DayId,
  city: CityIdentity,
): number {
  return colorsAfterMove(days, dayId, city)[cityKey(city)] ?? 0;
}
