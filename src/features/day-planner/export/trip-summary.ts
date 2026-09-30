import type { DayPlan, IsoDate } from "@/core/model/day";
import { citiesOf, cityStays } from "@/core/model/day-city";
import type { Place } from "@/core/model/place";
import type { ClockTime } from "@/core/time/compute-day";
import { formatClock } from "@/core/time/minutes";
import type { PlannedDay } from "../compute-trip";
import { formatDayTime } from "../format-day-time";

/**
 * What the cover and the list of days after it say about the trip as a
 * whole: where it goes and when, where each night is spent, where it begins
 * and ends when nobody has said, and the shape of each day on one line.
 */

/** A stretch of the trip spent in one city, as the route on the cover lists it. */
export interface RouteStay {
  readonly city: string;
  readonly from: IsoDate;
  readonly to: IsoDate;
}

/**
 * The cities the trip stays in, in order, each with the days it is there. A
 * city come back to is on the route twice, since the trip arrives in it
 * twice. Null when a day has no city, which a trip kept before days had
 * cities does, and which leaves no route to draw.
 */
export function routeOf(plans: readonly DayPlan[]): readonly RouteStay[] | null {
  const route: RouteStay[] = [];
  for (const stay of cityStays(plans)) {
    const first = plans[stay.first];
    const last = plans[stay.last];
    if (stay.city === null || first === undefined || last === undefined) {
      return null;
    }
    route.push({ city: stay.city.name, from: first.date, to: last.date });
  }
  return route;
}

/** Nights spent one after another in one place, or with nowhere in the plan to spend them. */
export interface NightStay {
  /** Where the nights are spent, or null when the plan does not say. */
  readonly place: Place | null;
  /** The city of the day the nights follow, for the line under the place's name. */
  readonly city: string | null;
  /** The first night and the last, each dated by the day it follows. */
  readonly from: IsoDate;
  readonly to: IsoDate;
  readonly nights: number;
}

function samePlace(a: Place | null, b: Place | null): boolean {
  return a === null || b === null ? a === b : a.id === b.id;
}

/**
 * Where each night of the trip is spent. Every day but the last is followed
 * by a night, and it is spent where the next day leaves from, since that is
 * where the traveller wakes up; or, when the next day leaves from nowhere in
 * particular, where this one finishes. Nights in one place one after another
 * are one stay, and so are nights with nowhere in the plan.
 */
export function nightsOf(plans: readonly DayPlan[]): readonly NightStay[] {
  const stays: NightStay[] = [];
  plans.forEach((tonight, index) => {
    const tomorrow = plans[index + 1];
    if (tomorrow === undefined) {
      return;
    }
    const place = tomorrow.start?.place ?? tonight.end?.place ?? null;
    // The city the day before the night is spent in: a day that sets off
    // for the next city leaves from a hotel in this one.
    const city = tonight.city?.name ?? null;
    const last = stays[stays.length - 1];
    if (last !== undefined && samePlace(last.place, place)) {
      stays[stays.length - 1] = { ...last, to: tonight.date, nights: last.nights + 1 };
    } else {
      stays.push({ place, city: place === null ? null : city, from: tonight.date, to: tonight.date, nights: 1 });
    }
  });
  return stays;
}

const COUNTED = ["One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];

/** "Seven nights without a hotel in the plan": what a run of nights with nowhere to sleep says. */
export function nightsWithoutStay(nights: number): string {
  const count = COUNTED[nights - 1] ?? String(nights);
  return `${count} ${nights === 1 ? "night" : "nights"} without a hotel in the plan`;
}

/** How many of each the trip comes to, for the cover. */
export interface TripCounts {
  readonly days: number;
  readonly cities: number;
  readonly stops: number;
}

export function tripCounts(plans: readonly DayPlan[]): TripCounts {
  return {
    days: plans.length,
    cities: citiesOf(plans).length,
    stops: plans.reduce((total, plan) => total + plan.stops.length, 0),
  };
}

/** When a day is over, in the words of the row it points at. */
export interface DayDone {
  /** Back where it began, finished somewhere else, or done at its last stop. */
  readonly label: "Back by" | "Finish by" | "Done by";
  readonly at: ClockTime | null;
}

export function dayDone(day: PlannedDay): DayDone {
  const { plan, computed } = day;
  const lastStop = computed.stops[computed.stops.length - 1];
  const at = computed.ends ?? lastStop?.departure ?? null;
  if (plan.end === null) {
    return { label: "Done by", at };
  }
  const back = plan.start !== null && plan.start.place.id === plan.end.place.id;
  return { label: back ? "Back by" : "Finish by", at };
}

/**
 * A day's hours on one line, from when it leaves to when it is over, the two
 * times joined as the opening hours of a place are, so the list of days and
 * a stop's hours read the same way. Null for a day with nothing on it, which
 * has no hours to speak of.
 */
export function daySpan(day: PlannedDay): string | null {
  if (day.plan.stops.length === 0) {
    return null;
  }
  const leave = formatClock(day.plan.startAtMinutes);
  const { at } = dayDone(day);
  return at === null ? leave : `${leave}–${formatDayTime(at)}`;
}

/** Longer than this, a name in the list of days is cut short. */
const SHORT_NAME = 24;

/**
 * A place's name as short as the list of days can carry it: the name before
 * whatever the provider hangs off it after a dash or in brackets, and cut at
 * a word with an ellipsis when that is still long. "Phở gà Hà Nội - Khang Gà"
 * is "Phở gà Hà Nội".
 */
export function shortPlaceName(name: string): string {
  const [beforeDash = ""] = name.split(" - ");
  const [beforeBracket = ""] = beforeDash.split(" (");
  const base = beforeBracket.trim() === "" ? name.trim() : beforeBracket.trim();
  if (base.length <= SHORT_NAME) {
    return base;
  }
  const cut = base.slice(0, SHORT_NAME - 2).replace(/\s+\S*$/, "");
  return `${cut === "" ? base.slice(0, SHORT_NAME - 2) : cut}…`;
}
