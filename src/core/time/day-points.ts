import type { DayEndpoint, DayPlan } from "../model/day";
import type { TravelMode } from "../model/leg";
import type { LatLng } from "../model/place";
import type { Stop, StopId } from "../model/stop";

/**
 * One place the day passes through, in the order it is reached. A day may have
 * a start point, an end point, both, or neither, so this is the single place
 * that knows what the running order actually is.
 */
export type DayPoint =
  | { readonly kind: "start"; readonly endpoint: DayEndpoint }
  | { readonly kind: "stop"; readonly stop: Stop }
  | { readonly kind: "end"; readonly endpoint: DayEndpoint };

/**
 * The points of a day in travel order. Legs run between consecutive entries, so
 * a day with fewer than two points involves no travelling at all.
 */
export function dayPoints(day: DayPlan): readonly DayPoint[] {
  const points: DayPoint[] = [];
  if (day.start !== null) {
    points.push({ kind: "start", endpoint: day.start });
  }
  for (const stop of day.stops) {
    points.push({ kind: "stop", stop });
  }
  if (day.end !== null) {
    points.push({ kind: "end", endpoint: day.end });
  }
  return points;
}

/**
 * What a leg's mode is stored on. A stop owns the mode of the leg that arrives
 * at it, and the day owns the mode of the leg out to where it ends.
 */
export type LegTarget =
  | { readonly kind: "stop"; readonly stopId: StopId }
  | { readonly kind: "day-end" };

/**
 * One target per leg, in the same order as legRequestsFor and computeDay read
 * them, so a leg on screen can be traced back to the row that decides how it is
 * travelled without anyone counting points again.
 */
export function legTargets(day: DayPlan): readonly LegTarget[] {
  const points = dayPoints(day);
  const targets: LegTarget[] = [];

  for (let index = 1; index < points.length; index += 1) {
    const arrivedAt = points[index];
    if (arrivedAt === undefined) {
      continue;
    }
    targets.push(
      arrivedAt.kind === "stop"
        ? { kind: "stop", stopId: arrivedAt.stop.id }
        : { kind: "day-end" },
    );
  }

  return targets;
}

/** What the traveller calls this point. Their own label wins over the place name. */
export function pointName(point: DayPoint): string {
  if (point.kind === "stop") {
    return point.stop.place.name;
  }
  return point.endpoint.label ?? point.endpoint.place.name;
}

export function pointPosition(point: DayPoint): LatLng {
  if (point.kind === "stop") {
    return point.stop.place.position;
  }
  return point.endpoint.place.position;
}

/**
 * The mode of the leg that arrives at this point. A stop carries its own, and
 * the end point uses the day's, since nothing else travels to it.
 */
export function modeArrivingAt(point: DayPoint, day: DayPlan): TravelMode {
  return point.kind === "stop" ? point.stop.travelMode : day.endTravelMode;
}
