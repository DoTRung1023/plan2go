import type { DayCity, DayPlan } from "@/core/model/day";
import { citiesOf, sameCity } from "@/core/model/day-city";

/** A city the trip goes to, and which of its days are spent there. */
export interface CityOption {
  readonly city: DayCity;
  /** "Day 2", "Days 1 to 3", "Days 1 to 3 and 6". */
  readonly days: string;
}

/**
 * Day numbers as a person says them: runs of three or more as a range, the runs
 * joined the way a list is, so a city left and come back to reads as two
 * stays rather than as a list of every day.
 */
export function dayNumbers(numbers: readonly number[]): string {
  const runs: [number, number][] = [];
  for (const number of numbers) {
    const last = runs[runs.length - 1];
    if (last !== undefined && number === last[1] + 1) {
      last[1] = number;
    } else {
      runs.push([number, number]);
    }
  }
  const said = runs.flatMap(([from, to]) => {
    if (from === to) {
      return [String(from)];
    }
    // Two days in a row are said as two days: "Days 1 and 2", not "1 to 2".
    if (to === from + 1) {
      return [String(from), String(to)];
    }
    return [`${String(from)} to ${String(to)}`];
  });
  const joined =
    said.length <= 1 ? (said[0] ?? "") : `${said.slice(0, -1).join(", ")} and ${said[said.length - 1] ?? ""}`;
  return `${numbers.length === 1 ? "Day" : "Days"} ${joined}`;
}

/**
 * Every city on the trip, in the order the trip reaches it, each with the days
 * it holds. This is what the city picker offers before anything is typed: a
 * trip that goes back to a city it has been to is one press from it.
 */
export function cityOptions(days: readonly DayPlan[]): readonly CityOption[] {
  return citiesOf(days).map((city) => ({
    city,
    days: dayNumbers(
      days.flatMap((day, index) => (sameCity(day.city, city) ? [index + 1] : [])),
    ),
  }));
}
