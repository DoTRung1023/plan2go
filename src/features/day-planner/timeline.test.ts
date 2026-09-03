import { describe, expect, it } from "vitest";
import type { DayTotals } from "@/core/time/compute-day";
import { timelineBands, timelineHours } from "./timeline";

const TOTALS: DayTotals = {
  timeOutMinutes: 200,
  timeAtPlacesMinutes: 120,
  travelMinutes: 60,
  waitingMinutes: 20,
  complete: true,
};

describe("timelineBands", () => {
  it("splits the day into three bands that fill the bar", () => {
    const bands = timelineBands(TOTALS);
    expect(bands.map((band) => band.kind)).toEqual([
      "at-places",
      "travelling",
      "waiting",
    ]);
    expect(bands.reduce((sum, band) => sum + band.percent, 0)).toBeCloseTo(100);
  });

  it("drops a band nothing was spent on", () => {
    const bands = timelineBands({ ...TOTALS, waitingMinutes: 0 });
    expect(bands.map((band) => band.kind)).toEqual(["at-places", "travelling"]);
  });

  it("draws nothing while a leg is unresolved", () => {
    expect(timelineBands({ ...TOTALS, travelMinutes: null })).toEqual([]);
  });

  it("draws nothing for a day with no time in it", () => {
    expect(
      timelineBands({
        timeOutMinutes: 0,
        timeAtPlacesMinutes: 0,
        travelMinutes: 0,
        waitingMinutes: 0,
        complete: true,
      }),
    ).toEqual([]);
  });
});

describe("timelineHours", () => {
  it("marks each whole hour of a short day", () => {
    const marks = timelineHours({
      beginEpochMinutes: 1000,
      endEpochMinutes: 1180,
      beginMinutesFromMidnight: 9 * 60 + 30,
    });
    expect(marks.map((mark) => mark.epochMinutes)).toEqual([1030, 1090, 1150]);
    expect(marks[0]?.percent).toBeCloseTo((30 / 180) * 100);
  });

  it("thins the marks out rather than crowding a long day", () => {
    const marks = timelineHours({
      beginEpochMinutes: 0,
      endEpochMinutes: 12 * 60,
      beginMinutesFromMidnight: 8 * 60,
    });
    expect(marks).toHaveLength(5);
    expect(marks[1]?.epochMinutes).toBe(180);
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
