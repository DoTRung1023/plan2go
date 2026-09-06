import { describe, expect, it } from "vitest";
import type { DayEndpoint, DayPlan } from "../model/day";
import type { LegResolution, TravelMode } from "../model/leg";
import type { LatLng, OpeningWindow, Place, WeeklyOpeningHours } from "../model/place";
import type { Stop } from "../model/stop";
import { computeDay } from "./compute-day";

const ADELAIDE = "Australia/Adelaide";
const CITY: LatLng = { lat: -34.9285, lng: 138.6007 };

function openEveryDay(windows: readonly OpeningWindow[]): WeeklyOpeningHours {
  return { 0: windows, 1: windows, 2: windows, 3: windows, 4: windows, 5: windows, 6: windows };
}

function place(name: string, openingHours: WeeklyOpeningHours | null = null): Place {
  return {
    id: `place-${name}`,
    providerPlaceId: null,
    name,
    address: null,
    position: CITY,
    openingHours,
  };
}

function stop(
  name: string,
  stayMinutes: number,
  openingHours: WeeklyOpeningHours | null = null,
): Stop {
  return {
    id: `stop-${name}`,
    place: place(name, openingHours),
    stayMinutes,
    startAtMinutes: null,
    travelMode: "walk",
    note: null,
  };
}

function endpoint(name: string): DayEndpoint {
  return { place: place(name), label: null };
}

function day(overrides: Partial<DayPlan> = {}): DayPlan {
  return {
    id: "day-1",
    date: "2026-08-22",
    timeZone: ADELAIDE,
    label: null,
    start: endpoint("Home"),
    end: endpoint("Home"),
    startAtMinutes: 9 * 60,
    stops: [],
    endTravelMode: "walk",
    ...overrides,
  };
}

function leg(durationMinutes: number, mode: TravelMode = "walk"): LegResolution {
  return {
    status: "resolved",
    estimate: {
      mode,
      durationMinutes,
      distanceMeters: durationMinutes * 80,
      source: "haversine",
      path: null,
    },
  };
}

const unresolved: LegResolution = { status: "unresolved", reason: "no-route" };

describe("computeDay, ordinary days", () => {
  it("returns a result for a day with nothing in it at all", () => {
    const result = computeDay({ day: day({ start: null, end: null }), legs: [] });

    expect(result.stops).toEqual([]);
    expect(result.legs).toEqual([]);
    expect(result.conflicts).toEqual([]);
    expect(result.begins.minutesFromMidnight).toBe(540);
    expect(result.ends?.minutesFromMidnight).toBe(540);
    expect(result.totals).toEqual({
      timeOutMinutes: 0,
      timeAtPlacesMinutes: 0,
      travelMinutes: 0,
      waitingMinutes: 0,
      complete: true,
    });
  });

  it("walks two stops and comes back", () => {
    const plan = day({ stops: [stop("Museum", 90), stop("Market", 45)] });
    const result = computeDay({ day: plan, legs: [leg(20), leg(15), leg(25)] });

    expect(result.stops.map((entry) => entry.arrival?.minutesFromMidnight)).toEqual([
      9 * 60 + 20,
      11 * 60 + 5,
    ]);
    expect(result.stops.map((entry) => entry.departure?.minutesFromMidnight)).toEqual([
      10 * 60 + 50,
      11 * 60 + 50,
    ]);
    expect(result.ends?.minutesFromMidnight).toBe(12 * 60 + 15);
    expect(result.totals).toEqual({
      timeOutMinutes: 195,
      timeAtPlacesMinutes: 135,
      travelMinutes: 60,
      waitingMinutes: 0,
      complete: true,
    });
  });

  it("keeps time out equal to travel plus time at places plus waiting", () => {
    const gallery = openEveryDay([{ opensAt: 10 * 60, closesAt: 17 * 60 }]);
    const plan = day({ stops: [stop("Gallery", 60, gallery), stop("Park", 30)] });
    const result = computeDay({ day: plan, legs: [leg(20), leg(10), leg(30)] });
    const { timeOutMinutes, travelMinutes, timeAtPlacesMinutes, waitingMinutes } = result.totals;

    expect(timeOutMinutes).toBe((travelMinutes ?? 0) + timeAtPlacesMinutes + waitingMinutes);
  });
});

describe("computeDay, midnight rollover", () => {
  it("carries a day offset when the day ends after midnight", () => {
    const plan = day({ startAtMinutes: 23 * 60, stops: [stop("Night Market", 30)] });
    const result = computeDay({ day: plan, legs: [leg(60), leg(60)] });
    const first = result.stops[0];

    expect(first?.arrival?.minutesFromMidnight).toBe(0);
    expect(first?.arrival?.dayOffset).toBe(1);
    expect(first?.departure?.minutesFromMidnight).toBe(30);
    expect(result.ends?.minutesFromMidnight).toBe(90);
    expect(result.ends?.dayOffset).toBe(1);
    expect(result.totals.timeOutMinutes).toBe(150);
    expect(result.conflicts).toContainEqual({
      kind: "ends-next-day",
      endMinutes: 90,
      dayOffset: 1,
    });
  });
});

