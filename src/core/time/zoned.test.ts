import { describe, expect, it } from "vitest";
import {
  addDays,
  daysBetween,
  epochMinutesToWallClock,
  parseIsoDate,
  wallClockToEpochMinutes,
  weekdayOf,
  zoneOffsetMinutes,
} from "./zoned";

const ADELAIDE = "Australia/Adelaide";

describe("zoneOffsetMinutes", () => {
  it("handles a zone with a half hour offset on both sides of a transition", () => {
    const beforeTransition = Date.parse("2026-10-03T16:00:00Z") / 60_000;
    const afterTransition = Date.parse("2026-10-03T17:00:00Z") / 60_000;
    expect(zoneOffsetMinutes(beforeTransition, ADELAIDE)).toBe(570);
    expect(zoneOffsetMinutes(afterTransition, ADELAIDE)).toBe(630);
  });
});

describe("wallClockToEpochMinutes", () => {
  it("round trips an ordinary wall clock reading", () => {
    const epoch = wallClockToEpochMinutes("2026-08-22", 9 * 60 + 15, ADELAIDE);
    expect(epochMinutesToWallClock(epoch, ADELAIDE)).toEqual({
      date: "2026-08-22",
      minutesFromMidnight: 9 * 60 + 15,
    });
  });

  it("resolves the hour that happens twice in autumn to its first occurrence", () => {
    const repeated = wallClockToEpochMinutes("2026-04-05", 2 * 60 + 30, ADELAIDE);
    expect(zoneOffsetMinutes(repeated, ADELAIDE)).toBe(630);
    expect(epochMinutesToWallClock(repeated, ADELAIDE).minutesFromMidnight).toBe(2 * 60 + 30);
  });

  it("resolves a wall clock time inside the spring gap forward past it", () => {
    const skipped = wallClockToEpochMinutes("2026-10-04", 2 * 60 + 30, ADELAIDE);
    expect(epochMinutesToWallClock(skipped, ADELAIDE).minutesFromMidnight).toBe(3 * 60 + 30);
  });
});

describe("weekdayOf and daysBetween", () => {
  it("names the weekday with Sunday at zero", () => {
    expect(weekdayOf("2026-10-04")).toBe(0);
    expect(weekdayOf("2026-08-22")).toBe(6);
  });

  it("counts whole days in both directions", () => {
    expect(daysBetween("2026-08-22", "2026-08-23")).toBe(1);
    expect(daysBetween("2026-08-22", "2026-08-22")).toBe(0);
    expect(daysBetween("2026-08-23", "2026-08-22")).toBe(-1);
  });

  it("counts across a transition, where a day is not 24 hours long", () => {
    expect(daysBetween("2026-10-03", "2026-10-05")).toBe(2);
  });
});

describe("parseIsoDate", () => {
  it("rejects anything that is not YYYY-MM-DD", () => {
    expect(() => parseIsoDate("22/08/2026")).toThrow(RangeError);
  });
});

describe("addDays", () => {
  it("moves forward and backward across a month boundary", () => {
    expect(addDays("2026-08-30", 3)).toBe("2026-09-02");
    expect(addDays("2026-09-02", -3)).toBe("2026-08-30");
  });

  it("counts a leap day", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2027-02-28", 1)).toBe("2027-03-01");
  });

  it("returns the same date for no shift", () => {
    expect(addDays("2026-08-22", 0)).toBe("2026-08-22");
  });
});
