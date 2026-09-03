import { describe, expect, it } from "vitest";
import type { ClockTime, ComputedDay } from "@/core/time/compute-day";
import { timelineBands, timelineHours } from "./timeline";

const CLOCK: ClockTime = { epochMinutes: 0, minutesFromMidnight: 540, dayOffset: 0 };

function leg(index: number, durationMinutes: number | null) {
  return {
    index,
    fromName: "from",
    toName: "to",
    mode: "walk" as const,
    durationMinutes,
    distanceMeters: null,
    departure: CLOCK,
    arrival: CLOCK,
  };
}

function stop(stopId: string, stayMinutes: number, waitMinutes = 0) {
  return {
    stopId,
    placeName: stopId,
    arrival: CLOCK,
    departure: CLOCK,
    stayMinutes,
    waitMinutes,
  };
}

function day(over: Partial<ComputedDay>): ComputedDay {
  return {
    dayId: "d1",
    date: "2026-03-01",
    timeZone: "Australia/Sydney",
    begins: CLOCK,
    stops: [],
    legs: [],
    ends: CLOCK,
    totals: {
      timeOutMinutes: 0,
      timeAtPlacesMinutes: 0,
      travelMinutes: 0,
      waitingMinutes: 0,
      complete: true,
    },
    conflicts: [],
    ...over,
  };
}

describe("timelineBands", () => {
  it("lays the day out in the order it happens", () => {
    const bands = timelineBands({
      startsAtAPoint: true,
      computed: day({
        stops: [stop("a", 60), stop("b", 30)],
        legs: [leg(0, 20), leg(1, 10), leg(2, 30)],
        totals: {
          timeOutMinutes: 150,
          timeAtPlacesMinutes: 90,
          travelMinutes: 60,
          waitingMinutes: 0,
          complete: true,
        },
      }),
    });

    expect(bands.map((band) => band.kind)).toEqual([
      "travelling",
      "at-places",
      "travelling",
      "at-places",
      "travelling",
    ]);
    expect(bands[0]?.percent).toBeCloseTo((20 / 150) * 100);
    expect(bands.reduce((sum, band) => sum + band.percent, 0)).toBeCloseTo(100);
  });

  it("puts the wait before the stay at a place that opens late", () => {
    const bands = timelineBands({
      startsAtAPoint: false,
      computed: day({
        stops: [stop("a", 60, 30)],
        legs: [],
        totals: {
          timeOutMinutes: 90,
          timeAtPlacesMinutes: 60,
          travelMinutes: 0,
          waitingMinutes: 30,
          complete: true,
        },
      }),
    });

    expect(bands.map((band) => band.kind)).toEqual(["waiting", "at-places"]);
  });

  it("keeps the legs in step with the stops when the day starts at its first stop", () => {
    const bands = timelineBands({
      startsAtAPoint: false,
      computed: day({
        stops: [stop("a", 60), stop("b", 30)],
        legs: [leg(0, 20)],
        totals: {
          timeOutMinutes: 110,
          timeAtPlacesMinutes: 90,
          travelMinutes: 20,
          waitingMinutes: 0,
          complete: true,
        },
      }),
    });

    expect(bands.map((band) => band.kind)).toEqual([
      "at-places",
      "travelling",
      "at-places",
    ]);
  });

  it("draws nothing while a leg is unresolved", () => {
    const bands = timelineBands({
      startsAtAPoint: true,
      computed: day({
        stops: [stop("a", 60)],
        legs: [leg(0, null)],
        totals: {
          timeOutMinutes: null,
          timeAtPlacesMinutes: 60,
          travelMinutes: null,
          waitingMinutes: 0,
          complete: false,
        },
      }),
    });

    expect(bands).toEqual([]);
  });

  it("draws nothing for a day with no time in it", () => {
    expect(timelineBands({ startsAtAPoint: true, computed: day({}) })).toEqual([]);
  });
});

describe("timelineHours", () => {
  it("marks every two hours, on the clock rather than on the start", () => {
    const marks = timelineHours({
      beginEpochMinutes: 1000,
      endEpochMinutes: 1000 + 311,
      beginMinutesFromMidnight: 9 * 60 + 15,
    });

    // 9:15 am to 2:26 pm, so the marks are 10:00 am, 12:00 pm and 2:00 pm.
    expect(marks.map((mark) => mark.epochMinutes)).toEqual([1045, 1165, 1285]);
    expect(marks[0]?.percent).toBeCloseTo((45 / 311) * 100);
  });

  it("widens to three hours once the day is long", () => {
    const marks = timelineHours({
      beginEpochMinutes: 0,
      endEpochMinutes: 600,
      beginMinutesFromMidnight: 8 * 60,
    });
    // 8:00 am to 6:00 pm, so the marks are 9:00 am, noon, 3:00 pm and 6:00 pm.
    expect(marks.map((mark) => mark.epochMinutes)).toEqual([60, 240, 420, 600]);
  });

  it("returns nothing for a day that takes no time", () => {
    expect(
      timelineHours({
        beginEpochMinutes: 500,
        endEpochMinutes: 500,
        beginMinutesFromMidnight: 540,
      }),
    ).toEqual([]);
  });
});
