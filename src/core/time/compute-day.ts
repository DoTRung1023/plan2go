import type { Conflict } from "../model/conflict";
import type { DayPlan, IsoDate } from "../model/day";
import type { LegResolution, TravelMode } from "../model/leg";
import type { OpeningWindow, Place } from "../model/place";
import type { StopId } from "../model/stop";
import { checkOpeningWindows } from "./conflicts";
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
  /** 0 is home base to the first stop. The last index is the return home. */
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
  /** Leaving to being home again, in real elapsed minutes. */
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
  readonly leave: ClockTime;
  readonly stops: readonly ComputedStop[];
  readonly legs: readonly ComputedLeg[];
  readonly returnHome: ClockTime | null;
  readonly totals: DayTotals;
  readonly conflicts: readonly Conflict[];
}

export interface ComputeDayInput {
  readonly day: DayPlan;
  /**
   * One entry per leg, in order: home base to the first stop, each stop to the
   * next, then the last stop back to home base. That is `stops.length + 1`
   * entries, or none at all when the day has no stops. A missing entry counts
   * as unresolved rather than as an error.
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
 * Turn a home base, an ordered list of stops, and a leave time into the times a
 * person actually reads, plus everything wrong with the result.
 *
 * Total by construction. An empty day, a leg the provider could not answer, and
 * a stop that opens after you get there all return a result. Nothing throws for
 * a plan that a user could have built, and nothing is quietly corrected.
 */
export function computeDay({ day, legs }: ComputeDayInput): ComputedDay {
  const { timeZone, date, stops, homeBase } = day;

  const clockAt = (epochMinutes: number): ClockTime => {
    const wall = epochMinutesToWallClock(epochMinutes, timeZone);
    return {
      epochMinutes,
      minutesFromMidnight: wall.minutesFromMidnight,
      dayOffset: daysBetween(date, wall.date),
    };
  };

  const leaveEpoch = wallClockToEpochMinutes(date, day.leaveAtMinutes, timeZone);
  const leave = clockAt(leaveEpoch);

  const conflicts: Conflict[] = [];
  const computedStops: ComputedStop[] = [];
  const computedLegs: ComputedLeg[] = [];

  let cursor: number | null = leaveEpoch;
  let travelMinutes = 0;
  let waitingMinutes = 0;
  let timeAtPlacesMinutes = 0;
  let blocked = false;

  const nameBefore = (index: number): string => {
    const previous = stops[index - 1];
    return previous === undefined ? homeBase.name : previous.place.name;
  };

  const walkLeg = (index: number, toName: string, mode: TravelMode): number | null => {
    const resolution = legs[index] ?? NOT_REQUESTED;
    const departure = cursor === null ? null : clockAt(cursor);

    if (resolution.status === "unresolved") {
      conflicts.push({
        kind: "unresolved-leg",
        fromName: nameBefore(index),
        toName,
        legIndex: index,
      });
      blocked = true;
      computedLegs.push({
        index,
        fromName: nameBefore(index),
        toName,
        mode,
        durationMinutes: null,
        distanceMeters: null,
        departure,
        arrival: null,
      });
      return null;
    }

    const { estimate } = resolution;
    const arrivalEpoch = cursor === null ? null : cursor + estimate.durationMinutes;
    if (cursor !== null) {
      travelMinutes += estimate.durationMinutes;
    }

    computedLegs.push({
      index,
      fromName: nameBefore(index),
      toName,
      mode: estimate.mode,
      durationMinutes: estimate.durationMinutes,
      distanceMeters: estimate.distanceMeters,
      departure,
      arrival: arrivalEpoch === null ? null : clockAt(arrivalEpoch),
    });
    return arrivalEpoch;
  };

  stops.forEach((stop, index) => {
    timeAtPlacesMinutes += stop.stayMinutes;
    const arrivalEpoch = walkLeg(index, stop.place.name, stop.travelMode);

    if (arrivalEpoch === null) {
      computedStops.push({
        stopId: stop.id,
        placeName: stop.place.name,
        arrival: null,
        departure: null,
        stayMinutes: stop.stayMinutes,
        waitMinutes: 0,
      });
      cursor = null;
      return;
    }

    const arrival = clockAt(arrivalEpoch);
    const arrivalWall = epochMinutesToWallClock(arrivalEpoch, timeZone);
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

    const departureEpoch = arrivalEpoch + check.waitMinutes + stop.stayMinutes;
    computedStops.push({
      stopId: stop.id,
      placeName: stop.place.name,
      arrival,
      departure: clockAt(departureEpoch),
      stayMinutes: stop.stayMinutes,
      waitMinutes: check.waitMinutes,
    });
    cursor = departureEpoch;
  });

  let returnHome: ClockTime | null = leave;
  if (stops.length > 0) {
    const homeEpoch = walkLeg(stops.length, homeBase.name, day.returnTravelMode);
    returnHome = homeEpoch === null ? null : clockAt(homeEpoch);
  }

  if (returnHome !== null && returnHome.dayOffset > 0) {
    conflicts.push({
      kind: "returns-next-day",
      returnMinutes: returnHome.minutesFromMidnight,
      dayOffset: returnHome.dayOffset,
    });
  }

  return {
    dayId: day.id,
    date,
    timeZone,
    leave,
    stops: computedStops,
    legs: computedLegs,
    returnHome,
    totals: {
      timeOutMinutes: returnHome === null ? null : returnHome.epochMinutes - leaveEpoch,
      timeAtPlacesMinutes,
      travelMinutes: blocked ? null : travelMinutes,
      waitingMinutes,
      complete: !blocked,
    },
    conflicts,
  };
}
