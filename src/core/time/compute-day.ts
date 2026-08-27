import type { Conflict } from "../model/conflict";
import type { DayPlan, IsoDate } from "../model/day";
import type { LegResolution, TravelMode } from "../model/leg";
import type { OpeningWindow, Place } from "../model/place";
import type { StopId } from "../model/stop";
import { checkOpeningWindows } from "./conflicts";
import type { DayPoint } from "./day-points";
import { dayPoints, modeArrivingAt, pointName } from "./day-points";
import {
  daysBetween,
  epochMinutesToWallClock,
  wallClockToEpochMinutes,
  weekdayOf,
} from "./zoned";

/** A moment in the day, as an instant and as the wall clock a person reads. */
export interface ClockTime {
  readonly epochMinutes: number;
  /** Minutes from midnight on the local day this moment falls in. */
  readonly minutesFromMidnight: number;
  /** 0 for the day's own date, 1 for after midnight, and so on. */
  readonly dayOffset: number;
}

export interface ComputedLeg {
  /** Position in travel order. Which points it joins depends on the day. */
  readonly index: number;
  readonly fromName: string;
  readonly toName: string;
  readonly mode: TravelMode;
  readonly durationMinutes: number | null;
  readonly distanceMeters: number | null;
  readonly departure: ClockTime | null;
  readonly arrival: ClockTime | null;
}

export interface ComputedStop {
  readonly stopId: StopId;
  readonly placeName: string;
  readonly arrival: ClockTime | null;
  readonly departure: ClockTime | null;
  readonly stayMinutes: number;
  /** Minutes spent waiting for the place to open before the stay begins. */
  readonly waitMinutes: number;
}

export interface DayTotals {
  /** Beginning to end, in real elapsed minutes. */
  readonly timeOutMinutes: number | null;
  readonly timeAtPlacesMinutes: number;
  readonly travelMinutes: number | null;
  readonly waitingMinutes: number;
  /** False when a leg could not be resolved, so the numbers above are partial. */
  readonly complete: boolean;
}

export interface ComputedDay {
  readonly dayId: string;
  readonly date: IsoDate;
  readonly timeZone: string;
  /** When the day begins, at the start point or at the first stop. */
  readonly begins: ClockTime;
  readonly stops: readonly ComputedStop[];
  readonly legs: readonly ComputedLeg[];
  /** When the day is over. Null when a leg could not be answered. */
  readonly ends: ClockTime | null;
  readonly totals: DayTotals;
  readonly conflicts: readonly Conflict[];
}

export interface ComputeDayInput {
  readonly day: DayPlan;
  /**
   * One entry per leg, in travel order, which is one fewer than the day has
   * points. A missing entry counts as unresolved rather than as an error.
   */
  readonly legs: readonly LegResolution[];
}

const NOT_REQUESTED: LegResolution = { status: "unresolved", reason: "not-requested" };

function windowsFor(place: Place, date: IsoDate): readonly OpeningWindow[] | null {
  if (place.openingHours === null) {
    return null;
  }
  return place.openingHours[weekdayOf(date)];
}

/**
 * Turn an ordered day into the times a person actually reads, plus everything
 * wrong with the result.
 *
 * Total by construction. A day with no start point, no end point, no stops, a
 * leg the provider could not answer, and a stop that opens after you get there
 * all return a result. Nothing throws for a plan that a user could have built,
 * and nothing is quietly corrected.
 */
