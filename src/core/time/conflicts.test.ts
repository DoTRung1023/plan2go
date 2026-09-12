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

    expect(result).toEqual([]);
  });

  it("flags a place with no windows at all as shut for the day", () => {
    const result = checkOpeningWindows({
      ...BASE,
      windows: [],
      arrivalMinutes: 9 * 60,
      stayMinutes: 60,
    });

    expect(result).toEqual([
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

    expect(result[0]?.kind).toBe("arrives-after-close");
  });

  it("flags arriving before the doors open, with the time they open", () => {
    const result = checkOpeningWindows({
      ...BASE,
      windows: [{ opensAt: 17 * 60, closesAt: 23 * 60 }],
      arrivalMinutes: 9 * 60,
      stayMinutes: 60,
    });

    expect(result).toEqual([
      {
        kind: "arrives-before-open",
        stopId: "stop-1",
        placeName: "Fish Market",
        arrivalMinutes: 9 * 60,
        opensAt: 17 * 60,
      },
    ]);
  });

  it("measures a gap between two windows against the one still to come", () => {
    const result = checkOpeningWindows({
      ...BASE,
      windows: [
        { opensAt: 9 * 60, closesAt: 12 * 60 },
        { opensAt: 14 * 60, closesAt: 18 * 60 },
      ],
      arrivalMinutes: 13 * 60,
      stayMinutes: 60,
    });

    expect(result).toEqual([
      {
        kind: "arrives-before-open",
        stopId: "stop-1",
        placeName: "Fish Market",
        arrivalMinutes: 13 * 60,
        opensAt: 14 * 60,
      },
    ]);
  });

  it("does not wait for the doors, so a stay is measured from the arrival", () => {
    const result = checkOpeningWindows({
      ...BASE,
      windows: [{ opensAt: 10 * 60, closesAt: 11 * 60 }],
      arrivalMinutes: 9 * 60,
      stayMinutes: 120,
    });

    // Two hours from nine is eleven, which is closing and not past it.
    expect(result.map((entry) => entry.kind)).toEqual(["arrives-before-open"]);
  });

  it("says both when you arrive early and are still there after closing", () => {
    const result = checkOpeningWindows({
      ...BASE,
      windows: [{ opensAt: 10 * 60, closesAt: 11 * 60 }],
      arrivalMinutes: 9 * 60,
      stayMinutes: 180,
    });

    expect(result.map((entry) => entry.kind)).toEqual([
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

    expect(result).toEqual([]);
  });
});
