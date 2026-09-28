import { describe, expect, it } from "vitest";
import type { DayCity, DayPlan } from "@/core/model/day";
import { cityOptions, dayNumbers } from "./city-options";

function city(name: string): DayCity {
  return { providerPlaceId: `g-${name}`, name, position: { lat: 16.46, lng: 107.59 } };
}

const HANOI = city("Hanoi");
const HUE = city("Hue");

function day(id: string, at: DayCity | null): DayPlan {
  return {
    id,
    date: "2026-09-28",
    timeZone: "Asia/Ho_Chi_Minh",
    label: null,
    start: null,
    end: null,
    startAtMinutes: 9 * 60,
    stops: [],
    endTravelMode: "walk",
    city: at,
  };
}

describe("dayNumbers", () => {
  it("names a single day", () => {
    expect(dayNumbers([4])).toBe("Day 4");
  });

  it("says a run of days as a range", () => {
    expect(dayNumbers([1, 2, 3])).toBe("Days 1 to 3");
  });

  it("joins separate stays the way a list is said", () => {
    expect(dayNumbers([1, 2, 3, 6])).toBe("Days 1 to 3 and 6");
    expect(dayNumbers([1, 4, 6, 7, 8])).toBe("Days 1, 4 and 6 to 8");
  });

  it("says two days in a row as two days", () => {
    expect(dayNumbers([6, 7])).toBe("Days 6 and 7");
  });
});

describe("cityOptions", () => {
  it("lists each city once with the days spent in it", () => {
    const days = [day("d1", HANOI), day("d2", HANOI), day("d3", HUE), day("d4", HANOI)];
    expect(cityOptions(days)).toEqual([
      { city: HANOI, days: "Days 1, 2 and 4" },
      { city: HUE, days: "Day 3" },
    ]);
  });

  it("offers nothing on a trip with no city", () => {
    expect(cityOptions([day("d1", null)])).toEqual([]);
  });
});