describe("computeDay, daylight saving in the trip time zone", () => {
  it("reads two hours on the clock for one hour of travel on the day that loses an hour", () => {
    const plan = day({
      date: "2026-10-04",
      startAtMinutes: 90,
      stops: [stop("Sunrise Lookout", 30)],
    });
    const result = computeDay({ day: plan, legs: [leg(60), leg(60)] });
    const first = result.stops[0];

    expect(first?.arrival?.minutesFromMidnight).toBe(3 * 60 + 30);
    expect(first?.arrival?.dayOffset).toBe(0);
    expect(result.ends?.minutesFromMidnight).toBe(5 * 60);
    expect(result.totals.timeOutMinutes).toBe(150);
    expect(result.totals.travelMinutes).toBe(120);
  });

  it("reads the same clock time after an hour of travel on the day that gains one", () => {
    const plan = day({
      date: "2026-04-05",
      startAtMinutes: 150,
      stops: [stop("Bakery", 30)],
    });
    const result = computeDay({ day: plan, legs: [leg(60), leg(60)] });
    const first = result.stops[0];

    expect(first?.arrival?.minutesFromMidnight).toBe(150);
    expect(first?.departure?.minutesFromMidnight).toBe(180);
    expect(result.ends?.minutesFromMidnight).toBe(240);
    expect(result.totals.timeOutMinutes).toBe(150);
  });
});

describe("computeDay, zero duration stay", () => {
  it("leaves the moment it arrives", () => {
    const plan = day({ stops: [stop("Lookout", 0)] });
    const result = computeDay({ day: plan, legs: [leg(20), leg(20)] });
    const first = result.stops[0];

    expect(first?.arrival?.minutesFromMidnight).toBe(9 * 60 + 20);
    expect(first?.departure?.minutesFromMidnight).toBe(9 * 60 + 20);
    expect(result.ends?.minutesFromMidnight).toBe(9 * 60 + 40);
    expect(result.totals.timeAtPlacesMinutes).toBe(0);
    expect(result.conflicts).toEqual([]);
  });

  it("still flags a zero stay at a place that is already shut", () => {
    const closed = openEveryDay([{ opensAt: 7 * 60, closesAt: 9 * 60 }]);
    const plan = day({ stops: [stop("Bakery", 0, closed)] });
    const result = computeDay({ day: plan, legs: [leg(30), leg(30)] });

    expect(result.conflicts).toContainEqual({
      kind: "arrives-after-close",
      stopId: "stop-Bakery",
      placeName: "Bakery",
      arrivalMinutes: 9 * 60 + 30,
      closesAt: 9 * 60,
    });
  });
});

describe("computeDay, an unresolvable leg", () => {
  it("stops reporting times after the leg it could not answer, without throwing", () => {
    const plan = day({ stops: [stop("Museum", 60), stop("Market", 30)] });
    const result = computeDay({ day: plan, legs: [leg(20), unresolved, leg(25)] });

    expect(result.stops[0]?.arrival?.minutesFromMidnight).toBe(9 * 60 + 20);
    expect(result.stops[1]?.arrival).toBeNull();
    expect(result.stops[1]?.departure).toBeNull();
    expect(result.ends).toBeNull();
    expect(result.totals.complete).toBe(false);
    expect(result.totals.travelMinutes).toBeNull();
    expect(result.totals.timeOutMinutes).toBeNull();
    expect(result.totals.timeAtPlacesMinutes).toBe(90);
    expect(result.conflicts).toContainEqual({
      kind: "unresolved-leg",
      fromName: "Museum",
      toName: "Market",
      legIndex: 1,
    });
  });

  it("treats a leg nobody asked for as unresolved rather than as an error", () => {
    const plan = day({ stops: [stop("Museum", 60)] });
    const result = computeDay({ day: plan, legs: [] });

    expect(result.conflicts.filter((entry) => entry.kind === "unresolved-leg")).toHaveLength(2);
    expect(result.stops[0]?.arrival).toBeNull();
    expect(result.totals.complete).toBe(false);
  });
});

