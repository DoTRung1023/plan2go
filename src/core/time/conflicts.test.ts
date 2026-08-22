import { describe, expect, it } from "vitest";
import { checkOpeningWindows } from "./conflicts";

const BASE = { stopId: "stop-1", placeName: "Fish Market", weekday: 6 } as const;

describe("checkOpeningWindows", () => {
  it("says nothing when the hours are unknown", () => {
    const result = checkOpeningWindows({
      ...BASE,
      windows: null,
      arrivalMinutes: 9 * 60,
      stayMinutes: 60,
    });

    expect(result).toEqual({ waitMinutes: 0, conflicts: [] });
  });

  it("flags a place with no windows at all as shut for the day", () => {
    const result = checkOpeningWindows({
      ...BASE,
      windows: [],
      arrivalMinutes: 9 * 60,
      stayMinutes: 60,
    });

    expect(result.waitMinutes).toBe(0);
    expect(result.conflicts).toEqual([
      { kind: "closed-all-day", stopId: "stop-1", placeName: "Fish Market", weekday: 6 },
    ]);
  });

  it("treats arriving exactly at closing time as arriving too late", () => {
    const result = checkOpeningWindows({
      ...BASE,
      windows: [{ opensAt: 7 * 60, closesAt: 16 * 60 }],
      arrivalMinutes: 16 * 60,
      stayMinutes: 0,
    });

    expect(result.conflicts[0]?.kind).toBe("arrives-after-close");
  });

  it("skips a window that has already ended and waits for the next one", () => {
    const result = checkOpeningWindows({
      ...BASE,
      windows: [
        { opensAt: 9 * 60, closesAt: 12 * 60 },
        { opensAt: 14 * 60, closesAt: 18 * 60 },
      ],
      arrivalMinutes: 13 * 60,
      stayMinutes: 60,
    });

    expect(result.waitMinutes).toBe(60);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0]?.kind).toBe("arrives-before-open");
  });

  it("counts a wait and an overrun as two separate problems", () => {
    const result = checkOpeningWindows({
      ...BASE,
      windows: [{ opensAt: 10 * 60, closesAt: 11 * 60 }],
      arrivalMinutes: 9 * 60,
      stayMinutes: 120,
    });

    expect(result.waitMinutes).toBe(60);
    expect(result.conflicts.map((entry) => entry.kind)).toEqual([
      "arrives-before-open",
      "stay-overruns-close",
    ]);
  });

  it("orders unsorted windows before choosing one", () => {
    const result = checkOpeningWindows({
      ...BASE,
      windows: [
        { opensAt: 14 * 60, closesAt: 18 * 60 },
        { opensAt: 9 * 60, closesAt: 12 * 60 },
      ],
      arrivalMinutes: 10 * 60,
      stayMinutes: 30,
    });

    expect(result).toEqual({ waitMinutes: 0, conflicts: [] });
  });
});
