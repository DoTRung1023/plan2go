import type { DrawnLeg } from "@/adapters/maps/google-static-map";
import type { PlannedDay } from "../compute-trip";

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

/**
 * Each leg of the day as it is travelled: its two ends and, where the chosen
 * way of covering it came with a shape, that shape. What the picture of the
 * day is drawn and framed from, on the server that asks for it and on the
 * sheet that lays the markers over it, so the two frame the same day.
 */
export function drawnLegs(day: PlannedDay): readonly DrawnLeg[] {
  const points = [
    ...(day.plan.start === null ? [] : [day.plan.start.place.position]),
    ...day.plan.stops.map((stop) => stop.place.position),
    ...(day.plan.end === null ? [] : [day.plan.end.place.position]),
  ];
  return day.computed.legs.flatMap((leg) => {
    const from = points[leg.index];
    const to = points[leg.index + 1];
    const planned = day.legs[leg.index];
    if (from === undefined || to === undefined || planned === undefined) {
      return [];
    }
    const chosen = planned.options.find((option) => option.mode === planned.chosen);
    return [{ from, to, mode: leg.mode, path: chosen?.path ?? null }];
  });
}