describe("computeDay, opening hours", () => {
  it("names the place, the closing time, and the arrival time", () => {
    const hours = openEveryDay([{ opensAt: 7 * 60, closesAt: 16 * 60 }]);
    const plan = day({ startAtMinutes: 16 * 60, stops: [stop("Fish Market", 45, hours)] });
    const result = computeDay({ day: plan, legs: [leg(30), leg(30)] });

    expect(result.conflicts).toContainEqual({
      kind: "arrives-after-close",
      stopId: "stop-Fish Market",
      placeName: "Fish Market",
      arrivalMinutes: 16 * 60 + 30,
      closesAt: 16 * 60,
    });
  });

  it("does not quietly move an impossible arrival to a time that works", () => {
    const hours = openEveryDay([{ opensAt: 7 * 60, closesAt: 16 * 60 }]);
    const plan = day({ startAtMinutes: 16 * 60, stops: [stop("Fish Market", 45, hours)] });
    const result = computeDay({ day: plan, legs: [leg(30), leg(30)] });

    expect(result.stops[0]?.arrival?.minutesFromMidnight).toBe(16 * 60 + 30);
    expect(result.stops[0]?.departure?.minutesFromMidnight).toBe(17 * 60 + 15);
  });

  it("waits for the doors to open and pushes the rest of the day back", () => {
    const hours = openEveryDay([{ opensAt: 10 * 60, closesAt: 17 * 60 }]);
    const plan = day({ stops: [stop("Gallery", 60, hours)] });
    const result = computeDay({ day: plan, legs: [leg(20), leg(20)] });

    expect(result.stops[0]?.waitMinutes).toBe(40);
    expect(result.stops[0]?.departure?.minutesFromMidnight).toBe(11 * 60);
    expect(result.ends?.minutesFromMidnight).toBe(11 * 60 + 20);
    expect(result.totals.waitingMinutes).toBe(40);
    expect(result.conflicts).toContainEqual({
      kind: "arrives-before-open",
      stopId: "stop-Gallery",
      placeName: "Gallery",
      arrivalMinutes: 9 * 60 + 20,
      opensAt: 10 * 60,
      waitMinutes: 40,
    });
  });

  it("flags a stay that runs past closing", () => {
    const hours = openEveryDay([{ opensAt: 10 * 60, closesAt: 17 * 60 }]);
    const plan = day({ startAtMinutes: 16 * 60, stops: [stop("Gallery", 60, hours)] });
    const result = computeDay({ day: plan, legs: [leg(30), leg(30)] });

    expect(result.conflicts).toContainEqual({
      kind: "stay-overruns-close",
      stopId: "stop-Gallery",
      placeName: "Gallery",
      departureMinutes: 17 * 60 + 30,
      closesAt: 17 * 60,
    });
  });

  it("flags a place that is shut for the whole weekday", () => {
    const hours: WeeklyOpeningHours = {
      ...openEveryDay([{ opensAt: 10 * 60, closesAt: 16 * 60 }]),
      1: [],
    };
    const plan = day({ date: "2026-08-24", stops: [stop("Museum", 60, hours)] });
    const result = computeDay({ day: plan, legs: [leg(20), leg(20)] });

    expect(result.conflicts).toContainEqual({
      kind: "closed-all-day",
      stopId: "stop-Museum",
      placeName: "Museum",
      weekday: 1,
    });
  });

  it("says nothing about a place whose hours are unknown", () => {
    const plan = day({ stops: [stop("A pin on the map", 60)] });
    const result = computeDay({ day: plan, legs: [leg(20), leg(20)] });

    expect(result.conflicts).toEqual([]);
  });
});