export function computeDay({ day, legs }: ComputeDayInput): ComputedDay {
  const { timeZone, date } = day;

  const clockAt = (epochMinutes: number): ClockTime => {
    const wall = epochMinutesToWallClock(epochMinutes, timeZone);
    return {
      epochMinutes,
      minutesFromMidnight: wall.minutesFromMidnight,
      dayOffset: daysBetween(date, wall.date),
    };
  };

  const beginEpoch = wallClockToEpochMinutes(date, day.startAtMinutes, timeZone);
  const begins = clockAt(beginEpoch);
  const points = dayPoints(day);

  const conflicts: Conflict[] = [];
  const computedStops: ComputedStop[] = [];
  const computedLegs: ComputedLeg[] = [];

  let cursor: number | null = beginEpoch;
  let travelMinutes = 0;
  let waitingMinutes = 0;
  let timeAtPlacesMinutes = 0;
  let blocked = false;

  const travelTo = (point: DayPoint, from: DayPoint, legIndex: number): void => {
    const resolution = legs[legIndex] ?? NOT_REQUESTED;
    const departure = cursor === null ? null : clockAt(cursor);
    const fromName = pointName(from);
    const toName = pointName(point);

    if (resolution.status === "unresolved") {
      conflicts.push({ kind: "unresolved-leg", fromName, toName, legIndex });
      blocked = true;
      computedLegs.push({
        index: legIndex,
        fromName,
        toName,
        mode: modeArrivingAt(point, day),
        durationMinutes: null,
        distanceMeters: null,
        departure,
        arrival: null,
      });
      cursor = null;
      return;
    }

    const { estimate } = resolution;
    const arrivalEpoch = cursor === null ? null : cursor + estimate.durationMinutes;
    if (cursor !== null) {
      travelMinutes += estimate.durationMinutes;
    }

    computedLegs.push({
      index: legIndex,
      fromName,
      toName,
      mode: estimate.mode,
      durationMinutes: estimate.durationMinutes,
      distanceMeters: estimate.distanceMeters,
      departure,
      arrival: arrivalEpoch === null ? null : clockAt(arrivalEpoch),
    });
    cursor = arrivalEpoch;
  };

  const stayAt = (point: Extract<DayPoint, { kind: "stop" }>): void => {
    const { stop } = point;
    timeAtPlacesMinutes += stop.stayMinutes;

    if (cursor === null) {
      computedStops.push({
        stopId: stop.id,
        placeName: stop.place.name,
        arrival: null,
        departure: null,
        stayMinutes: stop.stayMinutes,
        waitMinutes: 0,
      });
      return;
    }

    const arrival = clockAt(cursor);
    const arrivalWall = epochMinutesToWallClock(cursor, timeZone);
    const check = checkOpeningWindows({
      stopId: stop.id,
      placeName: stop.place.name,
      windows: windowsFor(stop.place, arrivalWall.date),
      weekday: weekdayOf(arrivalWall.date),
      arrivalMinutes: arrival.minutesFromMidnight,
      stayMinutes: stop.stayMinutes,
    });
    conflicts.push(...check.conflicts);
    waitingMinutes += check.waitMinutes;

    const departureEpoch = cursor + check.waitMinutes + stop.stayMinutes;
    computedStops.push({
      stopId: stop.id,
      placeName: stop.place.name,
      arrival,
      departure: clockAt(departureEpoch),
      stayMinutes: stop.stayMinutes,
      waitMinutes: check.waitMinutes,
    });
    cursor = departureEpoch;
  };

  points.forEach((point, index) => {
    const previous = points[index - 1];
    if (index > 0 && previous !== undefined) {
      travelTo(point, previous, index - 1);
    }
    if (point.kind === "stop") {
      stayAt(point);
    }
  });

  const ends = cursor === null ? null : clockAt(cursor);

  if (ends !== null && ends.dayOffset > 0) {
    conflicts.push({
      kind: "ends-next-day",
      endMinutes: ends.minutesFromMidnight,
      dayOffset: ends.dayOffset,
    });
  }

  return {
    dayId: day.id,
    date,
    timeZone,
    begins,
    stops: computedStops,
    legs: computedLegs,
    ends,
    totals: {
      timeOutMinutes: ends === null ? null : ends.epochMinutes - beginEpoch,
      timeAtPlacesMinutes,
      travelMinutes: blocked ? null : travelMinutes,
      waitingMinutes,
      complete: !blocked,
    },
    conflicts,
  };
}
