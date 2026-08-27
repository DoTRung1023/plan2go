import { describe, expect, it } from "vitest";
import { toWeeklyOpeningHours } from "./google-places";

describe("toWeeklyOpeningHours", () => {
  it("says nothing when the provider gave no hours", () => {
    expect(toWeeklyOpeningHours(undefined)).toBeNull();
  });

  it("reads an ordinary weekday window", () => {
    const week = toWeeklyOpeningHours({
      periods: [{ open: { day: 1, hour: 9, minute: 0 }, close: { day: 1, hour: 17, minute: 30 } }],
    });
    expect(week?.[1]).toEqual([{ opensAt: 540, closesAt: 1050 }]);
  });

  it("leaves a day the provider did not mention empty, which reads as closed", () => {
    const week = toWeeklyOpeningHours({
      periods: [{ open: { day: 6, hour: 7, minute: 0 }, close: { day: 6, hour: 15, minute: 0 } }],
    });
    expect(week?.[0]).toEqual([]);
    expect(week?.[6]).toEqual([{ opensAt: 420, closesAt: 900 }]);
  });

  it("carries a window that runs past midnight as a closing time beyond 1440", () => {
    const week = toWeeklyOpeningHours({
      periods: [{ open: { day: 5, hour: 18, minute: 0 }, close: { day: 6, hour: 2, minute: 0 } }],
    });
    expect(week?.[5]).toEqual([{ opensAt: 1080, closesAt: 1560 }]);
    expect(week?.[6]).toEqual([]);
  });

  it("reads one period with no closing time as open around the clock, every day", () => {
    const week = toWeeklyOpeningHours({ periods: [{ open: { day: 0, hour: 0, minute: 0 } }] });
    for (const day of [0, 1, 2, 3, 4, 5, 6] as const) {
      expect(week?.[day]).toEqual([{ opensAt: 0, closesAt: 1440 }]);
    }
  });

  it("keeps two windows on a day that shuts for lunch", () => {
    const week = toWeeklyOpeningHours({
      periods: [
        { open: { day: 2, hour: 9, minute: 0 }, close: { day: 2, hour: 12, minute: 0 } },
        { open: { day: 2, hour: 13, minute: 0 }, close: { day: 2, hour: 17, minute: 0 } },
      ],
    });
    expect(week?.[2]).toEqual([
      { opensAt: 540, closesAt: 720 },
      { opensAt: 780, closesAt: 1020 },
    ]);
  });
});