describe("computeDay, days that do not start or end anywhere in particular", () => {
  it("begins at the first stop when there is no start point", () => {
    const plan = day({ start: null, stops: [stop("Museum", 60), stop("Market", 30)] });
    const result = computeDay({ day: plan, legs: [leg(15), leg(25)] });

    expect(result.begins.minutesFromMidnight).toBe(9 * 60);
    expect(result.stops[0]?.arrival?.minutesFromMidnight).toBe(9 * 60);
    expect(result.legs.map((entry) => [entry.fromName, entry.toName])).toEqual([
      ["Museum", "Market"],
      ["Market", "Home"],
    ]);
    expect(result.conflicts).toEqual([]);
  });

  it("is over when it leaves the last stop, if there is no end point", () => {
    const plan = day({ end: null, stops: [stop("Museum", 60)] });
    const result = computeDay({ day: plan, legs: [leg(20)] });

    expect(result.legs).toHaveLength(1);
    expect(result.ends?.minutesFromMidnight).toBe(10 * 60 + 20);
    expect(result.totals.timeOutMinutes).toBe(80);
    expect(result.conflicts).toEqual([]);
  });

  it("ends somewhere other than where it started", () => {
    const plan = day({
      start: { place: place("Hotel"), label: "Hotel" },
      end: { place: place("Airport"), label: "Airport" },
      stops: [stop("Market", 45)],
    });
    const result = computeDay({ day: plan, legs: [leg(10), leg(35)] });

    expect(result.legs.map((entry) => [entry.fromName, entry.toName])).toEqual([
      ["Hotel", "Market"],
      ["Market", "Airport"],
    ]);
    expect(result.ends?.minutesFromMidnight).toBe(10 * 60 + 30);
  });

  it("still travels between a start and an end with no stops in between", () => {
    const plan = day({
      start: { place: place("Hotel"), label: "Hotel" },
      end: { place: place("Airport"), label: "Airport" },
    });
    const result = computeDay({ day: plan, legs: [leg(40)] });

    expect(result.legs).toHaveLength(1);
    expect(result.ends?.minutesFromMidnight).toBe(9 * 60 + 40);
    expect(result.totals.travelMinutes).toBe(40);
  });

  it("has no legs and no conflicts when neither end of the day is set", () => {
    const result = computeDay({ day: day({ start: null, end: null, stops: [] }), legs: [] });

    expect(result.legs).toEqual([]);
    expect(result.conflicts).toEqual([]);
    expect(result.ends?.epochMinutes).toBe(result.begins.epochMinutes);
  });

  it("calls a point by the traveller's own label, and by the place name without one", () => {
    const plan = day({
      start: { place: place("Ibis Adelaide"), label: "Hotel" },
      end: { place: place("Ibis Adelaide"), label: null },
      stops: [stop("Market", 30)],
    });
    const result = computeDay({ day: plan, legs: [leg(10), leg(10)] });

    expect(result.legs[0]?.fromName).toBe("Hotel");
    expect(result.legs[1]?.toName).toBe("Ibis Adelaide");
  });
});

describe("computeDay, stops fixed to a time", () => {
  /** Same helper as above, with the stop pinned to a reading off the clock. */
  function fixedStop(name: string, stayMinutes: number, startAtMinutes: number): Stop {
    return { ...stop(name, stayMinutes), startAtMinutes };
  }

  it("waits for a time the day reaches early, and counts the wait", () => {
    const plan = day({
      start: null,
      end: null,
      startAtMinutes: 9 * 60,
      stops: [fixedStop("Tour", 60, 11 * 60)],
    });
    const result = computeDay({ day: plan, legs: [] });

    expect(result.stops[0]?.arrival?.minutesFromMidnight).toBe(11 * 60);
    expect(result.stops[0]?.waitMinutes).toBe(2 * 60);
    expect(result.stops[0]?.departure?.minutesFromMidnight).toBe(12 * 60);
    expect(result.totals.waitingMinutes).toBe(2 * 60);
    expect(result.conflicts).toEqual([]);
  });

  it("holds everything after a fixed time to it, not to what came before", () => {
    const plan = day({
      start: null,
      end: null,
      startAtMinutes: 9 * 60,
      stops: [stop("Market", 30), fixedStop("Tour", 60, 14 * 60), stop("Park", 30)],
    });
    const result = computeDay({ day: plan, legs: [leg(10), leg(10)] });

    expect(result.stops[1]?.arrival?.minutesFromMidnight).toBe(14 * 60);
    // 2pm, an hour there, ten minutes on.
    expect(result.stops[2]?.arrival?.minutesFromMidnight).toBe(15 * 60 + 10);
  });

  it("says so when the day cannot reach a fixed time, and does not move it", () => {
    const plan = day({
      start: null,
      end: null,
      startAtMinutes: 9 * 60,
      stops: [stop("Market", 180), fixedStop("Tour", 60, 10 * 60)],
    });
    const result = computeDay({ day: plan, legs: [leg(30)] });

    expect(result.conflicts).toEqual([
      {
        kind: "starts-before-arrival",
        stopId: "stop-Tour",
        placeName: "Tour",
        startsAt: 10 * 60,
        arrivalMinutes: 12 * 60 + 30,
      },
    ]);
    // The day carries on from when it actually gets there.
    expect(result.stops[1]?.arrival?.minutesFromMidnight).toBe(12 * 60 + 30);
    expect(result.stops[1]?.waitMinutes).toBe(0);
  });

  it("times a stop again after a leg nobody could answer", () => {
    const plan = day({
      start: null,
      end: null,
      startAtMinutes: 9 * 60,
      stops: [stop("Market", 30), fixedStop("Tour", 60, 14 * 60)],
    });
    const result = computeDay({ day: plan, legs: [unresolved] });

    expect(result.stops[0]?.arrival?.minutesFromMidnight).toBe(9 * 60);
    expect(result.stops[1]?.arrival?.minutesFromMidnight).toBe(14 * 60);
    // The gap itself is still unmeasured, so the totals stay partial.
    expect(result.totals.complete).toBe(false);
    expect(result.totals.travelMinutes).toBeNull();
  });
});
