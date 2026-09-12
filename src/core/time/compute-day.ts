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
}

export interface DayTotals {
  /** Beginning to end, in real elapsed minutes. */
  readonly timeOutMinutes: number | null;
  readonly timeAtPlacesMinutes: number;
  readonly travelMinutes: number | null;
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

  const points = dayPoints(day);

  /**
   * The one clock on the day. Everything after it is worked out: a stop is
   * reached when the leg to it ends and left when its stay is up, and no stop
   * carries a time of its own to be judged against.
   */
  const beginEpoch = wallClockToEpochMinutes(date, day.startAtMinutes, timeZone);
  const begins = clockAt(beginEpoch);

  const conflicts: Conflict[] = [];
  const computedStops: ComputedStop[] = [];
  const computedLegs: ComputedLeg[] = [];

  let cursor: number | null = beginEpoch;
  let travelMinutes = 0;
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
    const staying = stop.stayMinutes;
    timeAtPlacesMinutes += staying;

    // After a leg nobody could answer there is no knowing when anything is,
    // so the stop is listed without times rather than with made up ones.
    if (cursor === null) {
      computedStops.push({
        stopId: stop.id,
        placeName: stop.place.name,
        arrival: null,
        departure: null,
        stayMinutes: staying,
      });
      return;
    }

    const at = cursor;
    const arrival = clockAt(at);
    const arrivalWall = epochMinutesToWallClock(at, timeZone);
    conflicts.push(
      ...checkOpeningWindows({
        stopId: stop.id,
        placeName: stop.place.name,
        windows: windowsFor(stop.place, arrivalWall.date),
        weekday: weekdayOf(arrivalWall.date),
        arrivalMinutes: arrival.minutesFromMidnight,
        stayMinutes: staying,
      }),
    );

    // The stay runs from the arrival whatever the doors are doing. A place
    // not yet open is reported, not waited for: the times stay as planned
    // and the conflict says what is wrong with them.
    const departureEpoch = at + staying;
    computedStops.push({
      stopId: stop.id,
      placeName: stop.place.name,
      arrival,
      departure: clockAt(departureEpoch),
      stayMinutes: staying,
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

  // A day running past midnight is not remarked on. Every time it produces
  // already says which day it is on, so a line at the bottom repeating that was
  // the day saying once more what it had just finished saying.

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
      complete: !blocked,
    },
    conflicts,
  };
}
