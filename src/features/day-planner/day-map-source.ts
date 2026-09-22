import type { PlannedDay } from "./compute-trip";

/**
 * Where the picture of each day's map is, by day. The sheets take it as an
 * address rather than drawing it themselves, because the same sheets are
 * drawn in two places: on screen, where the picture is fetched from our own
 * map route, and on the server's browser, where it is handed over already
 * drawn so that nothing is fetched at all.
 */
export type DayMapSources = Readonly<Record<string, string>>;

/** Our own map route, which draws the day once and keeps it. */
export function staticMapUrl(slug: string, dayId: string): string {
  return `/api/map/static?slug=${encodeURIComponent(slug)}&day=${encodeURIComponent(dayId)}`;
}

/** The map route's address for every day that has something on it. */
export function dayMapSources(slug: string, days: readonly PlannedDay[]): DayMapSources {
  return Object.fromEntries(
    days
      .filter((day) => day.plan.stops.length > 0)
      .map((day) => [day.plan.id, staticMapUrl(slug, day.plan.id)]),
  );
}
